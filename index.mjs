import * as core from "@actions/core";
import fs from "fs/promises";
import github from "@actions/github";
import { i18nextGoogleSheet } from "i18next-google-sheet";
import * as gitUtils from "./gitUtils.js";

const STATS_KEYS = {
  added: "새로 추가된 항목",
  updated: "업데이트된 항목",
  reused: "사용으로 변경된 항목",
  pruned: "미사용으로 변경된 항목",
};

const SPREADSHEET_MUTABLE_STATS = ["added", "reused", "pruned"];

function getStatsSummary(stats) {
  return stats
    .map(
      ([key, { count, namespaces }]) =>
        `- ${STATS_KEYS[key]}: ${count} ${
          count !== 0 ? `(${Array.from(namespaces).join(", ")})` : ""
        }`
    )
    .join("\n");
}

function hasSpreadsheetChanged(stats) {
  return stats.some(
    ([key, { count }]) => SPREADSHEET_MUTABLE_STATS.includes(key) && count > 0
  );
}

function getPrBody(stats) {
  return [
    "i18next 다국어 구글 스프레드시트 싱크 PR입니다.\n",
    getStatsSummary(stats),
  ].join("\n");
}

(async () => {
  try {
    const { GITHUB_TOKEN, GOOGLE_SPREADSHEET_CREDENTIALS } = process.env;

    if (!GITHUB_TOKEN) {
      core.setFailed("Please add the GITHUB_TOKEN to the action.");
      return;
    }

    if (!GOOGLE_SPREADSHEET_CREDENTIALS) {
      core.setFailed(
        "Please add the GOOGLE_SPREADSHEET_CREDENTIALS to the action."
      );
      return;
    }

    console.log("setting git user");
    await gitUtils.setupUser();

    console.log("setting GitHub credentials");
    await fs.writeFile(
      `${process.env.HOME}/.netrc`,
      `machine github.com\nlogin github-actions[bot]\npassword ${GITHUB_TOKEN}`
    );

    console.log("syncing google spreadsheet");
    const path = core.getInput("path");
    const range = core.getInput("range");
    const spreadsheetId = core.getInput("spreadsheet-id");

    const stats = await i18nextGoogleSheet({
      path,
      range,
      spreadsheet_id: spreadsheetId,
      credentials_json: GOOGLE_SPREADSHEET_CREDENTIALS,
    });
    const stats_list = Object.entries(stats);

    console.log("checking diff");
    if ((await gitUtils.diff(path)) === 0) {
      console.log("no changes found");
      return;
    }

    const repo = `${github.context.repo.owner}/${github.context.repo.repo}`;
    const branch = github.context.ref.replace("refs/heads/", "");
    const newBranch = `sync-i18next/${branch}`;
    const octokit = github.getOctokit(GITHUB_TOKEN);

    const searchQuery = `repo:${repo}+state:open+head:${newBranch}+base:${branch}`;
    const searchResult = await octokit.rest.search.issuesAndPullRequests({
      q: searchQuery,
    });

    await gitUtils.checkout(newBranch);
    const commitMessage = "chore: sync i18next google spreadsheet";
    await gitUtils.commit(commitMessage, path);
    await gitUtils.push(newBranch);

    const prBody = getPrBody(stats_list);
    if (searchResult.data.items.length === 0) {
      console.log("creating pull request");
      await octokit.rest.pulls.create({
        base: branch,
        head: newBranch,
        title: "chore: sync i18next google spreadsheet",
        body: prBody,
        ...github.context.repo,
      });
    } else {
      const [pullRequest] = searchResult.data.items;
      console.log(`updating found pull request ${pullRequest.number}`);
      await octokit.rest.pulls.update({
        pull_number: pullRequest.number,
        title: "chore: sync i18next google spreadsheet",
        body: prBody,
        ...github.context.repo,
      });
    }

    core.setOutput("stats", getStatsSummary(stats_list));
    core.setOutput("changed", hasSpreadsheetChanged(stats_list));
  } catch (error) {
    core.setFailed(error.message);
  }
})();

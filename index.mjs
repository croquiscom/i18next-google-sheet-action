import * as core from "@actions/core";
import fs from "fs/promises";
import github from "@actions/github";
import { i18nextGoogleSheet } from "i18next-google-sheet";
import * as gitUtils from "./gitUtils.js";

function getPrBody(stats) {
  const header = "다국어 싱크 PR입니다.\n";
  const body = Object.entries(stats).map(([key, value]) => {
    if (key === "added") {
      return `- 새로 추가된 항목: ${value.count} (${Array.from(
        value.namespaces
      ).join(", ")})`;
    }
    if (key === "updated") {
      return `- 업데이트된 항목: ${value.count} (${Array.from(
        value.namespaces
      ).join(", ")})`;
    }
    if (key === "reused") {
      return `- 사용으로 변경된 항목: ${value.count} (${Array.from(
        value.namespaces
      ).join(", ")})`;
    }
    if (key === "pruned") {
      return `- 미사용으로 변경된 항목: ${value.count} (${Array.from(
        value.namespaces
      ).join(", ")})`;
    }
  });

  return [header, body.join("\n")].join("\n");
}

(async () => {
  try {
    const { GITHUB_TOKEN, GOOGLE_SPREADSHEET_CREDENTIALS } = process.env;
    const path = core.getInput("path");
    const range = core.getInput("range");
    const spreadsheetId = core.getInput("spreadsheet-id");

    const stats = await i18nextGoogleSheet({
      path,
      range,
      spreadsheet_id: spreadsheetId,
      credentials_file: GOOGLE_SPREADSHEET_CREDENTIALS,
    });

    await gitUtils.setupUser();

    console.log("setting GitHub credentials");
    await fs.writeFile(
      `${process.env.HOME}/.netrc`,
      `machine github.com\nlogin github-actions[bot]\npassword ${GITHUB_TOKEN}`
    );

    if ((await gitUtils.diff(path)) === 0) {
      console.log("no diff");
      return;
    }

    const repo = `${github.context.repo.owner}/${github.context.repo.repo}`;
    const branch = github.context.ref.replace("refs/heads/", "");
    const newBranch = `sync-18next/${branch}`;
    const octokit = github.getOctokit(GITHUB_TOKEN);

    const searchQuery = `repo:${repo}+state:open+head:${newBranch}+base:${branch}`;
    const searchResult = await octokit.rest.search.issuesAndPullRequests({
      q: searchQuery,
    });

    await gitUtils.checkout(newBranch);
    const commitMessage = "chore: Sync i18next";
    await gitUtils.commit(commitMessage, path);

    await gitUtils.push(newBranch);

    const prBody = getPrBody(stats);

    if (searchResult.data.items.length === 0) {
      console.log("creating pull request");
      await octokit.rest.pulls.create({
        base: branch,
        head: newBranch,
        title: "Sync i18n",
        body: prBody,
        ...github.context.repo,
      });
    } else {
      const [pullRequest] = searchResult.data.items;

      console.log(`updating found pull request ${pullRequest.number}`);
      await octokit.rest.pulls.update({
        pull_number: pullRequest.number,
        title: "Sync i18n",
        body: prBody,
        ...github.context.repo,
      });
    }
  } catch (error) {
    core.setFailed(error.message);
  }
})();

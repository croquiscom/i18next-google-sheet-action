import * as core from "@actions/core";
import github from "@actions/github";
import { i18nextGoogleSheet } from "i18next-google-sheet";
import credentialsFile from "./credentials.json";
import * as gitUtils from "./gitUtils.js";

(async () => {
  try {
    const { GITHUB_TOKEN, GOOGLE_SPREADSHEET_CREDENTIALS } = process.env;
    const path = core.getInput("path");
    const range = core.getInput("range");
    const spreadsheetId = core.getInput("spreadsheet-id");

    // await i18nextGoogleSheet({
    //   path,
    //   range,
    //   spreadsheetId,
    //   credentialsFile: GOOGLE_SPREADSHEET_CREDENTIALS,
    // });

    // not a git repository (or any parent up to mount point /Users/pepper.ha/Desktop/kakaostyle)
    if ((await gitUtils.diff(path)) === 0) {
      console.log("no diff");
      return;
    }

    const repo = `${github.context.repo.owner}/${github.context.repo.repo}`;
    const branch = github.context.ref.replace("refs/heads/", "");
    const newBranch = `sync-18next/${branch}`;
    const octokit = github.getOctokit(GITHUB_TOKEN);

    const searchQuery = `repo:${repo}+state:open+head:${branch}+base:master`;
    const searchResult = octokit.rest.search.issuesAndPullRequests({
      q: searchQuery,
    });

    if (!(await gitUtils.checkIfClean())) {
      await gitUtils.checkout(newBranch);
      const commitMessage = "chore: Sync i18next";
      await gitUtils.commit(commitMessage, path);
    }

    await gitUtils.push(newBranch);

    if (searchResult.data.items.length === 0) {
      console.log("creating pull request");
      await octokit.pulls.create({
        base: branch,
        head: newBranch,
        title: "Sync i18n",
        ...github.context.repo,
      });
    } else {
      const [pullRequest] = searchResult.data.items;

      console.log(`updating found pull request ${pullRequest.number}`);
      await octokit.pulls.update({
        pull_number: pullRequest.number,
        title: "Sync i18n",
        ...github.context.repo,
      });
    }
  } catch (error) {
    core.setFailed(error.message);
  }
})();

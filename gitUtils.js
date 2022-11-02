import { exec } from "@actions/exec";

export const setupUser = async () => {
  await exec("git", ["config", "user.name", `"github-actions[bot]"`]);
  await exec("git", [
    "config",
    "user.email",
    `"github-actions[bot]@users.noreply.github.com"`,
  ]);
};

export const diff = async (path) => {
  return await exec("git", ["diff", "--exit-code", path], {
    ignoreReturnCode: true,
  });
};

export const checkout = async (branch) => {
  const exitCode = await exec("git", ["checkout", "-b", branch], {
    ignoreReturnCode: true,
  });

  if (exitCode !== 0) {
    await exec("git", ["branch", "-D", branch]);
    await exec("git", ["checkout", "-b", branch]);
  }
};

export const commit = async (message, path) => {
  await exec("git", ["add", path]);
  await exec("git", ["commit", "-m", message]);
};

export const push = async (branch) => {
  await exec("git", ["push", "-u", "-f", "origin", branch]);
};

export const pull = async (branch) => {
  await exec("git", ["pull", "origin", branch]);
};

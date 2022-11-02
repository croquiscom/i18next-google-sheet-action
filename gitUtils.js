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
  return await exec("git", ["diff", "--exit-code", path]);
};

export const checkout = async (branch) => {
  const { stderr } = await execWithOutput("git", ["checkout", "-b", branch], {
    ignoreReturnCode: true,
  });

  if (stderr) {
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

export const checkIfClean = async () => {
  const { stdout } = await execWithOutput("git", ["status"]);
  return !stdout.length;
};

async function execWithOutput(command, args, options) {
  let output = "";
  let error = "";

  return {
    code: await exec(command, args, {
      listeners: {
        stdout: (data) => {
          output += data.toString();
        },
        stderr: (data) => {
          error += data.toString();
        },
      },
      ...options,
    }),
    stdout: output,
    stderr: error,
  };
}

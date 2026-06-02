const { spawnSync } = require("node:child_process");

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["next", "build"], {
  env: {
    ...process.env,
    CAPACITOR_BUILD: "1",
  },
  shell: process.platform === "win32",
  stdio: "inherit",
});

process.exit(result.status ?? 1);

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");

function copyIntoStandalone(source, target) {
  if (!fs.existsSync(source)) {
    return;
  }

  fs.rmSync(target, { force: true, recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

if (!fs.existsSync(standaloneDir)) {
  throw new Error("Missing .next/standalone. Run next build before packaging the desktop app.");
}

copyIntoStandalone(path.join(root, "public"), path.join(standaloneDir, "public"));
copyIntoStandalone(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"));

console.log("Prepared Next standalone assets for Electron.");

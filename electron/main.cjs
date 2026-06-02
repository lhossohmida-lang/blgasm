const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { app, BrowserWindow, shell } = require("electron");

let appUrlPromise;

function appRoot() {
  return app.isPackaged ? app.getAppPath() : path.resolve(__dirname, "..");
}

function publicAssetPath(fileName) {
  const root = appRoot();
  const candidates = [
    path.join(root, "public", fileName),
    path.join(root, ".next", "standalone", "public", fileName),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
        } else {
          reject(new Error("Could not allocate a local port."));
        }
      });
    });
  });
}

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error("The local application server did not start in time."));
          return;
        }
        setTimeout(check, 250);
      });
    };

    check();
  });
}

async function startStandaloneApp() {
  if (process.env.BLGASM_ELECTRON_DEV_URL) {
    return process.env.BLGASM_ELECTRON_DEV_URL;
  }

  const root = appRoot();
  const standaloneDir = path.join(root, ".next", "standalone");
  const serverPath = path.join(standaloneDir, "server.js");

  if (!fs.existsSync(serverPath)) {
    throw new Error("Missing .next/standalone/server.js. Run npm run build:desktop first.");
  }

  const port = await findFreePort();
  process.env.NODE_ENV = "production";
  process.env.NEXT_TELEMETRY_DISABLED = "1";
  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";

  process.chdir(standaloneDir);
  require(serverPath);

  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url);
  return url;
}

async function createMainWindow() {
  if (!appUrlPromise) {
    appUrlPromise = startStandaloneApp();
  }

  const startUrl = await appUrlPromise;
  const window = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: "Blgasm POS",
    icon: publicAssetPath("blgasm-icon.ico"),
    backgroundColor: "#fbfff8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.removeMenu();
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await window.loadURL(startUrl);
}

app.on("ready", () => {
  createMainWindow().catch((error) => {
    console.error(error);
    app.quit();
  });
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow().catch((error) => {
      console.error(error);
      app.quit();
    });
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

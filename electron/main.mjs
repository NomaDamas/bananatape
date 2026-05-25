import { app, BrowserWindow, dialog } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFreePort, waitForServer } from './server-lifecycle.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── State ────────────────────────────────────────────────────────────────────
let serverProcess = null;
let mainWindow = null;
let serverPort = null;

// ── Single-instance lock ─────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveStandalonePath() {
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'standalone', 'server.js')
    : path.resolve(__dirname, '..', '.next', 'standalone', 'server.js');
  if (!fs.existsSync(serverPath)) {
    throw new Error(
      `Next.js standalone server not found at ${serverPath}.\n` +
      'Run "npm run build" first to generate the standalone output.',
    );
  }
  return serverPath;
}

function spawnServer(serverPath, port, projectPath) {
  const launchId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      HOSTNAME: '127.0.0.1',
      PORT: String(port),
      NODE_ENV: 'production',
      BANANATAPE_ACTIVE_PROJECT_PATH: projectPath,
      BANANATAPE_LAUNCH_ID: launchId,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(`[server] ${data}`);
  });
  child.stderr.on('data', (data) => {
    process.stderr.write(`[server] ${data}`);
  });
  child.on('exit', (code) => {
    if (serverProcess === child) {
      console.log(`[server] exited with code ${code}`);
      serverProcess = null;
    }
  });

  return child;
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'BananaTape',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(`http://127.0.0.1:${port}`);

  win.on('closed', () => {
    mainWindow = null;
  });

  mainWindow = win;
  return win;
}

function killServer() {
  if (!serverProcess) return;
  const child = serverProcess;
  serverProcess = null;

  child.kill('SIGTERM');
  const forceKill = setTimeout(() => {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  }, 3000);

  child.on('exit', () => clearTimeout(forceKill));
}

function parseProjectArg() {
  const args = process.argv;
  const idx = args.indexOf('--project');
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return null;
}

function validateProjectPath(projectPath) {
  const manifestPath = path.join(projectPath, 'project.json');
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!manifest || manifest.schemaVersion !== 1 || !manifest.id) {
      return null;
    }
    return { id: manifest.id, name: manifest.name, path: projectPath };
  } catch {
    return null;
  }
}

function resolveProjectPath() {
  // 1. Check --project CLI arg
  const argPath = parseProjectArg();
  if (argPath) {
    const resolved = path.resolve(argPath);
    const project = validateProjectPath(resolved);
    if (project) return resolved;
    dialog.showErrorBox(
      'Invalid Project',
      `"${resolved}" is not a valid BananaTape project.\nMake sure it contains a project.json file.`,
    );
    return null;
  }

  // 2. Show file dialog
  const result = dialog.showOpenDialogSync({
    title: 'Open BananaTape Project',
    properties: ['openDirectory'],
    message: 'Select a BananaTape project folder',
  });

  if (!result || result.length === 0) return null;

  const selected = result[0];
  const project = validateProjectPath(selected);
  if (project) return selected;

  dialog.showErrorBox(
    'Invalid Project',
    `"${selected}" is not a valid BananaTape project.\nMake sure it contains a project.json file created by "bananatape create".`,
  );
  return null;
}

// ── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (!gotLock) return;

  const projectPath = resolveProjectPath();
  if (!projectPath) {
    app.quit();
    return;
  }

  const isDev = Boolean(process.env.ELECTRON_DEV);
  let port;

  if (isDev) {
    // Dev mode: assume `npm run dev` is running on port 3000
    port = Number(process.env.ELECTRON_DEV_PORT) || 3000;
    console.log(`[electron] dev mode — connecting to http://127.0.0.1:${port}`);
  } else {
    try {
      const serverPath = resolveStandalonePath();
      port = await findFreePort();
      console.log(`[electron] starting server on port ${port} for project: ${projectPath}`);
      serverProcess = spawnServer(serverPath, port, projectPath);
      await waitForServer(`http://127.0.0.1:${port}/api/projects/current`);
      console.log(`[electron] server ready on port ${port}`);
    } catch (error) {
      dialog.showErrorBox('Server Error', error.message);
      app.quit();
      return;
    }
  }

  serverPort = port;
  createWindow(port);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    killServer();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverPort) {
    createWindow(serverPort);
  }
});

app.on('before-quit', () => {
  killServer();
});

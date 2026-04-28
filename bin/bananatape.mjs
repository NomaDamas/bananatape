#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA_VERSION = 1;
const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function homeDir() { return os.homedir(); }
function runtimeDir() { return path.resolve(process.env.BANANATAPE_HOME || path.join(homeDir(), '.bananatape')); }
function projectsRoot() { return path.resolve(process.env.BANANATAPE_PROJECTS_DIR || path.join(homeDir(), 'Documents', 'BananaTape Projects')); }
function registryPath() { return path.join(runtimeDir(), 'projects.json'); }
function runtimePath() { return path.join(runtimeDir(), 'runtime.json'); }
function nowIso() { return new Date().toISOString(); }
function slugify(name) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);
  if (!slug) throw new Error('Project name must include at least one letter or number.');
  return slug;
}
function projectPathFor(id, dir = projectsRoot()) { return path.join(path.resolve(dir), id); }

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
async function readRegistry() {
  const registry = await readJson(registryPath(), { schemaVersion: SCHEMA_VERSION, projects: [] });
  return registry.schemaVersion === SCHEMA_VERSION && Array.isArray(registry.projects) ? registry : { schemaVersion: SCHEMA_VERSION, projects: [] };
}
async function writeRegistry(registry) { await writeJson(registryPath(), registry); }
async function readRuntime() {
  const registry = await readJson(runtimePath(), { schemaVersion: SCHEMA_VERSION, running: [] });
  return registry.schemaVersion === SCHEMA_VERSION && Array.isArray(registry.running) ? registry : { schemaVersion: SCHEMA_VERSION, running: [] };
}
async function writeRuntime(runtime) { await writeJson(runtimePath(), runtime); }
function isProcessAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
async function cleanupRuntime() {
  const runtime = await readRuntime();
  const running = runtime.running.filter((entry) => isProcessAlive(entry.pid));
  if (running.length !== runtime.running.length) await writeRuntime({ schemaVersion: SCHEMA_VERSION, running });
  return { schemaVersion: SCHEMA_VERSION, running };
}
async function createProject(name, options) {
  const id = slugify(name);
  const root = projectPathFor(id, options.dir);
  const manifest = { schemaVersion: SCHEMA_VERSION, id, name: name.trim(), createdAt: nowIso(), updatedAt: nowIso() };
  await fs.mkdir(path.join(root, 'assets'), { recursive: true });
  await fs.mkdir(path.join(root, 'thumbnails'), { recursive: true });
  await fs.mkdir(path.join(root, 'tmp'), { recursive: true });
  await fs.writeFile(path.join(root, 'project.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  await fs.writeFile(path.join(root, 'history.json'), `${JSON.stringify({ schemaVersion: SCHEMA_VERSION, revision: 0, entries: [] }, null, 2)}\n`, { flag: 'wx' });
  const registry = await readRegistry();
  registry.projects = registry.projects.filter((project) => project.id !== id && project.path !== root);
  registry.projects.push({ id, name: manifest.name, path: root, createdAt: manifest.createdAt, lastOpenedAt: null });
  await writeRegistry(registry);
  console.log(`Created ${id}\n${root}`);
}
async function resolveProject(ref) {
  const registry = await readRegistry();
  const byId = registry.projects.find((project) => project.id === ref || project.name === ref);
  const projectPath = byId?.path || path.resolve(ref);
  const manifestPath = path.join(projectPath, 'project.json');
  const manifest = await readJson(manifestPath, null);
  if (!manifest || manifest.schemaVersion !== SCHEMA_VERSION || !manifest.id) throw new Error(`Not a BananaTape project: ${ref}`);
  return { id: manifest.id, name: manifest.name, path: projectPath, manifest };
}
async function listProjects() {
  const [registry, runtime] = await Promise.all([readRegistry(), cleanupRuntime()]);
  for (const project of registry.projects) {
    const running = runtime.running.find((entry) => entry.projectId === project.id);
    console.log(`${project.id}\t${running ? `running http://127.0.0.1:${running.port}` : 'stopped'}\t${project.path}`);
  }
}
async function status(ref) {
  const [registry, runtime] = await Promise.all([readRegistry(), cleanupRuntime()]);
  const project = ref ? registry.projects.find((entry) => entry.id === ref || entry.name === ref || entry.path === path.resolve(ref)) : null;
  const entries = ref
    ? runtime.running.filter((entry) => entry.projectId === ref || entry.projectPath === path.resolve(ref) || entry.projectId === project?.id)
    : runtime.running;
  if (entries.length === 0) {
    if (project) {
      console.log(`${project.id}\n  status: stopped\n  path: ${project.path}`);
      return;
    }
    console.log('No running BananaTape projects.');
    return;
  }
  for (const entry of entries) {
    console.log(`${entry.projectId}\n  status: running\n  url: http://127.0.0.1:${entry.port}\n  pid: ${entry.pid}\n  launchId: ${entry.launchId}`);
  }
}
async function deleteProject(ref, options) {
  const project = await resolveProject(ref);
  let registry = await readRegistry();
  registry.projects = registry.projects.filter((item) => item.id !== project.id);
  await writeRegistry(registry);
  if (options.deleteFiles) await fs.rm(project.path, { recursive: true, force: true });
  console.log(`${options.deleteFiles ? 'Deleted' : 'Unregistered'} ${project.id}`);
}
function parseOptions(args) {
  const options = {};
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dir') options.dir = args[++i];
    else if (arg === '--port') options.port = Number(args[++i]);
    else if (arg === '--no-open') options.noOpen = true;
    else if (arg === '--rebuild') options.rebuild = true;
    else if (arg === '--delete-files') options.deleteFiles = true;
    else if (arg === '--all') options.all = true;
    else rest.push(arg);
  }
  return { options, rest };
}
async function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}
async function findFreePort(preferred) {
  if (preferred) {
    if (await isPortFree(preferred)) return preferred;
    throw new Error(`Port ${preferred} is already in use.`);
  }
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}
async function pathExists(file) {
  try { await fs.access(file); return true; } catch { return false; }
}
async function buildExists() {
  return pathExists(path.join(APP_ROOT, '.next', 'BUILD_ID'));
}
async function standaloneServerExists() {
  return pathExists(path.join(APP_ROOT, '.next', 'standalone', 'server.js'));
}
async function copyIfMissing(source, destination) {
  if (await pathExists(destination) || !(await pathExists(source))) return;
  await fs.cp(source, destination, { recursive: true });
}
async function prepareStandaloneServer() {
  const standaloneRoot = path.join(APP_ROOT, '.next', 'standalone');
  await copyIfMissing(path.join(APP_ROOT, '.next', 'static'), path.join(standaloneRoot, '.next', 'static'));
  await copyIfMissing(path.join(APP_ROOT, 'public'), path.join(standaloneRoot, 'public'));
}
function spawnBrowser(url) {
  if (process.platform === 'darwin') return spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
  if (process.platform === 'win32') return spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref();
  return spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
}
async function launchProject(ref, options) {
  const project = await resolveProject(ref);
  const runtime = await cleanupRuntime();
  const existing = runtime.running.find((entry) => entry.projectId === project.id);
  if (existing && !options.port) {
    const url = `http://127.0.0.1:${existing.port}`;
    if (!options.noOpen) spawnBrowser(url);
    console.log(`${project.id} already running at ${url}`);
    return;
  }
  if (options.rebuild || !(await buildExists())) {
    console.log('Building BananaTape...');
    await new Promise((resolve, reject) => {
      const child = spawn('npm', ['run', 'build'], { cwd: APP_ROOT, stdio: 'inherit' });
      child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('Build failed')));
    });
  }
  const port = await findFreePort(options.port);
  const launchId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const hasStandaloneServer = await standaloneServerExists();
  if (hasStandaloneServer) await prepareStandaloneServer();
  const child = hasStandaloneServer
    ? spawn(process.execPath, [path.join(APP_ROOT, '.next', 'standalone', 'server.js')], {
      cwd: APP_ROOT,
      env: {
        ...process.env,
        HOSTNAME: '127.0.0.1',
        PORT: String(port),
        BANANATAPE_ACTIVE_PROJECT_PATH: project.path,
        BANANATAPE_LAUNCH_ID: launchId,
      },
      stdio: ['ignore', 'ignore', 'ignore'],
      detached: true,
    })
    : spawn('npm', ['run', 'start', '--', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: APP_ROOT,
    env: {
      ...process.env,
      BANANATAPE_ACTIVE_PROJECT_PATH: project.path,
      BANANATAPE_LAUNCH_ID: launchId,
    },
    stdio: ['ignore', 'ignore', 'ignore'],
    detached: true,
  });
  child.unref();
  runtime.running.push({ projectId: project.id, projectPath: project.path, port, pid: child.pid, launchId, startedAt: nowIso() });
  await writeRuntime(runtime);
  const url = `http://127.0.0.1:${port}`;
  if (!options.noOpen) spawnBrowser(url);
  console.log(`Launched ${project.id} at http://127.0.0.1:${port}`);
}
async function stopProject(ref, options) {
  const runtime = await readRuntime();
  const keep = [];
  for (const entry of runtime.running) {
    const match = options.all || entry.projectId === ref || entry.projectPath === path.resolve(ref || '');
    if (match) {
      try { process.kill(entry.pid, 'SIGTERM'); } catch {}
      console.log(`Stopped ${entry.projectId}`);
    } else keep.push(entry);
  }
  await writeRuntime({ schemaVersion: SCHEMA_VERSION, running: keep });
}
function usage() {
  console.log(`BananaTape CLI\n\nCommands:\n  bananatape create <name> [--dir <parent>]\n  bananatape list\n  bananatape launch <project> [--port <port>] [--no-open] [--rebuild]\n  bananatape open <project>\n  bananatape status [project]\n  bananatape stop <project|--all>\n  bananatape delete <project> [--delete-files]`);
}
async function main() {
  const [command, ...args] = process.argv.slice(2);
  const { options, rest } = parseOptions(args);
  if (!command || command === 'help' || command === '--help') return usage();
  if (command === 'create') return createProject(rest.join(' '), options);
  if (command === 'list') return listProjects();
  if (command === 'launch' || command === 'open') return launchProject(rest[0], options);
  if (command === 'status') return status(rest[0]);
  if (command === 'stop') return stopProject(rest[0], options);
  if (command === 'delete') return deleteProject(rest[0], options);
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const CLI_PATH = path.resolve(process.cwd(), 'bin', 'bananatape.mjs');

interface CliResult {
  stdout: string;
  stderr: string;
}

let env: NodeJS.ProcessEnv;
let home: string;
let projectsDir: string;

async function runCli(args: string[]): Promise<CliResult> {
  return execFileAsync(process.execPath, [CLI_PATH, ...args], { cwd: os.tmpdir(), env }) as Promise<CliResult>;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Expected TCP address')));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

async function waitUntilRunning(projectId: string): Promise<CliResult> {
  let last = await runCli(['status', projectId]);
  for (let index = 0; index < 20 && !last.stdout.includes('status: running'); index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    last = await runCli(['status', projectId]);
  }
  return last;
}

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), 'bananatape-cli-home-'));
  projectsDir = await mkdtemp(path.join(os.tmpdir(), 'bananatape-cli-projects-'));
  env = {
    ...process.env,
    BANANATAPE_HOME: home,
    BANANATAPE_PROJECTS_DIR: projectsDir,
  };
});

describe('bananatape CLI project lifecycle', () => {
  it('creates, lists, reports stopped status, unregisters, and explicitly deletes project files', async () => {
    const created = await runCli(['create', 'My First Project']);
    expect(created.stdout).toContain('Created my-first-project');

    const projectPath = path.join(projectsDir, 'my-first-project');
    await expect(access(path.join(projectPath, 'project.json'))).resolves.toBeUndefined();
    await expect(access(path.join(projectPath, 'history.json'))).resolves.toBeUndefined();

    const manifest = JSON.parse(await readFile(path.join(projectPath, 'project.json'), 'utf8'));
    expect(manifest).toMatchObject({ schemaVersion: 1, id: 'my-first-project', name: 'My First Project' });

    const list = await runCli(['list']);
    expect(list.stdout).toContain('my-first-project');
    expect(list.stdout).toContain('stopped');
    expect(list.stdout).toContain(projectPath);

    const status = await runCli(['status', 'my-first-project']);
    expect(status.stdout).toContain('status: stopped');
    expect(status.stdout).toContain(projectPath);

    const unregistered = await runCli(['delete', 'my-first-project']);
    expect(unregistered.stdout).toContain('Unregistered my-first-project');
    await expect(access(path.join(projectPath, 'project.json'))).resolves.toBeUndefined();

    const deleted = await runCli(['delete', projectPath, '--delete-files']);
    expect(deleted.stdout).toContain('Deleted my-first-project');
    await expect(access(path.join(projectPath, 'project.json'))).rejects.toThrow();
  });

  it('rejects duplicate project folders and invalid empty names', async () => {
    await runCli(['create', 'Duplicate']);
    await expect(runCli(['create', 'Duplicate'])).rejects.toMatchObject({
      stderr: expect.stringContaining('file already exists'),
    });
    await expect(runCli(['create', '***'])).rejects.toMatchObject({
      stderr: expect.stringContaining('Project name must include at least one letter or number'),
    });
  });

  it('cleans stale runtime entries from list and status output', async () => {
    await runCli(['create', 'Stale Runtime']);
    await writeFile(path.join(home, 'runtime.json'), JSON.stringify({
      schemaVersion: 1,
      running: [{
        projectId: 'stale-runtime',
        projectPath: path.join(projectsDir, 'stale-runtime'),
        port: 6553,
        pid: 99999999,
        launchId: 'deadbeef',
        startedAt: new Date().toISOString(),
      }],
    }, null, 2));

    const list = await runCli(['list']);
    expect(list.stdout).toContain('stopped');
    expect(list.stdout).not.toContain('6553');

    const runtime = JSON.parse(await readFile(path.join(home, 'runtime.json'), 'utf8'));
    expect(runtime.running).toEqual([]);
  });

  it('launches a project on the requested 127.0.0.1 port and stops it from the runtime registry', async () => {
    await runCli(['create', 'Launchable']);
    const port = await freePort();

    const launched = await runCli(['launch', 'launchable', '--port', String(port), '--no-open']);
    expect(launched.stdout).toContain(`Launched launchable at http://127.0.0.1:${port}`);

    try {
      const status = await waitUntilRunning('launchable');
      expect(status.stdout).toContain('status: running');
      expect(status.stdout).toContain(`url: http://127.0.0.1:${port}`);
      expect(status.stdout).not.toContain('cookieName');

      const runtime = JSON.parse(await readFile(path.join(home, 'runtime.json'), 'utf8'));
      expect(runtime.running).toHaveLength(1);
      expect(runtime.running[0]).toMatchObject({
        projectId: 'launchable',
        projectPath: path.join(projectsDir, 'launchable'),
        port,
      });
      expect(runtime.running[0].launchId).toEqual(expect.any(String));
      expect(runtime.running[0].cookieName).toBeUndefined();
    } finally {
      await runCli(['stop', 'launchable']);
    }

    const stoppedRuntime = JSON.parse(await readFile(path.join(home, 'runtime.json'), 'utf8'));
    expect(stoppedRuntime.running).toEqual([]);
  }, 20_000);

  it('refreshes standalone static and public assets before launching', async () => {
    const appRoot = await mkdtemp(path.join(os.tmpdir(), 'bananatape-app-root-'));
    const standaloneRoot = path.join(appRoot, '.next', 'standalone');
    const sourceStatic = path.join(appRoot, '.next', 'static', 'chunks');
    const destinationStatic = path.join(standaloneRoot, '.next', 'static', 'chunks');
    const sourcePublic = path.join(appRoot, 'public');
    const destinationPublic = path.join(standaloneRoot, 'public');

    await mkdir(sourceStatic, { recursive: true });
    await mkdir(destinationStatic, { recursive: true });
    await mkdir(sourcePublic, { recursive: true });
    await mkdir(destinationPublic, { recursive: true });
    await writeFile(path.join(appRoot, '.next', 'BUILD_ID'), 'test-build');
    await writeFile(path.join(sourceStatic, 'current.js'), 'console.log("current")');
    await writeFile(path.join(destinationStatic, 'stale.js'), 'console.log("stale")');
    await writeFile(path.join(sourcePublic, 'current.txt'), 'current public');
    await writeFile(path.join(destinationPublic, 'stale.txt'), 'stale public');
    await writeFile(path.join(standaloneRoot, 'server.js'), `
      const http = require('node:http');
      const server = http.createServer((request, response) => {
        response.end(request.url === '/api/projects/current' ? '{}' : 'ok');
      });
      server.listen(Number(process.env.PORT), process.env.HOSTNAME);
      process.on('SIGTERM', () => server.close(() => process.exit(0)));
    `);

    env = {
      ...env,
      BANANATAPE_TEST_APP_ROOT: appRoot,
    };
    await runCli(['create', 'Asset Sync']);
    const port = await freePort();

    try {
      await runCli(['launch', 'asset-sync', '--port', String(port), '--no-open']);
      await expect(readFile(path.join(destinationStatic, 'current.js'), 'utf8')).resolves.toContain('current');
      await expect(readFile(path.join(destinationStatic, 'stale.js'), 'utf8')).rejects.toThrow();
      await expect(readFile(path.join(destinationPublic, 'current.txt'), 'utf8')).resolves.toBe('current public');
      await expect(readFile(path.join(destinationPublic, 'stale.txt'), 'utf8')).rejects.toThrow();
    } finally {
      await runCli(['stop', 'asset-sync']);
      await rm(appRoot, { recursive: true, force: true });
    }
  });

  it('rejects an occupied explicit launch port', async () => {
    await runCli(['create', 'Port Collision']);
    const server = net.createServer();
    const port = await new Promise<number>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          reject(new Error('Expected TCP address'));
          return;
        }
        resolve(address.port);
      });
    });

    try {
      await expect(runCli(['launch', 'port-collision', '--port', String(port), '--no-open'])).rejects.toMatchObject({
        stderr: expect.stringContaining(`Port ${port} is already in use.`),
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await rm(path.join(home, 'runtime.json'), { force: true });
    }
  });
});

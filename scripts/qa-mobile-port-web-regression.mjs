#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE_DIR = path.join(REPO_ROOT, '.omo', 'evidence', 'mobile-native-port', 'web-regression');
const SUMMARY_PATH = path.join(EVIDENCE_DIR, 'summary.json');
const FORCE_BAD_COMMAND = process.env.BANANATAPE_TEST_FORCE_BAD_COMMAND === '1';
const MODE_SUMMARY_PATH = path.join(EVIDENCE_DIR, FORCE_BAD_COMMAND ? 'summary-forced-failure.json' : 'summary-happy.json');

const regressionCommands = [
  { name: 'npm-run-lint', command: 'npm', args: ['run', 'lint'] },
  { name: 'npm-run-typecheck', command: 'npm', args: ['run', 'typecheck'] },
  { name: 'npx-vitest-run', command: 'npx', args: ['vitest', 'run'] },
  { name: 'npx-playwright-test', command: 'npx', args: ['playwright', 'test'], env: { CI: '1' } },
  { name: 'npm-run-build', command: 'npm', args: ['run', 'build'] },
];

const forcedFailureCommand = {
  name: 'forced-bad-command',
  command: process.execPath,
  args: ['-e', 'console.error("forced BananaTape QA failure"); process.exit(9);'],
};

function startedAtIso() {
  return new Date().toISOString();
}

function durationMs(startedAt) {
  return Date.now() - startedAt;
}

function logPaths(name) {
  return {
    stdout: path.join(EVIDENCE_DIR, `${name}.stdout.log`),
    stderr: path.join(EVIDENCE_DIR, `${name}.stderr.log`),
  };
}

function summaryRecord({ name, commandLine, startedAt, elapsedMs, exitCode, stdoutPath, stderrPath }) {
  return {
    name,
    commandLine,
    exitCode,
    status: exitCode === 0 ? 'pass' : 'fail',
    durationMs: elapsedMs,
    startedAt,
    evidenceLogPaths: {
      stdout: path.relative(REPO_ROOT, stdoutPath),
      stderr: path.relative(REPO_ROOT, stderrPath),
    },
  };
}

async function writeText(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text, 'utf8');
}

async function runCommand(spec) {
  const startedAt = startedAtIso();
  const startedMs = Date.now();
  const paths = logPaths(spec.name);
  await writeText(paths.stdout, '');
  await writeText(paths.stderr, '');
  const commandLine = [spec.command, ...spec.args].join(' ');

  return new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    const child = spawn(spec.command, spec.args, {
      cwd: REPO_ROOT,
      env: { ...process.env, ...(spec.env ?? {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      stdoutChunks.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderrChunks.push(chunk);
    });
    child.on('error', reject);
    child.on('close', async (code) => {
      await writeText(paths.stdout, Buffer.concat(stdoutChunks).toString());
      await writeText(paths.stderr, Buffer.concat(stderrChunks).toString());
      resolve(summaryRecord({
        name: spec.name,
        commandLine,
        startedAt,
        elapsedMs: durationMs(startedMs),
        exitCode: code ?? 1,
        stdoutPath: paths.stdout,
        stderrPath: paths.stderr,
      }));
    });
  });
}

async function runCliStep(cliEnv, args, logFile) {
  const commandLine = `node bin/bananatape.mjs ${args.join(' ')}`;
  return new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    const child = spawn(process.execPath, ['bin/bananatape.mjs', ...args], {
      cwd: REPO_ROOT,
      env: cliEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      stdoutChunks.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderrChunks.push(chunk);
    });
    child.on('error', reject);
    child.on('close', async (code) => {
      await fs.appendFile(logFile, `\n$ ${commandLine}\n`, 'utf8');
      await fs.appendFile(logFile, Buffer.concat(stdoutChunks).toString(), 'utf8');
      await fs.appendFile(logFile, Buffer.concat(stderrChunks).toString(), 'utf8');
      resolve(code ?? 1);
    });
  });
}

async function runCliSmoke() {
  const name = 'isolated-cli-smoke';
  const startedAt = startedAtIso();
  const startedMs = Date.now();
  const paths = logPaths(name);
  await writeText(paths.stdout, '');
  await writeText(paths.stderr, '');

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'bananatape-web-regression-'));
  const isolatedHome = path.join(tempRoot, 'home');
  const isolatedProjects = path.join(tempRoot, 'projects');
  const cliEnv = {
    ...process.env,
    BANANATAPE_HOME: isolatedHome,
    BANANATAPE_PROJECTS_DIR: isolatedProjects,
  };
  const cliLog = paths.stdout;
  await fs.appendFile(cliLog, `BANANATAPE_HOME=${isolatedHome}\nBANANATAPE_PROJECTS_DIR=${isolatedProjects}\n`, 'utf8');

  const steps = [
    ['create', 'QA Mobile Port Smoke'],
    ['list'],
    ['status', 'qa-mobile-port-smoke'],
    ['delete', 'qa-mobile-port-smoke', '--delete-files'],
  ];
  let exitCode = 0;

  try {
    for (const args of steps) {
      const stepCode = await runCliStep(cliEnv, args, cliLog);
      if (stepCode !== 0) {
        exitCode = stepCode;
        break;
      }
    }
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }

  return summaryRecord({
    name,
    commandLine: 'isolated BANANATAPE_HOME/BANANATAPE_PROJECTS_DIR CLI create/list/status/delete',
    startedAt,
    elapsedMs: durationMs(startedMs),
    exitCode,
    stdoutPath: paths.stdout,
    stderrPath: paths.stderr,
  });
}

function selectedCommands() {
  return FORCE_BAD_COMMAND ? [forcedFailureCommand] : regressionCommands;
}

async function writeSummary(commands) {
  const failed = commands.filter((command) => command.status === 'fail');
  const summary = {
    generatedAt: startedAtIso(),
    forceFailureMode: FORCE_BAD_COMMAND,
    status: failed.length === 0 ? 'pass' : 'fail',
    commands,
  };
  await writeText(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
  await writeText(MODE_SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

async function run() {
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });

  const results = [await runCliSmoke()];
  for (const command of selectedCommands()) {
    results.push(await runCommand(command));
  }

  const summary = await writeSummary(results);
  console.log(`Wrote ${path.relative(REPO_ROOT, SUMMARY_PATH)}`);
  for (const command of summary.commands) {
    console.log(`${command.status.toUpperCase()} ${command.name} (${command.exitCode}) ${command.durationMs}ms`);
  }

  process.exitCode = summary.status === 'pass' ? 0 : 1;
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

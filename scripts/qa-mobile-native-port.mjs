#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE_DIR = path.join(REPO_ROOT, '.omo', 'evidence', 'mobile-native-port', 'final');
const SUMMARY_PATH = path.join(EVIDENCE_DIR, 'summary.json');
const LOG_DIR = path.join(EVIDENCE_DIR, 'logs');

const CORE_SIMULATOR_PATTERN = /CoreSimulator is out of date|1051\.54\.0|1051\.55\.0|Authorization is required to install the packages/i;
const ANDROID_DEVICE_PATTERN = /No connected Android device|no devices\/emulators found|device ['\"]?null['\"]? not found|INSTALL_FAILED|device offline/i;
const COMMAND_MISSING_PATTERN = /ENOENT|command not found|not found/i;

const commandChecks = [
  cmd('web-cli', 'npm-run-lint', 'npm', ['run', 'lint']),
  cmd('web-cli', 'npm-run-typecheck', 'npm', ['run', 'typecheck']),
  cmd('web-cli', 'npx-vitest-run', 'npx', ['vitest', 'run']),
  cmd('web-cli', 'web-regression-runner', process.execPath, ['scripts/qa-mobile-port-web-regression.mjs']),
  cmd('mobile-contracts', 'mobile-contract-fixtures', 'npx', ['vitest', 'run', 'packages/mobile-contracts']),
  cmd('ios', 'ios-build-for-testing', 'xcodebuild', ['build-for-testing', '-project', 'apps/ios/BananaTape/BananaTape.xcodeproj', '-scheme', 'BananaTape', '-destination', 'generic/platform=iOS Simulator'], 'ios-coresimulator-mismatch'),
  cmd('ios', 'ios-simulator-availability-probe', 'xcrun', ['simctl', 'list', 'devices', 'available'], 'ios-coresimulator-mismatch'),
  cmd('ios', 'ios-runtime-xctest', 'xcodebuild', ['test', '-project', 'apps/ios/BananaTape/BananaTape.xcodeproj', '-scheme', 'BananaTape', '-destination', 'platform=iOS Simulator,name=iPhone 17'], 'ios-coresimulator-mismatch'),
  cmd('android', 'android-unit-tests', 'apps/android/gradlew', ['-p', 'apps/android', 'testDebugUnitTest']),
  cmd('android', 'android-connected-tests', 'apps/android/gradlew', ['-p', 'apps/android', 'connectedDebugAndroidTest'], 'android-connected-device-unavailable'),
  cmd('evidence', 'android-generated-artifact-guard', 'git', ['status', '--short', '--untracked-files=all', '--', 'apps/android'], null, '(\\.gradle/|(^|/)build/|app/build/)'),
  cmd('evidence', 'codex-unsupported-evidence', 'rg', ['-n', 'Verdict: FAIL|Codex mobile provider is not available in this build', '.omo/evidence/mobile-native-port/provider/codex-feasibility.md', 'apps/ios/BananaTape', 'apps/android/app/src'], null, null, 'Verdict: FAIL|Codex mobile provider is not available in this build'),
  cmd('evidence', 'magic-layer-desktop-only-evidence', 'rg', ['-n', 'Magic Layer editing is desktop-only|No mobile Magic Layer creation|No mobile SAM3 creation', 'docs/mobile/feature-parity.md', 'apps/ios/BananaTape', 'apps/android/app/src'], null, null, 'Magic Layer editing is desktop-only'),
];

const fileChecks = [
  { category: 'evidence', name: 'task-20-evidence-directory', path: '.omo/evidence/mobile-native-port/task-20-openai-provider/README.md' },
  { category: 'evidence', name: 'task-21-evidence-directory', path: '.omo/evidence/mobile-native-port/task-21-image-export/README.md' },
  { category: 'evidence', name: 'task-22-evidence-directory', path: '.omo/evidence/mobile-native-port/task-22-offline-lifecycle/README.md' },
  { category: 'evidence', name: 'task-23-evidence-directory', path: '.omo/evidence/mobile-native-port/task-23-gallery-save-share/README.md' },
  { category: 'evidence', name: 'task-24-evidence-directory', path: '.omo/evidence/mobile-native-port/task-24-inbound-share/README.md' },
  { category: 'evidence', name: 'task-25-evidence-directory', path: '.omo/evidence/mobile-native-port/task-25-codex-feasibility/README.md' },
  { category: 'evidence', name: 'task-26-evidence-directory', path: '.omo/evidence/mobile-native-port/task-26-accessibility-visual/README.md' },
  { category: 'evidence', name: 'task-27-evidence-directory', path: '.omo/evidence/mobile-native-port/task-27-performance/README.md' },
  { category: 'evidence', name: 'codex-feasibility-report', path: '.omo/evidence/mobile-native-port/provider/codex-feasibility.md' },
  { category: 'docs', name: 'feature-parity-doc', path: 'docs/mobile/feature-parity.md' },
  { category: 'docs', name: 'providers-doc', path: 'docs/mobile/providers.md' },
  { category: 'docs', name: 'storage-gallery-doc', path: 'docs/mobile/storage-and-gallery.md' },
  { category: 'docs', name: 'performance-budget-doc', path: 'docs/mobile/performance-budget.md' },
];

function cmd(category, name, command, args, blocker = null, failOnStdoutPattern = null, requireStdoutPattern = null) {
  return { category, name, command, args, blocker, failOnStdoutPattern, requireStdoutPattern };
}

function nowIso() {
  return new Date().toISOString();
}

function durationMs(startedMs) {
  return Date.now() - startedMs;
}

function excerpt(text) {
  const trimmed = text.trim();
  if (trimmed.length <= 4000) {
    return trimmed;
  }
  return `${trimmed.slice(0, 2000)}\n...\n${trimmed.slice(-2000)}`;
}

function commandLine(check) {
  return [check.command, ...check.args].join(' ');
}

function blockerFor(check, exitCode, stdout, stderr) {
  const output = `${stdout}\n${stderr}`;
  if ((check.name === 'ios-build-for-testing' || check.name === 'ios-runtime-xctest') && exitCode === 0) {
    return null;
  }
  if (check.blocker === 'ios-coresimulator-mismatch' && CORE_SIMULATOR_PATTERN.test(output)) {
    return {
      type: 'environment',
      code: 'ios-coresimulator-mismatch',
      detail: 'Installed CoreSimulator is 1051.54.0 while Xcode expects 1051.55.0; iOS runtime simulator checks require administrator repair.',
    };
  }
  if (exitCode === 0) {
    return null;
  }
  if (check.blocker === 'android-connected-device-unavailable' && ANDROID_DEVICE_PATTERN.test(output)) {
    return {
      type: 'environment',
      code: 'android-connected-device-unavailable',
      detail: 'Android connected tests require a booted, online emulator or device such as Pixel_7_API_36.',
    };
  }
  if (COMMAND_MISSING_PATTERN.test(output)) {
    return {
      type: 'environment',
      code: 'command-unavailable',
      detail: `${check.command} was not available on PATH or could not be launched.`,
    };
  }
  return null;
}

function classifyCommand(check, exitCode, stdout, stderr) {
  const blocker = blockerFor(check, exitCode, stdout, stderr);
  if (blocker) {
    return { status: 'blocked', blocker };
  }
  if (exitCode !== 0) {
    return { status: 'fail', blocker: null };
  }
  if (check.failOnStdoutPattern && new RegExp(check.failOnStdoutPattern).test(stdout)) {
    return { status: 'fail', blocker: null };
  }
  if (check.requireStdoutPattern && !new RegExp(check.requireStdoutPattern).test(stdout)) {
    return { status: 'fail', blocker: null };
  }
  return { status: 'pass', blocker: null };
}

async function writeText(file, text) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text, 'utf8');
}

async function runCommand(check) {
  const startedAt = nowIso();
  const startedMs = Date.now();
  const stdoutPath = path.join(LOG_DIR, `${check.name}.stdout.log`);
  const stderrPath = path.join(LOG_DIR, `${check.name}.stderr.log`);

  return new Promise((resolve) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    const child = spawn(check.command, check.args, {
      cwd: REPO_ROOT,
      env: { ...process.env, CI: process.env.CI ?? '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
    child.on('error', async (error) => {
      const stderr = error instanceof Error ? error.message : String(error);
      await writeText(stdoutPath, '');
      await writeText(stderrPath, stderr);
      resolve(recordCommand(check, startedAt, startedMs, 127, '', stderr, stdoutPath, stderrPath));
    });
    child.on('close', async (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString();
      const stderr = Buffer.concat(stderrChunks).toString();
      await writeText(stdoutPath, stdout);
      await writeText(stderrPath, stderr);
      resolve(recordCommand(check, startedAt, startedMs, code ?? 1, stdout, stderr, stdoutPath, stderrPath));
    });
  });
}

function recordCommand(check, startedAt, startedMs, exitCode, stdout, stderr, stdoutPath, stderrPath) {
  const classification = classifyCommand(check, exitCode, stdout, stderr);
  return {
    kind: 'command',
    category: check.category,
    name: check.name,
    command: commandLine(check),
    status: classification.status,
    exitCode,
    durationMs: durationMs(startedMs),
    startedAt,
    blocker: classification.blocker,
    stdoutExcerpt: excerpt(stdout),
    stderrExcerpt: excerpt(stderr),
    evidenceLogPaths: {
      stdout: path.relative(REPO_ROOT, stdoutPath),
      stderr: path.relative(REPO_ROOT, stderrPath),
    },
  };
}

async function runFileCheck(check) {
  const startedAt = nowIso();
  const startedMs = Date.now();
  const absolutePath = path.join(REPO_ROOT, check.path);
  let exists = false;
  try {
    await fs.access(absolutePath);
    exists = true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      exists = false;
    } else {
      throw error;
    }
  }
  return {
    kind: 'file',
    category: check.category,
    name: check.name,
    command: `test -e ${check.path}`,
    status: exists ? 'pass' : 'fail',
    exitCode: exists ? 0 : 1,
    durationMs: durationMs(startedMs),
    startedAt,
    blocker: null,
    stdoutExcerpt: exists ? check.path : '',
    stderrExcerpt: exists ? '' : `Missing required evidence file: ${check.path}`,
    evidenceLogPaths: null,
  };
}

function summarize(results) {
  const failed = results.filter((result) => result.status === 'fail');
  const blocked = results.filter((result) => result.status === 'blocked');
  const passed = results.filter((result) => result.status === 'pass');
  return {
    generatedAt: nowIso(),
    status: failed.length === 0 && blocked.length === 0 ? 'pass' : failed.length === 0 ? 'blocked' : 'fail',
    counts: {
      pass: passed.length,
      fail: failed.length,
      blocked: blocked.length,
      total: results.length,
    },
    blockers: blocked.map((result) => ({ name: result.name, category: result.category, blocker: result.blocker })),
    failures: failed.map((result) => ({ name: result.name, category: result.category, exitCode: result.exitCode, command: result.command })),
    categories: ['web-cli', 'mobile-contracts', 'ios', 'android', 'evidence', 'docs'],
    checks: results,
  };
}

async function run() {
  await fs.mkdir(LOG_DIR, { recursive: true });

  const results = [];
  for (const check of fileChecks) {
    results.push(await runFileCheck(check));
  }
  for (const check of commandChecks) {
    const result = await runCommand(check);
    results.push(result);
    console.log(`${result.status.toUpperCase()} ${result.name} (${result.exitCode}) ${result.durationMs}ms`);
  }

  const summary = summarize(results);
  await writeText(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`Wrote ${path.relative(REPO_ROOT, SUMMARY_PATH)}`);
  process.exitCode = summary.status === 'pass' ? 0 : 1;
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

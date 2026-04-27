import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getRuntimeRegistryPath } from './paths';

export interface RunningProject {
  projectId: string;
  projectPath: string;
  port: number;
  pid: number;
  launchId: string;
  startedAt: string;
}

export interface RuntimeRegistry {
  schemaVersion: 1;
  running: RunningProject[];
}

export function emptyRuntimeRegistry(): RuntimeRegistry {
  return { schemaVersion: 1, running: [] };
}

export async function readRuntimeRegistry(env = process.env): Promise<RuntimeRegistry> {
  try {
    const parsed = JSON.parse(await readFile(getRuntimeRegistryPath(env), 'utf8')) as RuntimeRegistry;
    return parsed.schemaVersion === 1 && Array.isArray(parsed.running) ? parsed : emptyRuntimeRegistry();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyRuntimeRegistry();
    throw error;
  }
}

export async function writeRuntimeRegistry(registry: RuntimeRegistry, env = process.env): Promise<void> {
  const filePath = getRuntimeRegistryPath(env);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

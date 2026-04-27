import { readProjectManifest } from './metadata-store';

interface ActiveProjectContext {
  projectRoot: string;
  launchId: string;
}

export function getConfiguredProjectRoot(env = process.env): string | null {
  const value = env.BANANATAPE_ACTIVE_PROJECT_PATH?.trim();
  return value || null;
}

export function getLaunchId(env = process.env): string {
  return env.BANANATAPE_LAUNCH_ID?.trim() || 'dev';
}

export function hasActiveProject(env = process.env): boolean {
  return Boolean(getConfiguredProjectRoot(env));
}

export function requireProjectSession(env = process.env): ActiveProjectContext {
  const projectRoot = getConfiguredProjectRoot(env);
  if (!projectRoot) throw new Error('No active BananaTape project');
  return {
    projectRoot,
    launchId: getLaunchId(env),
  };
}

export async function getCurrentProjectSummary() {
  const projectRoot = getConfiguredProjectRoot();
  if (!projectRoot) return { persistence: 'none' as const };
  const session = requireProjectSession();
  const manifest = await readProjectManifest(session.projectRoot);
  return {
    persistence: 'project' as const,
    projectId: manifest.id,
    projectName: manifest.name,
    launchId: session.launchId,
  };
}

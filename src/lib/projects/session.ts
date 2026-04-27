import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';
import { readProjectManifest } from './metadata-store';

interface LaunchSession {
  sessionId: string;
  projectRoot: string;
  launchId: string;
  cookieName: string;
}

let launchSession: LaunchSession | null = null;
let consumedBootstrapTokens = new Set<string>();

export function getConfiguredProjectRoot(env = process.env): string | null {
  const value = env.BANANATAPE_ACTIVE_PROJECT_PATH?.trim();
  return value || null;
}

export function getLaunchId(env = process.env): string {
  return env.BANANATAPE_LAUNCH_ID?.trim() || 'dev';
}

export function getCookieName(env = process.env): string {
  return env.BANANATAPE_COOKIE_NAME?.trim() || `bt_session_${getLaunchId(env)}`;
}

export function getBootstrapToken(env = process.env): string | null {
  const value = env.BANANATAPE_BOOTSTRAP_TOKEN?.trim();
  return value || null;
}

export function hasActiveProject(env = process.env): boolean {
  return Boolean(getConfiguredProjectRoot(env));
}

export function exchangeBootstrapToken(token: string, env = process.env): LaunchSession {
  const expected = getBootstrapToken(env);
  const projectRoot = getConfiguredProjectRoot(env);
  if (!expected || !projectRoot || token !== expected || consumedBootstrapTokens.has(token)) {
    throw new Error('Invalid or expired bootstrap token');
  }
  consumedBootstrapTokens.add(token);
  launchSession = {
    sessionId: `sess_${nanoid(32)}`,
    projectRoot,
    launchId: getLaunchId(env),
    cookieName: getCookieName(env),
  };
  return launchSession;
}

export async function requireProjectSession(): Promise<LaunchSession> {
  const projectRoot = getConfiguredProjectRoot();
  if (!projectRoot) throw new Error('No active BananaTape project');

  if (!launchSession) {
    const token = getBootstrapToken();
    if (!token && process.env.NODE_ENV !== 'production') {
      launchSession = {
        sessionId: 'dev-session',
        projectRoot,
        launchId: getLaunchId(),
        cookieName: getCookieName(),
      };
    }
  }

  if (!launchSession) throw new Error('Project session is not initialized');
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(launchSession.cookieName)?.value;
  if (cookieValue !== launchSession.sessionId && process.env.NODE_ENV === 'production') {
    throw new Error('Unauthorized project session');
  }
  if (cookieValue && cookieValue !== launchSession.sessionId) throw new Error('Unauthorized project session');
  return launchSession;
}

export async function getCurrentProjectSummary() {
  const projectRoot = getConfiguredProjectRoot();
  if (!projectRoot) return { persistence: 'none' as const };
  const session = await requireProjectSession();
  const manifest = await readProjectManifest(session.projectRoot);
  return {
    persistence: 'project' as const,
    projectId: manifest.id,
    projectName: manifest.name,
    launchId: session.launchId,
  };
}

export function resetSessionForTests(): void {
  launchSession = null;
  consumedBootstrapTokens = new Set<string>();
}

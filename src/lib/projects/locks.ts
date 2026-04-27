const queues = new Map<string, Promise<unknown>>();

export async function withProjectLock<T>(projectRoot: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(projectRoot) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  queues.set(projectRoot, queued);

  await previous.catch(() => undefined);
  try {
    return await work();
  } finally {
    release();
    if (queues.get(projectRoot) === queued) queues.delete(projectRoot);
  }
}

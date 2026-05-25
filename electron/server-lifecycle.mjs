import http from 'node:http';
import net from 'node:net';

/**
 * Find a free TCP port on 127.0.0.1.
 * The OS assigns an ephemeral port by listening on port 0.
 * @returns {Promise<number>}
 */
export function findFreePort() {
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

/**
 * Poll a URL until it responds with HTTP 200.
 * Used to wait for the Next.js standalone server to become ready.
 * @param {string} url
 * @param {number} timeoutMs
 * @param {number} intervalMs
 * @returns {Promise<void>}
 */
export function waitForServer(url, timeoutMs = 15_000, intervalMs = 200) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function poll() {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server at ${url} did not respond within ${timeoutMs}ms`));
        return;
      }
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          resolve();
        } else {
          res.resume();
          setTimeout(poll, intervalMs);
        }
      });
      req.on('error', () => {
        setTimeout(poll, intervalMs);
      });
      req.setTimeout(intervalMs, () => {
        req.destroy();
        setTimeout(poll, intervalMs);
      });
    }
    poll();
  });
}

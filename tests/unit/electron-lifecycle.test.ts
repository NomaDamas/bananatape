import http from 'node:http';
import { describe, expect, it, afterEach } from 'vitest';

const { findFreePort, waitForServer } = await import('../../electron/server-lifecycle.mjs');

describe('electron server lifecycle utilities', () => {

  describe('findFreePort', () => {
    it('returns a positive integer port', async () => {
      const port: number = await findFreePort();
      expect(port).toBeGreaterThan(0);
      expect(Number.isInteger(port)).toBe(true);
    });

    it('returns different ports on consecutive calls', async () => {
      const a: number = await findFreePort();
      const b: number = await findFreePort();
      expect(a).not.toBe(b);
    });
  });

  describe('waitForServer', () => {
    let server: http.Server | null = null;

    afterEach(() => {
      if (server) {
        server.close();
        server = null;
      }
    });

    it('resolves when server responds 200', async () => {
      server = http.createServer((_req, res) => {
        res.writeHead(200);
        res.end('ok');
      });
      const port = await new Promise<number>((resolve, reject) => {
        server!.listen(0, '127.0.0.1', () => {
          const addr = server!.address();
          if (addr && typeof addr === 'object') resolve(addr.port);
          else reject(new Error('no address'));
        });
      });

      await expect(waitForServer(`http://127.0.0.1:${port}`, 3000)).resolves.toBeUndefined();
    });

    it('rejects after timeout when no server is listening', async () => {
      const port: number = await findFreePort();
      await expect(
        waitForServer(`http://127.0.0.1:${port}`, 500),
      ).rejects.toThrow('did not respond within 500ms');
    }, 5000);
  });
});

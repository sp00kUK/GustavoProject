import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function vectorMagicPlugin(): Plugin {
  return {
    name: 'vector-magic-bridge',
    configureServer(server) {
      server.middlewares.use('/api/open-vector-magic', async (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const { dataUrl } = JSON.parse(body);
              const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
              const buffer = Buffer.from(base64Data, 'base64');
              const tmpPath = join(tmpdir(), 'vectormagic_pattern.png');
              writeFileSync(tmpPath, buffer);

              const vmPath = 'C:\\Program Files (x86)\\Vector Magic\\vmde.exe';
              if (existsSync(vmPath)) {
                spawn(vmPath, [tmpPath], { detached: true, stdio: 'ignore' }).unref();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Vector Magic launched' }));
              } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(
                  JSON.stringify({
                    success: false,
                    error: 'Vector Magic executable not found at C:\\Program Files (x86)\\Vector Magic\\vmde.exe',
                  }),
                );
              }
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
        } else {
          res.writeHead(405);
          res.end();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), vectorMagicPlugin()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
  },
});


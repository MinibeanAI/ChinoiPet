import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const renderer = spawn('npm', ['run', 'dev:renderer'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' }
});

let electron;
let stopped = false;

async function waitForRenderer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:5173');
      if (response.ok) {
        return;
      }
    } catch {
      await delay(250);
    }
  }

  throw new Error('Vite dev server did not become ready on http://127.0.0.1:5173');
}

function stop() {
  if (stopped) return;
  stopped = true;
  electron?.kill('SIGTERM');
  renderer.kill('SIGTERM');
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', stop);

waitForRenderer()
  .then(() => {
    electron = spawn('npx', ['electron', '.'], {
      stdio: 'inherit',
      env: { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' }
    });
    electron.on('exit', () => stop());
  })
  .catch((error) => {
    console.error(error);
    stop();
    process.exitCode = 1;
  });


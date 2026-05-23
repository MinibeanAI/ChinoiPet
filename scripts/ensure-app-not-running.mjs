import { execFileSync } from 'node:child_process';
import path from 'node:path';

const appProcessPattern = '/国风桌宠.app/Contents/MacOS/国风桌宠';
const releaseRoot = path.resolve('release');

function runningPetProcesses() {
  try {
    const output = execFileSync('ps', ['aux'], { encoding: 'utf8' });
    return output
      .split('\n')
      .filter((line) => line.includes(appProcessPattern))
      .filter((line) => line.includes(releaseRoot))
      .filter((line) => !line.includes('ensure-app-not-running'));
  } catch {
    return [];
  }
}

const processes = runningPetProcesses();

if (processes.length > 0) {
  console.error('国风桌宠.app is currently running. Quit the app before packaging so app.asar is not overwritten while the renderer is still using old image URLs.');
  console.error('Running process:');
  console.error(processes.join('\n'));
  process.exitCode = 1;
}

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

const artifactPathInput = readArg('--path');
const profile = process.env.APPLE_NOTARYTOOL_PROFILE;

if (!artifactPathInput) {
  throw new Error('缺少 --path 参数。');
}

if (!profile) {
  throw new Error('缺少环境变量 APPLE_NOTARYTOOL_PROFILE。');
}

const artifactPath = path.resolve(process.cwd(), artifactPathInput);
if (!existsSync(artifactPath)) {
  throw new Error(`找不到文件：${artifactPath}`);
}

execFileSync('xcrun', ['notarytool', 'submit', artifactPath, '--keychain-profile', profile, '--wait'], {
  stdio: 'inherit'
});
execFileSync('xcrun', ['stapler', 'staple', artifactPath], { stdio: 'inherit' });


const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function resolveAppPath(context) {
  const appName = context.packager.appInfo.productFilename;
  return path.join(context.appOutDir, `${appName}.app`);
}

function clearXattr(appPath) {
  try {
    execFileSync('xattr', ['-cr', appPath], { stdio: 'ignore' });
  } catch {}
}

function adhocDeepSign(appPath) {
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
}

module.exports = async function afterPack(context) {
  if (process.platform !== 'darwin') return;
  if (!process.env.PET_ADHOC_DEEP_SIGN) return;

  const appPath = resolveAppPath(context);
  if (!fs.existsSync(appPath)) return;

  clearXattr(appPath);
  adhocDeepSign(appPath);
};


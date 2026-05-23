const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function resolveAppPath(context) {
  const appName = context.packager.appInfo.productFilename;
  return path.join(context.appOutDir, `${appName}.app`);
}

function runNotarytool(appPath, profile) {
  execFileSync(
    'xcrun',
    ['notarytool', 'submit', appPath, '--keychain-profile', profile, '--wait'],
    { stdio: 'inherit' }
  );
}

function staple(appPath) {
  execFileSync('xcrun', ['stapler', 'staple', appPath], { stdio: 'inherit' });
}

module.exports = async function notarize(context) {
  if (process.platform !== 'darwin') return;

  const profile = process.env.APPLE_NOTARYTOOL_PROFILE;
  if (!profile) return;

  const appPath = resolveAppPath(context);
  if (!fs.existsSync(appPath)) return;

  runNotarytool(appPath, profile);
  staple(appPath);
};


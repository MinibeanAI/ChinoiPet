const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function runNotarytool(artifactPath, profile) {
  execFileSync('xcrun', ['notarytool', 'submit', artifactPath, '--keychain-profile', profile, '--wait'], {
    stdio: 'inherit'
  });
}

function staple(artifactPath) {
  execFileSync('xcrun', ['stapler', 'staple', artifactPath], { stdio: 'inherit' });
}

function listArtifacts(context) {
  if (Array.isArray(context?.artifactPaths) && context.artifactPaths.length > 0) {
    return context.artifactPaths;
  }

  const outDir = context?.outDir ?? path.resolve('release');
  if (!fs.existsSync(outDir)) return [];

  const entries = fs.readdirSync(outDir).map((name) => path.join(outDir, name));
  return entries.filter((entry) => fs.statSync(entry).isFile());
}

module.exports = async function notarizeArtifacts(context) {
  if (process.platform !== 'darwin') return;

  const profile = process.env.APPLE_NOTARYTOOL_PROFILE;
  if (!profile) return;

  const artifacts = listArtifacts(context).filter((filePath) => /\.(dmg|zip|pkg)$/i.test(filePath));
  if (artifacts.length === 0) return;

  for (const artifactPath of artifacts) {
    runNotarytool(artifactPath, profile);
    staple(artifactPath);
  }
};


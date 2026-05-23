import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const writeChanges = process.argv.includes('--write');
const roots = [
  path.resolve('src/assets'),
  path.resolve('src/assets/sequences')
];
const backupRoot = path.resolve('asset-backups/white-edge-cleanup');

function isPngAsset(filePath) {
  return filePath.endsWith('.png');
}

async function listPngs(dir) {
  try {
    await fs.access(dir);
  } catch {
    return [];
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listPngs(entryPath));
    } else if (entry.isFile() && isPngAsset(entryPath)) {
      files.push(entryPath);
    }
  }

  return files;
}

function hasTransparentNeighbor(alpha, width, height, x, y) {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
      if (alpha[ny * width + nx] <= 24) return true;
    }
  }

  return false;
}

function isWhiteFringe(red, green, blue) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const neutralLight = max > 170 && max - min < 58;
  const warmWhite = red > 205 && green > 198 && blue > 188;
  return neutralLight || warmWhite;
}

async function cleanAsset(filePath) {
  const image = sharp(filePath).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  let changedPixels = 0;

  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = data[index * 4 + 3];
  }

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = y * info.width + x;
      const offset = index * 4;
      const currentAlpha = alpha[index];
      if (currentAlpha <= 24) continue;
      if (!hasTransparentNeighbor(alpha, info.width, info.height, x, y)) continue;

      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      if (!isWhiteFringe(red, green, blue)) continue;

      data[offset + 3] = 0;
      changedPixels += 1;
    }
  }

  if (writeChanges && changedPixels > 0) {
    const relativePath = path.relative(process.cwd(), filePath);
    const backupPath = path.join(backupRoot, relativePath);
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    try {
      await fs.copyFile(filePath, backupPath, fs.constants.COPYFILE_EXCL);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    })
      .png()
      .toFile(filePath);
  }

  return {
    filePath: path.relative(process.cwd(), filePath),
    changedPixels
  };
}

const allFiles = [];
for (const root of roots) {
  allFiles.push(...await listPngs(root));
}

const results = [];
for (const filePath of [...new Set(allFiles)].sort()) {
  results.push(await cleanAsset(filePath));
}

const changed = results.filter((result) => result.changedPixels > 0);
console.log(`${writeChanges ? 'Cleaned' : 'Scanned'} ${results.length} PNG assets.`);
console.log(`${changed.length} files have white fringe pixels.`);
for (const result of changed.slice(0, 80)) {
  console.log(`${result.filePath}: ${result.changedPixels}`);
}
if (changed.length > 80) {
  console.log(`... ${changed.length - 80} more files`);
}

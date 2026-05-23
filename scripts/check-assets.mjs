import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const sequenceRoot = path.resolve('src/assets/sequences');
const reportDir = path.resolve('reports');
const edgeScanPx = 2;

function isVisible(alpha) {
  return alpha > 16;
}

function isLightPixel(red, green, blue) {
  return red > 216 && green > 208 && blue > 198;
}

function hasTransparentNeighbor(alpha, width, height, x, y) {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
      if (alpha[ny * width + nx] <= 16) return true;
    }
  }

  return false;
}

async function inspectAsset(filePath) {
  const image = sharp(filePath).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);

  let visiblePixels = 0;
  let boundaryVisiblePixels = 0;
  let lightEdgePixels = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = y * info.width + x;
      const offset = index * 4;
      alpha[index] = data[offset + 3];
    }
  }

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const index = y * info.width + x;
      const offset = index * 4;
      const a = alpha[index];
      if (!isVisible(a)) continue;

      visiblePixels += 1;

      const nearCanvasEdge =
        x < edgeScanPx ||
        y < edgeScanPx ||
        x >= info.width - edgeScanPx ||
        y >= info.height - edgeScanPx;

      if (nearCanvasEdge) {
        boundaryVisiblePixels += 1;
      }

      if (
        hasTransparentNeighbor(alpha, info.width, info.height, x, y) &&
        isLightPixel(data[offset], data[offset + 1], data[offset + 2])
      ) {
        lightEdgePixels += 1;
      }
    }
  }

  const lightEdgeRatio = visiblePixels ? lightEdgePixels / visiblePixels : 0;
  const boundaryRatio = visiblePixels ? boundaryVisiblePixels / visiblePixels : 0;
  const warnings = [];

  if (lightEdgePixels > 80 && lightEdgeRatio > 0.0008) {
    warnings.push('possible_light_or_white_edge');
  }

  if (boundaryVisiblePixels > 12 && boundaryRatio > 0.0002) {
    warnings.push('visible_pixels_touch_canvas_edge');
  }

  return {
    fileName: path.relative(process.cwd(), filePath),
    width: info.width,
    height: info.height,
    visiblePixels,
    lightEdgePixels,
    lightEdgeRatio: Number(lightEdgeRatio.toFixed(5)),
    boundaryVisiblePixels,
    boundaryRatio: Number(boundaryRatio.toFixed(5)),
    warnings
  };
}

async function main() {
  const files = fs
    .readdirSync(sequenceRoot, { recursive: true })
    .filter((fileName) => /^.+\/frame-\d+\.png$/.test(fileName))
    .map((fileName) => path.join(sequenceRoot, fileName))
    .sort();

  const assets = [];
  for (const filePath of files) {
    assets.push(await inspectAsset(filePath));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    rules: {
      possible_light_or_white_edge: 'Visible light pixels adjacent to transparency; inspect hair/face/hand edges manually.',
      visible_pixels_touch_canvas_edge: 'Visible pixels touch the image canvas edge; source artwork may be clipped.'
    },
    assets
  };

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'asset-qa.json'), `${JSON.stringify(report, null, 2)}\n`);

  const warnings = assets.filter((asset) => asset.warnings.length > 0);
  console.log(`Checked ${assets.length} sequence frame assets.`);
  if (warnings.length === 0) {
    console.log('No asset warnings.');
    return;
  }

  for (const asset of warnings) {
    console.log(`${asset.fileName}: ${asset.warnings.join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

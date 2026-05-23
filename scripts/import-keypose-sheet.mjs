import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const validStatuses = new Set(['placeholder', 'keyframe-review', 'approved', 'final']);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    status: 'keyframe-review',
    loop: false,
    chromaKey: '#00ff00',
    label: null,
    motion: null,
    outputRoot: 'src/assets/sequences',
    omit: new Set(),
    padding: 18,
    mode: 'components',
    threshold: 70,
    softThreshold: 150
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    switch (arg) {
      case '--input':
        options.input = next;
        index += 1;
        break;
      case '--id':
        options.id = next;
        index += 1;
        break;
      case '--frames':
        options.frames = Number(next);
        index += 1;
        break;
      case '--fps':
        options.fps = Number(next);
        index += 1;
        break;
      case '--canvas':
        options.canvas = parseCanvas(next);
        index += 1;
        break;
      case '--pose-max':
        options.poseMax = parseCanvas(next);
        index += 1;
        break;
      case '--status':
        options.status = next;
        index += 1;
        break;
      case '--loop':
        options.loop = true;
        break;
      case '--chroma-key':
        options.chromaKey = next;
        index += 1;
        break;
      case '--label':
        options.label = next;
        index += 1;
        break;
      case '--motion':
        options.motion = next;
        index += 1;
        break;
      case '--omit':
        options.omit = parseOmit(next);
        index += 1;
        break;
      case '--padding':
        options.padding = Number(next);
        index += 1;
        break;
      case '--mode':
        options.mode = next;
        index += 1;
        break;
      case '--threshold':
        options.threshold = Number(next);
        index += 1;
        break;
      case '--soft-threshold':
        options.softThreshold = Number(next);
        index += 1;
        break;
      case '--output-root':
        options.outputRoot = next;
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.input) throw new Error('Missing --input <sheet.png>');
  if (!options.id) throw new Error('Missing --id <animation-id>');
  if (!Number.isInteger(options.frames) || options.frames <= 0) throw new Error('Invalid --frames');
  if (!Number.isFinite(options.fps) || options.fps <= 0) throw new Error('Invalid --fps');
  if (!options.canvas) throw new Error('Missing --canvas <width>x<height>');
  if (!validStatuses.has(options.status)) throw new Error(`Invalid --status ${options.status}`);
  if (!['components', 'cells'].includes(options.mode)) throw new Error(`Invalid --mode ${options.mode}`);
  if (!Number.isFinite(options.padding) || options.padding < 0) throw new Error('Invalid --padding');
  if (!Number.isFinite(options.threshold) || options.threshold < 0) throw new Error('Invalid --threshold');
  if (!Number.isFinite(options.softThreshold) || options.softThreshold <= options.threshold) {
    throw new Error('Invalid --soft-threshold');
  }

  return options;
}

function parseCanvas(value) {
  const match = value?.match(/^(\d+)x(\d+)$/);
  if (!match) throw new Error(`Invalid canvas: ${value}`);
  return {
    width: Number(match[1]),
    height: Number(match[2])
  };
}

function parseOmit(value) {
  if (!value) return new Set();
  return new Set(
    value
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((part) => Number.isInteger(part) && part >= 0)
  );
}

function parseHexColor(value) {
  const match = value?.match(/^#?([0-9a-f]{6})$/i);
  if (!match) throw new Error(`Invalid chroma key: ${value}`);
  const hex = match[1];
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  };
}

function colorDistance(left, right) {
  return Math.sqrt(
    (left.r - right.r) ** 2 +
    (left.g - right.g) ** 2 +
    (left.b - right.b) ** 2
  );
}

function alphaFor(pixel, keyColor, options) {
  const distance = colorDistance(pixel, keyColor);
  if (distance < options.threshold) return 0;
  if (distance < options.softThreshold) {
    return Math.round(((distance - options.threshold) / (options.softThreshold - options.threshold)) * 255);
  }
  return 255;
}

function despillPixel(data, index, alpha) {
  if (alpha <= 0) return;

  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const safeGreen = Math.max(red, blue, Math.round((red + blue) / 2));

  if (green > safeGreen) {
    data[index + 1] = Math.max(0, Math.min(green, safeGreen));
  }
}

function findComponents(alpha, info) {
  const visited = new Uint8Array(alpha.length);
  const queue = new Int32Array(alpha.length);
  const components = [];
  const directions = [
    -1,
    1,
    -info.width,
    info.width,
    -info.width - 1,
    -info.width + 1,
    info.width - 1,
    info.width + 1
  ];

  for (let start = 0; start < alpha.length; start += 1) {
    if (visited[start] || alpha[start] <= 20) continue;

    let head = 0;
    let tail = 0;
    queue[tail] = start;
    tail += 1;
    visited[start] = 1;

    let minX = info.width;
    let minY = info.height;
    let maxX = 0;
    let maxY = 0;
    const pixels = [];

    while (head < tail) {
      const pixelIndex = queue[head];
      head += 1;
      pixels.push(pixelIndex);

      const y = Math.floor(pixelIndex / info.width);
      const x = pixelIndex - y * info.width;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      for (const direction of directions) {
        const next = pixelIndex + direction;
        if (next < 0 || next >= alpha.length || visited[next] || alpha[next] <= 20) continue;

        const nextY = Math.floor(next / info.width);
        const nextX = next - nextY * info.width;
        if (Math.abs(nextX - x) > 1 || Math.abs(nextY - y) > 1) continue;

        visited[next] = 1;
        queue[tail] = next;
        tail += 1;
      }
    }

    if (pixels.length > 900) {
      components.push({
        minX,
        minY,
        maxX,
        maxY,
        pixels,
        cx: (minX + maxX) / 2
      });
    }
  }

  return components;
}

function cleanToComponent(source, component) {
  const clean = Buffer.from(source);
  const keep = new Uint8Array(source.length / 4);

  for (const pixelIndex of component.pixels) {
    keep[pixelIndex] = 1;
  }

  for (let pixelIndex = 0; pixelIndex < keep.length; pixelIndex += 1) {
    if (keep[pixelIndex]) continue;
    clean[pixelIndex * 4 + 3] = 0;
  }

  return clean;
}

async function writeFrame({ rgba, info, component, outputPath, canvas, padding, poseMax }) {
  const clean = cleanToComponent(rgba, component);
  const left = Math.max(0, component.minX - padding);
  const top = Math.max(0, component.minY - padding);
  const right = Math.min(info.width - 1, component.maxX + padding);
  const bottom = Math.min(info.height - 1, component.maxY + padding);

  let extracted = await sharp(clean, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
    .extract({
      left,
      top,
      width: right - left + 1,
      height: bottom - top + 1
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  if (poseMax) {
    extracted = await sharp(extracted.data)
      .resize({ width: poseMax.width, height: poseMax.height, fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer({ resolveWithObject: true });
  }

  const frameLeft = Math.round((canvas.width - extracted.info.width) / 2);
  const frameTop = Math.max(0, canvas.height - extracted.info.height);

  if (frameLeft < 0 || extracted.info.height > canvas.height) {
    throw new Error(`Canvas ${canvas.width}x${canvas.height} is too small for extracted frame ${extracted.info.width}x${extracted.info.height}`);
  }

  await sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: extracted.data, left: frameLeft, top: frameTop }])
    .png()
    .toFile(outputPath);
}

async function writeCellFrame({ rgba, info, cell, outputPath, canvas, padding, poseMax }) {
  const visible = visibleBoundsInCell(rgba, info, cell, padding);
  if (!visible) {
    throw new Error(`No visible pixels in cell ${cell.left}-${cell.right}`);
  }

  let extracted = await sharp(rgba, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  })
    .extract(visible)
    .png()
    .toBuffer({ resolveWithObject: true });

  if (poseMax) {
    extracted = await sharp(extracted.data)
      .resize({ width: poseMax.width, height: poseMax.height, fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer({ resolveWithObject: true });
  }

  const frameLeft = Math.round((canvas.width - extracted.info.width) / 2);
  const frameTop = Math.max(0, canvas.height - extracted.info.height);

  if (frameLeft < 0 || extracted.info.height > canvas.height) {
    throw new Error(`Canvas ${canvas.width}x${canvas.height} is too small for extracted cell frame ${extracted.info.width}x${extracted.info.height}`);
  }

  await sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: extracted.data, left: frameLeft, top: frameTop }])
    .png()
    .toFile(outputPath);
}

function visibleBoundsInCell(rgba, info, cell, padding) {
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  let visible = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = cell.left; x < cell.right; x += 1) {
      const alpha = rgba[(y * info.width + x) * 4 + 3];
      if (alpha <= 10) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      visible += 1;
    }
  }

  if (!visible) return null;

  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(info.width - 1, maxX + padding);
  const bottom = Math.min(info.height - 1, maxY + padding);

  return {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1
  };
}

function removeExistingFrames(outputDir) {
  if (!fs.existsSync(outputDir)) return;

  for (const fileName of fs.readdirSync(outputDir)) {
    if (/^frame-\d+\.png$/.test(fileName) || fileName === 'manifest.json') {
      fs.unlinkSync(path.join(outputDir, fileName));
    }
  }
}

async function main() {
  const options = parseArgs();
  const inputPath = path.resolve(options.input);
  const outputDir = path.resolve(options.outputRoot, options.id);
  const keyColor = parseHexColor(options.chromaKey);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input does not exist: ${inputPath}`);
  }

  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.from(data);
  const alpha = new Uint8Array(info.width * info.height);

  for (let pixelIndex = 0; pixelIndex < alpha.length; pixelIndex += 1) {
    const dataIndex = pixelIndex * 4;
    const pixel = {
      r: rgba[dataIndex],
      g: rgba[dataIndex + 1],
      b: rgba[dataIndex + 2]
    };
    const nextAlpha = alphaFor(pixel, keyColor, options);
    alpha[pixelIndex] = nextAlpha;
    rgba[dataIndex + 3] = Math.min(rgba[dataIndex + 3], nextAlpha);
    despillPixel(rgba, dataIndex, nextAlpha);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  removeExistingFrames(outputDir);

  let frameCount = 0;

  if (options.mode === 'components') {
    const components = findComponents(alpha, info)
      .sort((left, right) => right.pixels.length - left.pixels.length)
      .slice(0, options.frames)
      .sort((left, right) => left.cx - right.cx);

    if (components.length !== options.frames) {
      throw new Error(`Expected ${options.frames} pose components, found ${components.length}`);
    }

    const selectedComponents = components.filter((_, index) => !options.omit.has(index));

    for (let frameIndex = 0; frameIndex < selectedComponents.length; frameIndex += 1) {
      await writeFrame({
        rgba,
        info,
        component: selectedComponents[frameIndex],
        outputPath: path.join(outputDir, `frame-${String(frameIndex).padStart(3, '0')}.png`),
        canvas: options.canvas,
        padding: options.padding,
        poseMax: options.poseMax
      });
    }

    frameCount = selectedComponents.length;
  } else {
    const cells = Array.from({ length: options.frames }, (_, index) => ({
      left: Math.round((index * info.width) / options.frames),
      right: Math.round(((index + 1) * info.width) / options.frames)
    })).filter((_, index) => !options.omit.has(index));

    for (let frameIndex = 0; frameIndex < cells.length; frameIndex += 1) {
      await writeCellFrame({
        rgba,
        info,
        cell: cells[frameIndex],
        outputPath: path.join(outputDir, `frame-${String(frameIndex).padStart(3, '0')}.png`),
        canvas: options.canvas,
        padding: options.padding,
        poseMax: options.poseMax
      });
    }

    frameCount = cells.length;
  }

  const manifest = {
    id: options.id,
    status: options.status,
    fps: options.fps,
    loop: options.loop,
    frameCount,
    label: options.label ?? options.id,
    importedAt: new Date().toISOString(),
    ...(options.motion ? { motion: options.motion } : {})
  };

  fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${outputDir} (${frameCount} aligned key poses, mode=${options.mode})`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

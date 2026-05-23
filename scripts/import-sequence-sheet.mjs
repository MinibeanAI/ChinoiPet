import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const validStatuses = new Set(['placeholder', 'keyframe-review', 'approved', 'final']);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    status: 'keyframe-review',
    loop: false,
    chromaKey: null,
    label: null,
    motion: null,
    outputRoot: 'src/assets/sequences'
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
  if (!validStatuses.has(options.status)) throw new Error(`Invalid --status ${options.status}`);

  return options;
}

function parseHexColor(value) {
  if (!value) return null;
  const match = value.match(/^#?([0-9a-f]{6})$/i);
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

async function removeChromaKey(buffer, keyColor) {
  if (!keyColor) return buffer;

  const image = sharp(buffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  for (let index = 0; index < data.length; index += 4) {
    const pixel = { r: data[index], g: data[index + 1], b: data[index + 2] };
    const distance = colorDistance(pixel, keyColor);

    if (distance < 26) {
      data[index + 3] = 0;
    } else if (distance < 54) {
      const alpha = Math.round(((distance - 26) / 28) * 255);
      data[index + 3] = Math.min(data[index + 3], alpha);
    }
  }

  return sharp(Buffer.from(data), {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  }).png().toBuffer();
}

async function trimTransparent(buffer) {
  const image = sharp(buffer).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  let visible = 0;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha <= 10) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      visible += 1;
    }
  }

  if (!visible) return buffer;

  const padding = 18;
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(info.width - 1, maxX + padding);
  const bottom = Math.min(info.height - 1, maxY + padding);

  return image
    .extract({
      left,
      top,
      width: right - left + 1,
      height: bottom - top + 1
    })
    .png()
    .toBuffer();
}

async function main() {
  const options = parseArgs();
  const inputPath = path.resolve(options.input);
  const outputDir = path.resolve(options.outputRoot, options.id);
  const keyColor = parseHexColor(options.chromaKey);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input does not exist: ${inputPath}`);
  }

  const metadata = await sharp(inputPath).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) throw new Error('Input image has invalid dimensions');
  if (width % options.frames !== 0) {
    throw new Error(`Input width ${width} is not divisible by frame count ${options.frames}`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const cellWidth = width / options.frames;

  for (let frameIndex = 0; frameIndex < options.frames; frameIndex += 1) {
    const extracted = await sharp(inputPath)
      .extract({
        left: frameIndex * cellWidth,
        top: 0,
        width: cellWidth,
        height
      })
      .ensureAlpha()
      .png()
      .toBuffer();

    const keyed = await removeChromaKey(extracted, keyColor);
    const trimmed = await trimTransparent(keyed);
    await sharp(trimmed).png().toFile(path.join(outputDir, `frame-${String(frameIndex).padStart(3, '0')}.png`));
  }

  const manifest = {
    id: options.id,
    status: options.status,
    fps: options.fps,
    loop: options.loop,
    frameCount: options.frames,
    label: options.label ?? options.id,
    importedAt: new Date().toISOString(),
    ...(options.motion ? { motion: options.motion } : {})
  };

  fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(outputDir);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

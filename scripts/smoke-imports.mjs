import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const tmpRoot = '/private/tmp/guofeng-pet-import-smoke';
const sheetPath = path.join(tmpRoot, 'sheet.png');
const videoPath = path.join(tmpRoot, 'source.mov');
const outputRoot = path.join(tmpRoot, 'out');

function run(command, args) {
  execFileSync(command, args, {
    cwd: process.cwd(),
    stdio: 'ignore'
  });
}

async function createSheet() {
  const frameWidth = 180;
  const frameHeight = 220;
  const frames = 4;
  const composites = [];

  for (let index = 0; index < frames; index += 1) {
    const x = index * frameWidth;
    const bodyWidth = 46 + index * 8;
    const bodyHeight = 96 + index * 12;

    composites.push({
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${frameWidth}" height="${frameHeight}">` +
          '<rect width="100%" height="100%" fill="#00ff00"/>' +
          `<rect x="${Math.round((frameWidth - bodyWidth) / 2)}" y="${frameHeight - bodyHeight - 32}" width="${bodyWidth}" height="${bodyHeight}" rx="16" fill="#bd1f2d"/>` +
          `<circle cx="${Math.round(frameWidth / 2)}" cy="${frameHeight - bodyHeight - 50}" r="24" fill="#2a1816"/>` +
        '</svg>'
      ),
      left: x,
      top: 0
    });
  }

  await sharp({
    create: {
      width: frameWidth * frames,
      height: frameHeight,
      channels: 4,
      background: '#00ff00'
    }
  })
    .composite(composites)
    .png()
    .toFile(sheetPath);
}

async function createVideo() {
  const videoFrameDir = path.join(tmpRoot, 'video-frames');
  fs.mkdirSync(videoFrameDir, { recursive: true });

  for (let index = 0; index < 12; index += 1) {
    const bodyX = 110 + index * 4;
    await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 4,
        background: '#00ff00'
      }
    })
      .composite([{
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">` +
            `<rect x="${bodyX}" y="70" width="76" height="112" fill="#d11d2f"/>` +
          '</svg>'
        ),
        left: 0,
        top: 0
      }])
      .png()
      .toFile(path.join(videoFrameDir, `frame-${String(index).padStart(3, '0')}.png`));
  }

  run('ffmpeg', [
    '-y',
    '-framerate',
    '12',
    '-i',
    path.join(videoFrameDir, 'frame-%03d.png'),
    '-c:v',
    'qtrle',
    '-pix_fmt',
    'argb',
    videoPath
  ]);
}

function readManifest(id) {
  return JSON.parse(fs.readFileSync(path.join(outputRoot, id, 'manifest.json'), 'utf8'));
}

async function inspectFrame(id) {
  const framePath = path.join(outputRoot, id, 'frame-000.png');
  const { data, info } = await sharp(framePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let visible = 0;
  let transparent = 0;

  for (let index = 3; index < data.length; index += 4) {
    if (data[index] > 16) {
      visible += 1;
    } else {
      transparent += 1;
    }
  }

  return {
    width: info.width,
    height: info.height,
    visible,
    transparent
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
  fs.mkdirSync(outputRoot, { recursive: true });

  await createSheet();
  await createVideo();

  run('node', [
    'scripts/import-sequence-sheet.mjs',
    '--input',
    sheetPath,
    '--id',
    'sheet_smoke',
    '--frames',
    '4',
    '--fps',
    '12',
    '--chroma-key',
    '#00ff00',
    '--output-root',
    outputRoot,
    '--motion',
    'idle'
  ]);

  run('node', [
    'scripts/import-sequence-video.mjs',
    '--input',
    videoPath,
    '--id',
    'video_smoke',
    '--fps',
    '12',
    '--chroma-key',
    '#00ff00',
    '--output-root',
    outputRoot,
    '--motion',
    'idle'
  ]);

  const sheetManifest = readManifest('sheet_smoke');
  const videoManifest = readManifest('video_smoke');
  const sheetFrame = await inspectFrame('sheet_smoke');
  const videoFrame = await inspectFrame('video_smoke');

  assert(sheetManifest.frameCount === 4, 'Sheet import frame count mismatch');
  assert(videoManifest.frameCount === 12, 'Video import frame count mismatch');
  assert(sheetFrame.visible > 0 && sheetFrame.transparent > 0, 'Sheet frame alpha check failed');
  assert(videoFrame.visible > 0 && videoFrame.transparent > 0, 'Video frame alpha check failed');

  console.log('Import smoke test passed.');
  console.log(JSON.stringify({
    sheet: { manifest: sheetManifest.frameCount, frame: sheetFrame },
    video: { manifest: videoManifest.frameCount, frame: videoFrame }
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

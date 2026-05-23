import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const sequenceRoot = path.resolve('src/assets/sequences');
const lottieRoot = path.resolve('src/assets/lottie');

const lottieTargets = [
  'idle_breathe_wind',
  'pet_tap_smile',
  'wave_come_here',
  'listen_to_crowd',
  'drink_reminder',
  'rest_reminder',
  'calendar_gentle_prompt',
  'calendar_urgent_prompt'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function frameFiles(animationId) {
  const dir = path.join(sequenceRoot, animationId);
  return fs
    .readdirSync(dir)
    .filter((fileName) => /^frame-\d+\.png$/.test(fileName))
    .sort()
    .map((fileName) => path.join(dir, fileName));
}

async function imageAsset(filePath, index) {
  const metadata = await sharp(filePath).metadata();
  const bytes = fs.readFileSync(filePath);

  return {
    id: `frame_${String(index).padStart(3, '0')}`,
    w: metadata.width ?? 720,
    h: metadata.height ?? 720,
    u: '',
    p: `data:image/png;base64,${bytes.toString('base64')}`,
    e: 1
  };
}

function imageLayer(asset, index, frameCount) {
  return {
    ddd: 0,
    ind: index + 1,
    ty: 2,
    nm: asset.id,
    refId: asset.id,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [asset.w / 2, asset.h / 2, 0] },
      a: { a: 0, k: [asset.w / 2, asset.h / 2, 0] },
      s: { a: 0, k: [100, 100, 100] }
    },
    ao: 0,
    ip: index,
    op: index === frameCount - 1 ? frameCount : index + 1,
    st: 0,
    bm: 0
  };
}

async function buildLottie(animationId) {
  const manifestPath = path.join(sequenceRoot, animationId, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing sequence manifest for ${animationId}`);
  }

  const manifest = readJson(manifestPath);
  const frames = frameFiles(animationId);
  if (manifest.frameCount !== frames.length) {
    throw new Error(`${animationId} frame count mismatch: manifest=${manifest.frameCount}, files=${frames.length}`);
  }

  const assets = [];
  for (const [index, filePath] of frames.entries()) {
    assets.push(await imageAsset(filePath, index));
  }

  const firstAsset = assets[0];
  const frameCount = assets.length;

  return {
    v: '5.12.2',
    fr: manifest.fps,
    ip: 0,
    op: frameCount,
    w: firstAsset.w,
    h: firstAsset.h,
    nm: animationId,
    ddd: 0,
    assets,
    layers: assets.map((asset, index) => imageLayer(asset, index, frameCount)),
    markers: [
      {
        tm: 0,
        cm: `generated from PNG sequence ${animationId}`,
        dr: frameCount
      }
    ],
    meta: {
      g: 'scripts/generate-lottie-from-sequences.mjs',
      a: animationId,
      k: 'raster-sequence-lottie',
      d: 'Generated bridge Lottie. Replace with vector-layer Lottie when final art is redrawn.'
    }
  };
}

async function main() {
  fs.mkdirSync(lottieRoot, { recursive: true });

  for (const animationId of lottieTargets) {
    const lottie = await buildLottie(animationId);
    const outPath = path.join(lottieRoot, `${animationId}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(lottie)}\n`);
    console.log(`${outPath} (${lottie.layers.length} frames @ ${lottie.fr}fps)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

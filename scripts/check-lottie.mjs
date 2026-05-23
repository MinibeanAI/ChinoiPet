import fs from 'node:fs';
import path from 'node:path';

const sequenceRoot = path.resolve('src/assets/sequences');
const lottieRoot = path.resolve('src/assets/lottie');

const requiredLottie = [
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

function frameCountFor(animationId) {
  const dir = path.join(sequenceRoot, animationId);
  return fs.readdirSync(dir).filter((fileName) => /^frame-\d+\.png$/.test(fileName)).length;
}

function inspectLottie(animationId) {
  const lottiePath = path.join(lottieRoot, `${animationId}.json`);
  const manifestPath = path.join(sequenceRoot, animationId, 'manifest.json');
  const warnings = [];

  if (!fs.existsSync(lottiePath)) {
    return { id: animationId, warnings: ['missing_lottie_json'] };
  }

  if (!fs.existsSync(manifestPath)) {
    return { id: animationId, warnings: ['missing_sequence_manifest'] };
  }

  const lottie = readJson(lottiePath);
  const manifest = readJson(manifestPath);
  const expectedFrames = frameCountFor(animationId);

  if (lottie.nm !== animationId) warnings.push('name_mismatch');
  if (lottie.fr !== manifest.fps) warnings.push('fps_mismatch');
  if (lottie.op !== expectedFrames) warnings.push('duration_frame_mismatch');
  if (!Array.isArray(lottie.assets) || lottie.assets.length !== expectedFrames) warnings.push('asset_count_mismatch');
  if (!Array.isArray(lottie.layers) || lottie.layers.length !== expectedFrames) warnings.push('layer_count_mismatch');
  if (lottie.meta?.k !== 'raster-sequence-lottie') warnings.push('unexpected_lottie_kind');

  return {
    id: animationId,
    fps: lottie.fr,
    frameCount: Array.isArray(lottie.layers) ? lottie.layers.length : 0,
    warnings
  };
}

const results = requiredLottie.map(inspectLottie);
for (const result of results) {
  const suffix = result.warnings.length
    ? `: ${result.warnings.join(', ')}`
    : `: ok (${result.frameCount}f @ ${result.fps}fps)`;
  console.log(`${result.id}${suffix}`);
}

if (results.some((result) => result.warnings.length > 0)) {
  process.exitCode = 1;
}

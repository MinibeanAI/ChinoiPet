import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const sequenceRoot = path.resolve('src/assets/sequences');
const frameRoot = path.resolve('previews/runtime-gif-frames');
const previewDir = path.resolve('previews');
const canvas = { width: 480, height: 340 };
const dockHeight = 34;
const maxCharacter = { width: 430, height: 236 };

const previewSpecs = {
  idle_breathe_wind: 'idle-breathe-wind.gif',
  pet_tap_smile: 'pet-tap-smile.gif',
  clingy_pout: 'clingy-pout.gif',
  blow_kiss: 'blow-kiss.gif',
  wave_come_here: 'pose-wave.gif',
  listen_to_crowd: 'pose-listen.gif',
  drink_reminder: 'drink-reminder.gif',
  rest_reminder: 'rest-reminder.gif',
  calendar_gentle_prompt: 'calendar-gentle-prompt.gif',
  calendar_urgent_prompt: 'calendar-urgent-prompt.gif',
  sleeve_sweep_loop: 'pose-sleeve-sweep.gif',
  robe_sweep_intro: 'robe-sweep-intro.gif',
  skirt_release_spin: 'pose-skirt-release.gif',
  single_leg_knee_slide_backbend: 'pose-knee-slide-backbend.gif',
  robe_remove_stage: 'pose-robe-remove.gif'
};

function checker(width, height) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    '<rect width="100%" height="100%" fill="#eeeeee"/>'
  ];

  for (let y = 0; y < height; y += 16) {
    for (let x = 0; x < width; x += 16) {
      if ((x / 16 + y / 16) % 2 === 0) {
        parts.push(`<rect x="${x}" y="${y}" width="16" height="16" fill="#d2d2d2"/>`);
      }
    }
  }

  parts.push('</svg>');
  return Buffer.from(parts.join(''));
}

function labelSvg(text, width, height) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      '<rect width="100%" height="100%" fill="rgba(30,24,23,0.84)"/>' +
      `<text x="50%" y="22" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="15" fill="#fff">${text}</text>` +
    '</svg>'
  );
}

function readManifest(animationId) {
  const manifestPath = path.join(sequenceRoot, animationId, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function sequenceFrames(animationId, manifest) {
  const dir = path.join(sequenceRoot, animationId);
  if (!fs.existsSync(dir)) return [];
  const labelPrefix = manifest?.needsChoreographyRedo
    ? '待重做'
    : (manifest?.label ?? animationId);

  return fs
    .readdirSync(dir)
    .filter((fileName) => /^frame-\d+\.png$/.test(fileName))
    .sort()
    .map((fileName, index) => ({
      source: path.join(dir, fileName),
      label: `${labelPrefix} ${index + 1}`
    }));
}

function clearRenderedPreviewFrames(animationId) {
  const dir = path.join(frameRoot, animationId);
  if (!fs.existsSync(dir)) return;

  for (const fileName of fs.readdirSync(dir)) {
    if (/^frame-\d+\.png$/.test(fileName)) {
      fs.unlinkSync(path.join(dir, fileName));
    }
  }
}

async function renderPreviewFrame(animationId, frameIndex, source, label) {
  const dir = path.join(frameRoot, animationId);
  fs.mkdirSync(dir, { recursive: true });

  const image = await sharp(source)
    .resize({ height: maxCharacter.height, width: maxCharacter.width, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });

  const left = Math.round((canvas.width - image.info.width) / 2);
  const top = canvas.height - dockHeight - image.info.height;

  await sharp(checker(canvas.width, canvas.height))
    .composite([
      { input: image.data, left, top },
      { input: labelSvg(label, canvas.width, 30), left: 0, top: canvas.height - 30 }
    ])
    .png()
    .toFile(path.join(dir, `frame-${String(frameIndex).padStart(3, '0')}.png`));
}

async function renderPreview(animationId, output) {
  const manifest = readManifest(animationId);
  const frames = sequenceFrames(animationId, manifest);
  const usingSequence = Boolean(manifest && frames.length > 0 && manifest.frameCount === frames.length);
  if (!usingSequence) {
    throw new Error(`Missing complete sequence for ${animationId}; preview fallback assets have been removed.`);
  }

  clearRenderedPreviewFrames(animationId);

  await Promise.all(
    frames.map((frame, frameIndex) => renderPreviewFrame(animationId, frameIndex, frame.source, frame.label))
  );

  execFileSync('ffmpeg', [
    '-y',
    '-framerate',
    String(manifest.fps),
    '-i',
    path.join(frameRoot, animationId, 'frame-%03d.png'),
    '-vf',
    `fps=${Math.max(6, Math.min(12, manifest.fps))}`,
    path.join(previewDir, output)
  ], { stdio: 'ignore' });

  return path.join(previewDir, output);
}

async function main() {
  fs.mkdirSync(previewDir, { recursive: true });
  fs.mkdirSync(frameRoot, { recursive: true });

  for (const [animationId, output] of Object.entries(previewSpecs)) {
    const previewPath = await renderPreview(animationId, output);
    console.log(`${previewPath} (sequence)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

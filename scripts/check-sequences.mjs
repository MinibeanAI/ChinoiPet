import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const sequenceRoot = path.resolve('src/assets/sequences');
const reportDir = path.resolve('reports');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function imageInfo(filePath) {
  const image = sharp(filePath).ensureAlpha();
  const meta = await image.metadata();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  let visible = 0;
  let greenFringe = 0;
  let robeRed = 0;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const alpha = data[index + 3];
    if (alpha <= 20) continue;

    visible += 1;
    if (green > red + 38 && green > blue + 38) {
      greenFringe += 1;
    }
    if (isLikelyOuterRobeRed(red, green, blue)) {
      robeRed += 1;
    }
  }

  return {
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    hasAlpha: Boolean(meta.hasAlpha),
    greenFringeRatio: visible ? greenFringe / visible : 0,
    robeRedRatio: visible ? robeRed / visible : 0
  };
}

function isLikelyOuterRobeRed(red, green, blue) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const likelySkin = red > 135 && green > 92 && blue > 76 && red - green < 82 && green - blue < 68;

  return (
    !likelySkin &&
    red > 85 &&
    saturation > 0.36 &&
    red > green + 28 &&
    red > blue + 34 &&
    green / red < 0.52 &&
    blue / red < 0.52 &&
    green < 145 &&
    blue < 125
  );
}

async function inspectSequence(dirName) {
  const dir = path.join(sequenceRoot, dirName);
  const manifestPath = path.join(dir, 'manifest.json');
  const warnings = [];

  if (!fs.existsSync(manifestPath)) {
    return { id: dirName, status: 'missing-manifest', warnings: ['missing_manifest'] };
  }

  const manifest = readJson(manifestPath);
  const frames = fs
    .readdirSync(dir)
    .filter((fileName) => /^frame-\d+\.png$/.test(fileName))
    .sort();

  if (!manifest.id) warnings.push('manifest_missing_id');
  if (manifest.id && manifest.id !== dirName) warnings.push('manifest_id_directory_mismatch');
  if (!Number.isFinite(manifest.fps) || manifest.fps <= 0) warnings.push('manifest_invalid_fps');
  if (manifest.frameCount !== frames.length) warnings.push('frame_count_mismatch');
  if (!['placeholder', 'keyframe-review', 'approved', 'final'].includes(manifest.status)) {
    warnings.push('manifest_invalid_status');
  }
  if (manifest.needsChoreographyRedo) warnings.push('needs_choreography_redo');
  if (manifest.needsAssetRedo) warnings.push('needs_asset_redo');
  if (manifest.needsCompletionFramesRedo) warnings.push('needs_completion_frames_redo');
  if (manifest.requiresNoRedOuterRobe && !manifest.noRedOuterRobe) {
    warnings.push('requires_no_red_outer_robe_review');
  }

  frames.forEach((fileName, index) => {
    const expected = `frame-${String(index).padStart(3, '0')}.png`;
    if (fileName !== expected) {
      warnings.push('non_contiguous_frame_numbers');
    }
  });

  const frameInfos = [];
  for (const fileName of frames) {
    const info = await imageInfo(path.join(dir, fileName));
    frameInfos.push({ fileName, ...info });
    if (!info.hasAlpha) warnings.push(`${fileName}:missing_alpha`);
    if (info.width < 200 || info.height < 200) warnings.push(`${fileName}:suspiciously_small`);
    if (info.greenFringeRatio > 0.012) warnings.push(`${fileName}:possible_green_fringe`);
    if (manifest.requiresNoRedOuterRobe && info.robeRedRatio > 0.0015) {
      warnings.push(`${fileName}:possible_red_outer_robe`);
    }
  }

  return {
    id: manifest.id ?? dirName,
    status: manifest.status ?? 'unknown',
    fps: manifest.fps,
    frameCount: frames.length,
    warnings: [...new Set(warnings)],
    frames: frameInfos
  };
}

async function main() {
  fs.mkdirSync(reportDir, { recursive: true });

  if (!fs.existsSync(sequenceRoot)) {
    const report = {
      generatedAt: new Date().toISOString(),
      sequences: [],
      warnings: ['sequence_root_missing']
    };
    fs.writeFileSync(path.join(reportDir, 'sequence-qa.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log('No sequence assets yet.');
    return;
  }

  const dirs = fs
    .readdirSync(sequenceRoot)
    .filter((entry) => fs.statSync(path.join(sequenceRoot, entry)).isDirectory())
    .sort();

  const sequences = [];
  for (const dirName of dirs) {
    sequences.push(await inspectSequence(dirName));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sequences
  };

  fs.writeFileSync(path.join(reportDir, 'sequence-qa.json'), `${JSON.stringify(report, null, 2)}\n`);

  if (sequences.length === 0) {
    console.log('No sequence assets yet.');
    return;
  }

  for (const sequence of sequences) {
    const suffix = sequence.warnings.length ? `: ${sequence.warnings.join(', ')}` : ': ok';
    console.log(`${sequence.id}${suffix}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

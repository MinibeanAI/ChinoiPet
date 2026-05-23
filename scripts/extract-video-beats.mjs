import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const outputRoot = path.resolve('video-beats');

const jobs = [
  {
    id: 'robe-remove-stage',
    source: '/Users/douer/Downloads/copy_1A54D7DC-954B-430A-A347-301C8791A1D5.MOV',
    beats: ['start', 'robe-slide', 'back-turn', 'waist-gather', 'arms-open', 'settle']
  },
  {
    id: 'sleeve-sweep-loop',
    source: '/Users/douer/Downloads/copy_2B4F3316-8CA6-426B-9913-E09D6E710077.MOV',
    beats: ['start', 'weight-shift', 'sleeve-sweep', 'body-low', 'rebound', 'settle']
  },
  {
    id: 'skirt-release-spin',
    source: '/Users/douer/Downloads/copy_32DD8F5D-7894-468B-B7E7-95B8C80FA587.MOV',
    beats: ['start', 'turn-in', 'skirt-open', 'white-pants-reveal', 'turn-out', 'recover']
  },
  {
    id: 'white-pants-split-jump',
    source: '/Users/douer/Downloads/copy_8308E633-D2D2-4E9E-B278-96E2C27DD8AC.MOV',
    beats: ['prepare', 'takeoff', 'airborne-split', 'hands-near-legs', 'descent', 'landing']
  },
  {
    id: 'skirt-release-variant',
    source: '/Users/douer/Downloads/copy_4832596A-87C2-48FE-A73A-73B7AD0C201D.MOV',
    beats: ['start', 'turn-in', 'skirt-layer-open', 'white-pants-active', 'arms-up', 'recover']
  },
  {
    id: 'wave-come-here',
    source: '/Users/douer/Downloads/copy_D0E567D2-6F8E-4BE9-A2BB-76372ACD98E9.MOV',
    beats: ['start', 'smile', 'hand-raise', 'gesture', 'hold', 'recover']
  },
  {
    id: 'listen-to-crowd',
    source: '/Users/douer/Downloads/copy_E16A2CFE-7ABA-47E0-AC89-764B11C304BF.MOV',
    beats: ['start', 'turn', 'hand-to-ear', 'listen-hold', 'point-or-smile', 'recover']
  }
];

function durationSeconds(source) {
  const output = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    source
  ], { encoding: 'utf8' }).trim();

  const duration = Number(output);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not read duration for ${source}`);
  }

  return duration;
}

function beatTime(duration, index, total) {
  if (total <= 1) return 0;
  const padding = Math.min(0.2, duration * 0.04);
  return padding + ((duration - padding * 2) * index) / (total - 1);
}

function extractBeat(job, beat, index, duration) {
  const outDir = path.join(outputRoot, job.id);
  fs.mkdirSync(outDir, { recursive: true });
  const time = beatTime(duration, index, job.beats.length);
  const outPath = path.join(outDir, `${String(index + 1).padStart(2, '0')}-${beat}.jpg`);

  execFileSync('ffmpeg', [
    '-y',
    '-ss',
    time.toFixed(3),
    '-i',
    job.source,
    '-frames:v',
    '1',
    '-q:v',
    '2',
    outPath
  ], { stdio: 'ignore' });

  return { beat, time: Number(time.toFixed(3)), path: outPath };
}

function makeContactSheet(job) {
  const outDir = path.join(outputRoot, job.id);
  const sheetPath = path.join(outDir, 'contact-sheet.jpg');
  execFileSync('ffmpeg', [
    '-y',
    '-pattern_type',
    'glob',
    '-i',
    path.join(outDir, '*.jpg'),
    '-vf',
    `scale=240:-1,tile=${job.beats.length}x1`,
    '-q:v',
    '2',
    sheetPath
  ], { stdio: 'ignore' });
}

function main() {
  const manifest = [];
  fs.mkdirSync(outputRoot, { recursive: true });

  for (const job of jobs) {
    if (!fs.existsSync(job.source)) {
      console.warn(`Missing source: ${job.source}`);
      continue;
    }

    const duration = durationSeconds(job.source);
    const beats = job.beats.map((beat, index) => extractBeat(job, beat, index, duration));
    makeContactSheet(job);
    manifest.push({
      id: job.id,
      source: job.source,
      duration: Number(duration.toFixed(3)),
      beats,
      contactSheet: path.join(outputRoot, job.id, 'contact-sheet.jpg')
    });
    console.log(`${job.id}: ${beats.length} beats`);
  }

  fs.writeFileSync(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

main();

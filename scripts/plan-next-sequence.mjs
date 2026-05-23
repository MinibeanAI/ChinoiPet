import fs from 'node:fs';
import path from 'node:path';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    planRoot: 'docs/frame-plans',
    input: '<sheet.png>',
    canvas: '720x720',
    poseMax: '620x620',
    mode: 'cells'
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    switch (arg) {
      case '--id':
        options.id = next;
        index += 1;
        break;
      case '--input':
        options.input = next;
        index += 1;
        break;
      case '--canvas':
        options.canvas = next;
        index += 1;
        break;
      case '--pose-max':
        options.poseMax = next;
        index += 1;
        break;
      case '--mode':
        options.mode = next;
        index += 1;
        break;
      case '--plan-root':
        options.planRoot = next;
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.id) throw new Error('Missing --id <animation-id>');
  if (!['cells', 'components'].includes(options.mode)) throw new Error(`Invalid --mode ${options.mode}`);

  return options;
}

function readPlan(options) {
  const planPath = path.resolve(options.planRoot, `${options.id}.json`);
  if (!fs.existsSync(planPath)) {
    throw new Error(`Frame plan not found: ${planPath}`);
  }

  return {
    planPath,
    plan: JSON.parse(fs.readFileSync(planPath, 'utf8'))
  };
}

function shellQuote(value) {
  if (/^[\w./:<>=-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function main() {
  const options = parseArgs();
  const { planPath, plan } = readPlan(options);
  const frames = plan.reviewFrameCount ?? plan.targetFrameCount;
  const fps = plan.reviewFps ?? plan.targetFps;
  const label = plan.name ?? plan.id;

  if (!Number.isInteger(frames) || frames <= 0) throw new Error('Plan is missing reviewFrameCount/targetFrameCount');
  if (!Number.isFinite(fps) || fps <= 0) throw new Error('Plan is missing reviewFps/targetFps');

  const importCommand = [
    'npm run sequence:import-keyposes --',
    '--input',
    shellQuote(options.input),
    '--id',
    shellQuote(options.id),
    '--frames',
    String(frames),
    '--fps',
    String(fps),
    '--canvas',
    options.canvas,
    '--pose-max',
    options.poseMax,
    '--mode',
    options.mode,
    '--status',
    'keyframe-review',
    '--motion',
    'spin',
    '--label',
    shellQuote(label)
  ].join(' ');

  console.log(`# ${plan.id}: ${label}`);
  console.log(`Plan: ${planPath}`);
  console.log(`Review target: ${frames} frames at ${fps} fps`);
  console.log('');
  console.log('Import command:');
  console.log(importCommand);
  console.log('');
  console.log('Must show:');

  for (const beat of plan.choreography ?? []) {
    console.log(`- ${beat.beat}: ${beat.description}`);
  }

  if (plan.rejectionRules?.length) {
    console.log('');
    console.log('Reject if:');
    for (const rule of plan.rejectionRules) {
      console.log(`- ${rule}`);
    }
  }
}

main();

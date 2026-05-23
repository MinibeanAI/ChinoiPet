import fs from 'node:fs';
import path from 'node:path';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    planRoot: 'docs/frame-plans',
    promptFile: 'docs/asset-prompts/special-actions-v1.md',
    outputRoot: 'asset-drafts',
    slug: null
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    switch (arg) {
      case '--id':
        options.id = next;
        index += 1;
        break;
      case '--slug':
        options.slug = next;
        index += 1;
        break;
      case '--plan-root':
        options.planRoot = next;
        index += 1;
        break;
      case '--prompt-file':
        options.promptFile = next;
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

  if (!options.id) throw new Error('Missing --id <animation-id>');
  return options;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function extractSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`(^## ${escaped}\\n[\\s\\S]*?)(?=^## |\\z)`, 'm'));
  return match?.[1]?.trim() ?? '';
}

function commandFor(plan, slug) {
  const id = plan.id;
  const frames = plan.reviewFrameCount ?? plan.targetFrameCount;
  const fps = plan.reviewFps ?? plan.targetFps;
  const input = `asset-drafts/keyframe-sheets/${slug}-source.png`;
  const label = plan.name ?? id;

  return [
    'npm run sequence:import-keyposes --',
    `--input ${input}`,
    `--id ${id}`,
    `--frames ${frames}`,
    `--fps ${fps}`,
    '--canvas 720x720',
    '--pose-max 620x620',
    '--mode cells',
    '--status keyframe-review',
    '--motion spin',
    `--label '${label}'`
  ].join(' ');
}

function markdownFor({ plan, planPath, promptSection, slug }) {
  const lines = [
    `# ${plan.id} v3 Brief`,
    '',
    `Source plan: \`${path.relative(process.cwd(), planPath)}\``,
    '',
    '## Target',
    '',
    `- Name: ${plan.name}`,
    `- Review: ${plan.reviewFrameCount ?? plan.targetFrameCount} frames at ${plan.reviewFps ?? plan.targetFps} fps`,
    `- Final target: ${plan.targetFrameCount} frames at ${plan.targetFps} fps`,
    '',
    '## Import',
    '',
    '```bash',
    commandFor(plan, slug),
    '```',
    '',
    '## Choreography',
    ''
  ];

  for (const beat of plan.choreography ?? []) {
    lines.push(`- ${beat.beat} (${beat.frameRange}): ${beat.description}`);
  }

  lines.push('', '## Costume Rules', '');
  for (const rule of plan.costumeRules ?? []) {
    lines.push(`- ${rule}`);
  }

  lines.push('', '## Reject If', '');
  for (const rule of plan.rejectionRules ?? []) {
    lines.push(`- ${rule}`);
  }

  if (promptSection) {
    lines.push('', '## Generation Prompt', '', promptSection);
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const options = parseArgs();
  const slug = options.slug ?? `${options.id}-v3`;
  const planPath = path.resolve(options.planRoot, `${options.id}.json`);
  const promptPath = path.resolve(options.promptFile);

  if (!fs.existsSync(planPath)) throw new Error(`Frame plan not found: ${planPath}`);
  if (!fs.existsSync(promptPath)) throw new Error(`Prompt file not found: ${promptPath}`);

  const plan = readJson(planPath);
  const promptMarkdown = fs.readFileSync(promptPath, 'utf8');
  const promptSection = extractSection(promptMarkdown, 'No-Robe Mamian Skirt Tear');
  const outputDir = path.resolve(options.outputRoot, slug);
  const outputPath = path.join(outputDir, 'README.md');

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, markdownFor({ plan, planPath, promptSection, slug }));

  console.log(outputPath);
}

main();

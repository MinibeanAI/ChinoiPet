import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const sourcePath = path.resolve('src/assets/character-front-cutout.png');
const iconsetDir = path.resolve('build/icon.iconset');
const iconSourcePath = path.resolve('build/icon-source.png');
const outputPath = path.resolve('build/icon.icns');

const iconEntries = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024]
];

async function makeIconSource() {
  const foreground = await sharp(sourcePath)
    .ensureAlpha()
    .resize({
      width: 880,
      height: 880,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 32, g: 10, b: 14, alpha: 1 }
    }
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="bg" cx="50%" cy="30%" r="78%">
                <stop offset="0%" stop-color="#ffe3b5"/>
                <stop offset="34%" stop-color="#d23a3a"/>
                <stop offset="70%" stop-color="#7b141a"/>
                <stop offset="100%" stop-color="#1f0a0f"/>
              </radialGradient>
              <radialGradient id="shine" cx="44%" cy="22%" r="62%">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.38"/>
                <stop offset="52%" stop-color="#ffffff" stop-opacity="0.04"/>
                <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#f2d084"/>
                <stop offset="35%" stop-color="#e5b452"/>
                <stop offset="70%" stop-color="#bb7c2f"/>
                <stop offset="100%" stop-color="#f0d59a"/>
              </linearGradient>
              <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="22" stdDeviation="18" flood-color="#070204" flood-opacity="0.44"/>
              </filter>
            </defs>
            <rect width="1024" height="1024" rx="238" fill="url(#bg)"/>
            <rect x="34" y="34" width="956" height="956" rx="222" fill="none" stroke="url(#frame)" stroke-width="18" opacity="0.92"/>
            <rect x="56" y="56" width="912" height="912" rx="206" fill="none" stroke="#fff0c9" stroke-width="3" opacity="0.25"/>
            <rect width="1024" height="1024" rx="238" fill="url(#shine)"/>
            <g filter="url(#softShadow)">
              <path d="M176 756 C302 842 722 842 848 756" fill="none" stroke="#f2cd7a" stroke-width="34" stroke-linecap="round" opacity="0.78"/>
              <path d="M206 760 C320 826 704 826 818 760" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.16"/>
            </g>
          </svg>`
        )
      },
      { input: foreground, gravity: 'center' }
    ])
    .png()
    .toFile(iconSourcePath);

}

await fs.rm(iconsetDir, { recursive: true, force: true });
await fs.mkdir(iconsetDir, { recursive: true });
await makeIconSource();

const { spawnSync } = await import('node:child_process');
for (const [fileName, size] of iconEntries) {
  const pngPath = path.join(iconsetDir, fileName);
  const resizeResult = spawnSync('sips', ['-z', String(size), String(size), iconSourcePath, '--out', pngPath], {
    stdio: 'ignore'
  });

  if (resizeResult.status !== 0) {
    process.exitCode = resizeResult.status ?? 1;
    break;
  }
}

const result = spawnSync('iconutil', ['-c', 'icns', iconsetDir, '-o', outputPath], {
  stdio: 'inherit'
});

if (result.status !== 0) {
  const icnsEntries = [
    ['icp4', 'icon_16x16.png'],
    ['icp5', 'icon_16x16@2x.png'],
    ['icp6', 'icon_32x32@2x.png'],
    ['ic07', 'icon_128x128.png'],
    ['ic08', 'icon_128x128@2x.png'],
    ['ic09', 'icon_256x256@2x.png'],
    ['ic10', 'icon_512x512@2x.png']
  ];
  const chunks = await Promise.all(
    icnsEntries.map(async ([type, fileName]) => {
      const png = await fs.readFile(path.join(iconsetDir, fileName));
      const header = Buffer.alloc(8);
      header.write(type, 0, 4, 'ascii');
      header.writeUInt32BE(png.length + 8, 4);
      return Buffer.concat([header, png]);
    })
  );
  const totalLength = 8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 4, 'ascii');
  header.writeUInt32BE(totalLength, 4);
  await fs.writeFile(outputPath, Buffer.concat([header, ...chunks], totalLength));
}

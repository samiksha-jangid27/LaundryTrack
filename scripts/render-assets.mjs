import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const folder = fileURLToPath(new URL('../mobile/assets/', import.meta.url));
await mkdir(folder, { recursive: true });
const shirt =
  '<path d="m16 3 5 2 2 5-5 2v9H6v-9l-5-2 2-5 5-2a4 4 0 0 0 8 0Z" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/>';
function svg({ background = true, color = '#d7eda8' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${background ? '<rect width="1024" height="1024" fill="#15584e"/>' : ''}<g transform="translate(224 224) scale(24)" color="${color}">${shirt}</g></svg>`;
}
await writeFile(folder + 'brand-source.svg', svg());
for (const [name, options, width] of [
  ['icon.png', {}, 1024],
  ['android-icon-foreground.png', { background: false }, 1024],
  ['android-icon-monochrome.png', { background: false, color: '#ffffff' }, 1024],
  ['splash-icon.png', { background: false, color: '#15584e' }, 512],
  ['favicon.png', {}, 64],
])
  await sharp(Buffer.from(svg(options)))
    .resize(width, width)
    .png()
    .toFile(folder + name);
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#15584e' } })
  .png()
  .toFile(folder + 'android-icon-background.png');
console.log('LaundryTrack app assets rendered from brand-source.svg');

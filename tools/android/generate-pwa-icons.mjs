import { mkdir, writeFile } from 'node:fs/promises';
import { createCanvas } from '@napi-rs/canvas';

const output = new URL('../../public/icons/', import.meta.url);
await mkdir(output, { recursive: true });

function render(size, maskable = false) {
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');
  const scale = size / 512;
  context.fillStyle = '#075bbf';
  context.fillRect(0, 0, size, size);

  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `700 ${maskable ? 270 : 330}px Arial`;
  context.fillText('T', 256 * scale, 235 * scale);
  context.fillStyle = '#54e0c1';
  context.fillRect(154 * scale, 365 * scale, 204 * scale, 22 * scale);
  return canvas.toBuffer('image/png');
}

await Promise.all([
  writeFile(new URL('tecescola-192.png', output), render(192)),
  writeFile(new URL('tecescola-512.png', output), render(512)),
  writeFile(new URL('tecescola-maskable-512.png', output), render(512, true)),
]);

export function dominantColors(pixels: Uint8ClampedArray): string[] {
  const buckets = new Map<number, { total: number; rgb: number[] }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const key = ((rgb[0] >> 4) << 8) | ((rgb[1] >> 4) << 4) | (rgb[2] >> 4);
    const bucket = buckets.get(key) ?? { total: 0, rgb: [0, 0, 0] };
    bucket.total++;
    rgb.forEach((value, channel) => { bucket.rgb[channel] += value; });
    buckets.set(key, bucket);
  }
  const selected: number[][] = [];
  for (const bucket of [...buckets.values()].sort((a, b) => b.total - a.total)) {
    const rgb = bucket.rgb.map(value => Math.round(value / bucket.total));
    if (selected.some(color => color.reduce((sum, value, channel) => sum + (value - rgb[channel]) ** 2, 0) < 48 ** 2)) continue;
    selected.push(rgb);
    if (selected.length === 6) break;
  }
  return selected.map(rgb => '#' + rgb.map(value => value.toString(16).padStart(2, '0')).join(''));
}

export async function paletteFromImage(file: File): Promise<string[]> {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) {
    throw new Error('Choose a PNG, JPEG, WebP, GIF or AVIF image.');
  }
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { resizeWidth: 160, resizeHeight: 160, resizeQuality: 'low' });
  } catch {
    throw new Error('Cannot read this image. Try another image or export it as PNG.');
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not process the image.');
    context.drawImage(bitmap, 0, 0);
    const colors = dominantColors(context.getImageData(0, 0, canvas.width, canvas.height).data);
    if (!colors.length) throw new Error('This image has no visible colors. Choose another image.');
    return colors;
  } finally {
    bitmap.close();
  }
}

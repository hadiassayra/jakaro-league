import { extractPalette, type PaletteColor } from './colors';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذّر تحميل الصورة'));
    img.src = src;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Store small, self-contained team badges in tournament backups and sync. */
export async function processTeamLogo(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('اختر صورة PNG أو JPG أو WebP.');
  }
  if (file.size > 8 * 1024 * 1024) throw new Error('حجم الصورة كبير. اختر صورة أصغر من ٨ ميجابايت.');
  const img = await loadImage(await readAsDataUrl(file));
  const scale = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('تعذّر تجهيز الصورة. حاول مرة أخرى.');
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.85);
}

/** Reads a logo file, downsizes raster images (keeps localStorage small) and extracts its colors */
export async function processLogo(file: File): Promise<{ dataUrl: string; palette: PaletteColor[] }> {
  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const w = img.naturalWidth || 512;
  const h = img.naturalHeight || 512;
  let dataUrl = original;
  const isSvg = file.type.includes('svg');
  if (!isSvg && (Math.max(w, h) > 600 || file.size > 300_000)) {
    const scale = 600 / Math.max(w, h);
    const c = document.createElement('canvas');
    c.width = Math.round(w * Math.min(1, scale));
    c.height = Math.round(h * Math.min(1, scale));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    dataUrl = c.toDataURL('image/png');
  }
  // sample colors on a small canvas
  const size = 120;
  const c = document.createElement('canvas');
  const ratio = w / h;
  c.width = ratio >= 1 ? size : Math.round(size * ratio);
  c.height = ratio >= 1 ? Math.round(size / ratio) : size;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  let palette: PaletteColor[] = [];
  try {
    palette = extractPalette(ctx.getImageData(0, 0, c.width, c.height).data, 6, 1);
  } catch {
    palette = [];
  }
  return { dataUrl, palette };
}

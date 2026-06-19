export function cloudinaryImageUrl(
  url: string | null | undefined,
  options: { width?: number; height?: number; crop?: 'fill' | 'fit' | 'limit'; quality?: 'auto' | number } = {},
) {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;

  const width = options.width ?? 320;
  const height = options.height;
  const crop = options.crop ?? 'fill';
  const quality = options.quality ?? 'auto';
  const transforms = [
    `w_${width}`,
    height ? `h_${height}` : null,
    `c_${crop}`,
    `q_${quality}`,
    'f_auto',
    'dpr_auto',
  ]
    .filter(Boolean)
    .join(',');

  return url.replace('/upload/', `/upload/${transforms}/`);
}

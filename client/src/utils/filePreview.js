const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg)$/i;
const PDF_EXT = /\.pdf$/i;

export function isPreviewableFile(file) {
  const name = file?.originalName || file?.filename || '';
  const mime = file?.mimeType || '';

  if (mime.startsWith('image/')) return true;
  if (mime === 'application/pdf') return true;
  if (IMAGE_EXT.test(name)) return true;
  if (PDF_EXT.test(name)) return true;
  return false;
}

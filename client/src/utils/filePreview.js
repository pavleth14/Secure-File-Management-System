const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|avif|ico)$/i;
const PDF_EXT = /\.pdf$/i;
const VIDEO_EXT = /\.(mp4|mov|avi|mkv|webm|mpg|mpeg|wmv|m4v)$/i;

export function isPreviewableFile(file) {
  const name = file?.originalName || file?.filename || '';
  const mime = file?.mimeType || '';

  if (mime.startsWith('image/')) return true;
  if (mime.startsWith('video/')) return true;
  if (mime === 'application/pdf') return true;
  if (IMAGE_EXT.test(name)) return true;
  if (PDF_EXT.test(name)) return true;
  if (VIDEO_EXT.test(name)) return true;
  return false;
}

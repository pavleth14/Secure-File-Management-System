import crypto from 'crypto';

export function requireSheetsIngestApiKey(req, res, next) {
  const secret = process.env.SHEETS_INGEST_SECRET;
  if (!secret) {
    return res.status(500).json({ message: 'SHEETS_INGEST_SECRET is not configured' });
  }

  const provided = req.headers['x-api-key'];
  if (!provided || typeof provided !== 'string') {
    return res.status(401).json({ message: 'Invalid API key' });
  }

  try {
    const providedBuffer = Buffer.from(provided);
    const secretBuffer = Buffer.from(secret);
    if (
      providedBuffer.length !== secretBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, secretBuffer)
    ) {
      return res.status(401).json({ message: 'Invalid API key' });
    }
  } catch {
    return res.status(401).json({ message: 'Invalid API key' });
  }

  next();
}

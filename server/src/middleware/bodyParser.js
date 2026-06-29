import express from 'express';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const jsonParser = express.json({ limit: MAX_UPLOAD_BYTES });

export function selectiveBodyParser(req, res, next) {
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('multipart/form-data')) {
    return next();
  }

  jsonParser(req, res, next);
}

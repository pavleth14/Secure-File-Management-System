export function errorHandler(err, req, res, _next) {
  console.error(err);

  let status = err.status || 500;
  let message = err.message || 'Internal server error';

  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    message = 'File exceeds the 50MB upload limit';
  }

  if (err.status === 413 && !message.includes('50MB')) {
    message = 'Upload rejected: request body too large for the server or reverse proxy (check client_max_body_size)';
  }

  res.status(status).json({ message });
}

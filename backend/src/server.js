import app from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log('========================================================');
  console.log(` Student File Management Backend running on port ${env.PORT}`);
  console.log(` Environment    : ${env.NODE_ENV}`);
  console.log(` Storage Driver : ${env.STORAGE_DRIVER.toUpperCase()}`);
  if (env.STORAGE_DRIVER === 's3') {
    console.log(` S3 Bucket      : ${env.AWS_S3_BUCKET_NAME || '(Not configured)'}`);
    console.log(` AWS Region     : ${env.AWS_REGION}`);
  } else {
    console.log(` Local Directory: ${env.LOCAL_UPLOAD_DIR}`);
  }
  console.log(` CORS Origin    : ${env.CORS_ORIGIN}`);
  console.log(` Max File Size  : ${env.MAX_FILE_SIZE_MB} MB`);
  console.log('========================================================');
});

// Graceful shutdown handling
function handleShutdown(signal) {
  console.log(`Received ${signal}. Shutting down server gracefully...`);
  server.close(() => {
    console.log('Server closed successfully.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  STORAGE_DRIVER: (process.env.STORAGE_DRIVER || 'local').toLowerCase(),
  LOCAL_UPLOAD_DIR: process.env.LOCAL_UPLOAD_DIR
    ? path.resolve(process.env.LOCAL_UPLOAD_DIR)
    : path.resolve(__dirname, '../../uploads'),
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 15
};

export function validateConfig() {
  if (env.STORAGE_DRIVER !== 'local' && env.STORAGE_DRIVER !== 's3') {
    throw new Error(
      `Invalid STORAGE_DRIVER "${env.STORAGE_DRIVER}". Allowed values are "local" or "s3".`
    );
  }

  if (env.STORAGE_DRIVER === 's3' && !env.AWS_S3_BUCKET_NAME) {
    console.warn(
      '[Warning] STORAGE_DRIVER is set to "s3", but AWS_S3_BUCKET_NAME is not configured.'
    );
  }
}

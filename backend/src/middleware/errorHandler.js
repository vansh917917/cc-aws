import multer from 'multer';
import { env } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  // Multer-specific errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `File size exceeds the allowed limit of ${env.MAX_FILE_SIZE_MB} MB`
      });
    }
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`
    });
  }

  // S3 or AWS SDK errors
  if (err.name === 'NoSuchBucket') {
    return res.status(502).json({
      success: false,
      message: `Configured S3 bucket "${env.AWS_S3_BUCKET_NAME}" does not exist or is in a different region`
    });
  }

  if (err.name === 'AccessDenied') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: IAM role or AWS credentials lack necessary S3 permissions'
    });
  }

  if (err.name === 'CredentialsProviderError') {
    return res.status(500).json({
      success: false,
      message: 'AWS credentials could not be loaded from environment or EC2 IAM instance profile'
    });
  }

  // Path traversal or invalid key errors
  if (err.message && (err.message.includes('path traversal') || err.message.includes('Invalid file key'))) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }

  // Custom client errors
  if (err.status && err.status < 500) {
    return res.status(err.status).json({
      success: false,
      message: err.message
    });
  }

  console.error('[Unhandled Error]', err);

  return res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
}

import path from 'path';
import crypto from 'crypto';
import {
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import { getS3Client } from '../config/s3Client.js';

class S3StorageService {
  constructor() {
    this.bucketName = env.AWS_S3_BUCKET_NAME;
  }

  _ensureBucketConfigured() {
    if (!this.bucketName) {
      throw new Error(
        'S3 storage is active but AWS_S3_BUCKET_NAME is not configured in environment variables'
      );
    }
  }

  _sanitizeKey(key) {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid file key');
    }
    const sanitized = path.basename(key).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (!sanitized || sanitized === '.' || sanitized === '..') {
      throw new Error('Invalid file key');
    }
    return sanitized;
  }

  _parseOriginalNameFromKey(key) {
    // Keys follow format: <timestamp>-<randomHex>-<cleanName>
    const parts = key.split('-');
    if (parts.length >= 3 && /^\d+$/.test(parts[0])) {
      return parts.slice(2).join('-');
    }
    return key;
  }

  async uploadFile(file) {
    this._ensureBucketConfigured();
    const s3 = getS3Client();

    const timestamp = Date.now();
    const randomHex = crypto.randomBytes(4).toString('hex');
    const cleanOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const key = `${timestamp}-${randomHex}-${cleanOriginalName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype || 'application/octet-stream',
      Metadata: {
        'original-name': encodeURIComponent(file.originalname),
        'uploaded-at': new Date(timestamp).toISOString()
      }
    });

    await s3.send(command);

    return {
      key,
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
      uploadedAt: new Date(timestamp).toISOString(),
      storage: 's3'
    };
  }

  async listFiles() {
    this._ensureBucketConfigured();
    const s3 = getS3Client();

    const command = new ListObjectsV2Command({
      Bucket: this.bucketName
    });

    const response = await s3.send(command);
    const contents = response.Contents || [];

    const files = contents.map((item) => {
      const originalName = this._parseOriginalNameFromKey(item.Key);
      return {
        key: item.Key,
        name: originalName,
        size: item.Size,
        mimeType: 'application/octet-stream',
        uploadedAt: item.LastModified ? item.LastModified.toISOString() : new Date().toISOString(),
        extension: path.extname(originalName).toLowerCase()
      };
    });

    // Sort newest first
    return files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }

  async getFileStream(key) {
    this._ensureBucketConfigured();
    const sanitizedKey = this._sanitizeKey(key);
    const s3 = getS3Client();

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: sanitizedKey
      });

      const response = await s3.send(command);

      let originalName = this._parseOriginalNameFromKey(sanitizedKey);
      if (response.Metadata && response.Metadata['original-name']) {
        try {
          originalName = decodeURIComponent(response.Metadata['original-name']);
        } catch {
          // Keep parsed fallback
        }
      }

      return {
        stream: response.Body,
        name: originalName,
        mimeType: response.ContentType || 'application/octet-stream',
        size: response.ContentLength
      };
    } catch (err) {
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async deleteFile(key) {
    this._ensureBucketConfigured();
    const sanitizedKey = this._sanitizeKey(key);
    const s3 = getS3Client();

    // Verify file existence first
    try {
      await s3.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: sanitizedKey
        })
      );
    } catch (err) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: sanitizedKey
    });

    await s3.send(command);
    return true;
  }
}

export const s3StorageService = new S3StorageService();

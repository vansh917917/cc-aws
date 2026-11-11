import { env } from '../config/env.js';
import { localStorageService } from './localStorageService.js';
import { s3StorageService } from './s3StorageService.js';
import { simpledbService } from '../config/simpledbClient.js';

class StorageService {
  get activeDriver() {
    return env.STORAGE_DRIVER;
  }

  getService() {
    if (this.activeDriver === 's3') {
      return s3StorageService;
    }
    return localStorageService;
  }

  async uploadFile(file) {
    const uploaded = await this.getService().uploadFile(file);

    if (env.ENABLE_SIMPLEDB) {
      try {
        await simpledbService.putMetadata(uploaded.key, {
          originalName: uploaded.originalName,
          size: uploaded.size,
          mimeType: uploaded.mimeType,
          uploadedAt: uploaded.uploadedAt,
          storage: uploaded.storage
        });
        uploaded.simpledbIndexed = true;
      } catch (err) {
        console.warn('[SimpleDB] Could not index metadata:', err.message);
      }
    }

    return uploaded;
  }

  async listFiles() {
    if (env.ENABLE_SIMPLEDB) {
      try {
        const metadataItems = await simpledbService.listMetadata();
        if (metadataItems && metadataItems.length > 0) {
          return metadataItems;
        }
      } catch (err) {
        console.warn('[SimpleDB] Fallback to primary storage driver listing:', err.message);
      }
    }
    return this.getService().listFiles();
  }

  async getFileStream(key) {
    return this.getService().getFileStream(key);
  }

  async deleteFile(key) {
    const deleted = await this.getService().deleteFile(key);
    if (deleted && env.ENABLE_SIMPLEDB) {
      try {
        await simpledbService.deleteMetadata(key);
      } catch (err) {
        console.warn('[SimpleDB] Could not delete metadata:', err.message);
      }
    }
    return deleted;
  }

  getStorageInfo() {
    return {
      driver: this.activeDriver,
      bucket: this.activeDriver === 's3' ? env.AWS_S3_BUCKET_NAME : null,
      region: this.activeDriver === 's3' ? env.AWS_REGION : null,
      localDir: this.activeDriver === 'local' ? env.LOCAL_UPLOAD_DIR : null,
      simpledb: {
        enabled: env.ENABLE_SIMPLEDB,
        domain: env.AWS_SIMPLEDB_DOMAIN
      },
      cloudwatch: {
        enabled: env.ENABLE_CLOUDWATCH,
        logGroup: env.CLOUDWATCH_LOG_GROUP,
        metricNamespace: env.CLOUDWATCH_METRIC_NAMESPACE
      }
    };
  }
}

export const storageService = new StorageService();

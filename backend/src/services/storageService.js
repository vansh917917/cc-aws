import { env } from '../config/env.js';
import { localStorageService } from './localStorageService.js';
import { s3StorageService } from './s3StorageService.js';

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
    return this.getService().uploadFile(file);
  }

  async listFiles() {
    return this.getService().listFiles();
  }

  async getFileStream(key) {
    return this.getService().getFileStream(key);
  }

  async deleteFile(key) {
    return this.getService().deleteFile(key);
  }

  getStorageInfo() {
    return {
      driver: this.activeDriver,
      bucket: this.activeDriver === 's3' ? env.AWS_S3_BUCKET_NAME : null,
      region: this.activeDriver === 's3' ? env.AWS_REGION : null,
      localDir: this.activeDriver === 'local' ? env.LOCAL_UPLOAD_DIR : null
    };
  }
}

export const storageService = new StorageService();

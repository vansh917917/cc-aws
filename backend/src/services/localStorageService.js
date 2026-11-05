import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env.js';

class LocalStorageService {
  constructor() {
    this.uploadDir = env.LOCAL_UPLOAD_DIR;
    this.metaDir = path.join(this.uploadDir, '.metadata');
    this._ensureDirectories();
  }

  _ensureDirectories() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
    if (!fs.existsSync(this.metaDir)) {
      fs.mkdirSync(this.metaDir, { recursive: true });
    }
  }

  _sanitizeKey(key) {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid file key');
    }
    // Disallow path traversal characters and directory separators
    const sanitized = path.basename(key).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (!sanitized || sanitized === '.' || sanitized === '..') {
      throw new Error('Invalid file key');
    }
    return sanitized;
  }

  _resolvePath(key) {
    const sanitizedKey = this._sanitizeKey(key);
    const resolvedPath = path.resolve(this.uploadDir, sanitizedKey);

    // Verify resolved path stays strictly within uploadDir
    if (!resolvedPath.startsWith(path.resolve(this.uploadDir))) {
      throw new Error('Access denied: path traversal detected');
    }

    return { sanitizedKey, resolvedPath };
  }

  _getMetaPath(sanitizedKey) {
    return path.join(this.metaDir, `${sanitizedKey}.json`);
  }

  async uploadFile(file) {
    this._ensureDirectories();

    const timestamp = Date.now();
    const randomHex = crypto.randomBytes(4).toString('hex');
    const cleanOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const key = `${timestamp}-${randomHex}-${cleanOriginalName}`;

    const { resolvedPath } = this._resolvePath(key);
    const metaPath = this._getMetaPath(key);

    // Write file to disk
    await fs.promises.writeFile(resolvedPath, file.buffer);

    const metadata = {
      key,
      originalName: file.originalname,
      mimeType: file.mimetype || 'application/octet-stream',
      size: file.size,
      uploadedAt: new Date(timestamp).toISOString(),
      storage: 'local'
    };

    // Save sidecar metadata
    await fs.promises.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

    return metadata;
  }

  async listFiles() {
    this._ensureDirectories();

    const entries = await fs.promises.readdir(this.uploadDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith('.')) {
        continue;
      }

      const key = entry.name;
      const { resolvedPath } = this._resolvePath(key);
      const metaPath = this._getMetaPath(key);

      try {
        if (fs.existsSync(metaPath)) {
          const metaRaw = await fs.promises.readFile(metaPath, 'utf8');
          const meta = JSON.parse(metaRaw);
          files.push({
            key: meta.key,
            name: meta.originalName || meta.key,
            size: meta.size,
            mimeType: meta.mimeType,
            uploadedAt: meta.uploadedAt,
            extension: path.extname(meta.originalName || meta.key).toLowerCase()
          });
        } else {
          // Fallback if metadata sidecar is absent
          const stats = await fs.promises.stat(resolvedPath);
          files.push({
            key,
            name: key,
            size: stats.size,
            mimeType: 'application/octet-stream',
            uploadedAt: stats.mtime.toISOString(),
            extension: path.extname(key).toLowerCase()
          });
        }
      } catch (err) {
        // Skip unreadable files
        continue;
      }
    }

    // Sort newest first
    return files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  }

  async getFileStream(key) {
    const { sanitizedKey, resolvedPath } = this._resolvePath(key);

    if (!fs.existsSync(resolvedPath)) {
      return null;
    }

    const stats = await fs.promises.stat(resolvedPath);
    let originalName = sanitizedKey;
    let mimeType = 'application/octet-stream';

    const metaPath = this._getMetaPath(sanitizedKey);
    if (fs.existsSync(metaPath)) {
      try {
        const metaRaw = await fs.promises.readFile(metaPath, 'utf8');
        const meta = JSON.parse(metaRaw);
        if (meta.originalName) originalName = meta.originalName;
        if (meta.mimeType) mimeType = meta.mimeType;
      } catch {
        // Fallback to defaults
      }
    }

    const stream = fs.createReadStream(resolvedPath);

    return {
      stream,
      name: originalName,
      mimeType,
      size: stats.size
    };
  }

  async deleteFile(key) {
    const { sanitizedKey, resolvedPath } = this._resolvePath(key);

    if (!fs.existsSync(resolvedPath)) {
      return false;
    }

    await fs.promises.unlink(resolvedPath);

    const metaPath = this._getMetaPath(sanitizedKey);
    if (fs.existsSync(metaPath)) {
      try {
        await fs.promises.unlink(metaPath);
      } catch {
        // Ignored
      }
    }

    return true;
  }
}

export const localStorageService = new LocalStorageService();

import { storageService } from '../services/storageService.js';
import { cloudwatchService } from '../config/cloudwatchService.js';

export async function listFiles(req, res, next) {
  try {
    const files = await storageService.listFiles();
    const storageInfo = storageService.getStorageInfo();

    const totalSizeBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

    cloudwatchService.putMetric('FileListCount', 1, 'Count');

    return res.status(200).json({
      success: true,
      data: {
        files,
        totalFiles: files.length,
        totalSizeBytes,
        storage: storageInfo
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function uploadFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please attach a file in multipart form field "file"'
      });
    }

    const uploaded = await storageService.uploadFile(req.file);

    cloudwatchService.putMetric('FileUploadCount', 1, 'Count');
    cloudwatchService.putMetric('UploadedFileSizeBytes', req.file.size, 'Bytes');
    cloudwatchService.sendLog(`File uploaded successfully: ${uploaded.originalName} (${uploaded.size} bytes, key: ${uploaded.key})`, 'INFO');

    return res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: uploaded
    });
  } catch (err) {
    cloudwatchService.sendLog(`File upload failed: ${err.message}`, 'ERROR');
    next(err);
  }
}

export async function downloadFile(req, res, next) {
  try {
    const { key } = req.params;
    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'File key parameter is required'
      });
    }

    const fileData = await storageService.getFileStream(key);

    if (!fileData || !fileData.stream) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    cloudwatchService.putMetric('FileDownloadCount', 1, 'Count');
    cloudwatchService.sendLog(`File downloaded: ${fileData.name} (key: ${key})`, 'INFO');

    res.setHeader('Content-Type', fileData.mimeType || 'application/octet-stream');
    if (fileData.size) {
      res.setHeader('Content-Length', fileData.size);
    }

    const encodedName = encodeURIComponent(fileData.name);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileData.name.replace(/"/g, '')}"; filename*=UTF-8''${encodedName}`
    );

    fileData.stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

export async function deleteFile(req, res, next) {
  try {
    const { key } = req.params;
    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'File key parameter is required'
      });
    }

    const deleted = await storageService.deleteFile(key);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'File not found or already deleted'
      });
    }

    cloudwatchService.putMetric('FileDeleteCount', 1, 'Count');
    cloudwatchService.sendLog(`File deleted: ${key}`, 'INFO');

    return res.status(200).json({
      success: true,
      message: 'File deleted successfully',
      data: { key }
    });
  } catch (err) {
    next(err);
  }
}

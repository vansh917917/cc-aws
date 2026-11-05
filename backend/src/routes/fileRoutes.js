import { Router } from 'express';
import { upload } from '../middleware/uploadMiddleware.js';
import {
  listFiles,
  uploadFile,
  downloadFile,
  deleteFile
} from '../controllers/fileController.js';

const router = Router();

// GET /api/files - List all files
router.get('/', listFiles);

// POST /api/files - Upload file
router.post('/', upload.single('file'), uploadFile);

// GET /api/files/:key/download - Download file
router.get('/:key/download', downloadFile);

// DELETE /api/files/:key - Delete file
router.delete('/:key', deleteFile);

export default router;

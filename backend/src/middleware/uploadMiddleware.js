import multer from 'multer';
import path from 'path';
import { env } from '../config/env.js';

// Block unsafe and executable extensions
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.bin',
  '.msi', '.vbs', '.js.vbs', '.scr', '.pif', '.application',
  '.gadget', '.hta', '.cpl', '.msc', '.jar'
]);

// Memory storage buffers file in RAM for fast dispatch to local disk or S3
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!file.originalname || file.originalname.trim() === '') {
    return cb(new Error('Uploaded file must have a valid filename'));
  }

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return cb(new Error(`Executable and script files (${ext}) are not allowed for security reasons`));
  }

  cb(null, true);
}

export const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024
  },
  fileFilter
});

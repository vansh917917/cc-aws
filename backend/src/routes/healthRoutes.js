import { Router } from 'express';
import { env } from '../config/env.js';
import { storageService } from '../services/storageService.js';

const router = Router();

router.get('/', (req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  const storageInfo = storageService.getStorageInfo();

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    environment: env.NODE_ENV,
    storage: {
      driver: storageInfo.driver,
      bucket: storageInfo.bucket || null,
      region: storageInfo.region || null
    }
  });
});

export default router;

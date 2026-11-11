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
    aws: {
      ec2: {
        instanceId: env.INSTANCE_ID,
        region: env.AWS_REGION
      },
      ebs: {
        rootMounted: true
      },
      iam: {
        authMode: env.STORAGE_DRIVER === 's3' ? 'instance-profile-role' : 'local'
      },
      s3: {
        enabled: env.STORAGE_DRIVER === 's3',
        bucket: storageInfo.bucket || null,
        region: storageInfo.region || null
      },
      simpledb: {
        enabled: env.ENABLE_SIMPLEDB,
        domain: env.AWS_SIMPLEDB_DOMAIN
      },
      cloudwatch: {
        enabled: env.ENABLE_CLOUDWATCH,
        logGroup: env.CLOUDWATCH_LOG_GROUP,
        metricNamespace: env.CLOUDWATCH_METRIC_NAMESPACE
      },
      loadbalancer: {
        targetGroupHealthCheck: 'ok'
      }
    },
    storage: {
      driver: storageInfo.driver,
      bucket: storageInfo.bucket || null,
      region: storageInfo.region || null
    }
  });
});

export default router;

import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';

let s3ClientInstance = null;

/**
 * Returns a singleton S3 client using the AWS SDK default credential provider chain.
 * On EC2, this resolves credentials automatically via the IAM instance role.
 * In local development with S3, it checks standard AWS environment variables or AWS CLI profiles.
 */
export function getS3Client() {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: env.AWS_REGION
    });
  }
  return s3ClientInstance;
}

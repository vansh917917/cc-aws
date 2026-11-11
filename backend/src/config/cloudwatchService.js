import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  PutLogEventsCommand,
  DescribeLogStreamsCommand
} from '@aws-sdk/client-cloudwatch-logs';
import { env } from './env.js';

class CloudWatchService {
  constructor() {
    this.enabled = env.ENABLE_CLOUDWATCH;
    this.region = env.AWS_REGION;
    this.namespace = env.CLOUDWATCH_METRIC_NAMESPACE;
    this.logGroupName = env.CLOUDWATCH_LOG_GROUP;
    this.logStreamName = `backend-${env.INSTANCE_ID}-${Date.now().toString(36)}`;

    this._metricsClient = null;
    this._logsClient = null;
    this._logsInitialized = false;
    this._sequenceToken = null;
  }

  getMetricsClient() {
    if (!this._metricsClient) {
      this._metricsClient = new CloudWatchClient({ region: this.region });
    }
    return this._metricsClient;
  }

  getLogsClient() {
    if (!this._logsClient) {
      this._logsClient = new CloudWatchLogsClient({ region: this.region });
    }
    return this._logsClient;
  }

  async putMetric(metricName, value = 1, unit = 'Count', dimensions = []) {
    if (!this.enabled) return;

    try {
      const client = this.getMetricsClient();
      const command = new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: [
          {
            MetricName: metricName,
            Value: value,
            Unit: unit,
            Timestamp: new Date(),
            Dimensions: [
              { Name: 'InstanceId', Value: env.INSTANCE_ID },
              { Name: 'Environment', Value: env.NODE_ENV },
              ...dimensions
            ]
          }
        ]
      });
      await client.send(command);
    } catch (err) {
      console.warn(`[CloudWatch Metric] Warning publishing ${metricName}:`, err.message);
    }
  }

  async _initLogs() {
    if (this._logsInitialized || !this.enabled) return;

    const client = this.getLogsClient();
    try {
      await client.send(new CreateLogGroupCommand({ logGroupName: this.logGroupName }));
    } catch (err) {
      if (err.name !== 'ResourceAlreadyExistsException') {
        // Group already exists is expected in production
      }
    }

    try {
      await client.send(
        new CreateLogStreamCommand({
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName
        })
      );
    } catch (err) {
      if (err.name !== 'ResourceAlreadyExistsException') {
        console.warn('[CloudWatch Logs] Warning creating stream:', err.message);
      }
    }

    this._logsInitialized = true;
  }

  async sendLog(message, level = 'INFO') {
    if (!this.enabled) return;

    try {
      await this._initLogs();
      const client = this.getLogsClient();

      const logEvent = {
        message: `[${level}] [${env.INSTANCE_ID}] ${typeof message === 'object' ? JSON.stringify(message) : message}`,
        timestamp: Date.now()
      };

      const command = new PutLogEventsCommand({
        logGroupName: this.logGroupName,
        logStreamName: this.logStreamName,
        logEvents: [logEvent],
        sequenceToken: this._sequenceToken
      });

      const response = await client.send(command);
      this._sequenceToken = response.nextSequenceToken;
    } catch (err) {
      console.warn('[CloudWatch Logs] Warning sending log:', err.message);
    }
  }
}

export const cloudwatchService = new CloudWatchService();

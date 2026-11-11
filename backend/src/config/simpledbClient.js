import AWS from 'aws-sdk';
import { env } from './env.js';

class SimpleDBService {
  constructor() {
    this.enabled = env.ENABLE_SIMPLEDB;
    this.domain = env.AWS_SIMPLEDB_DOMAIN;
    this.region = env.AWS_REGION;
    this._client = null;
    this._domainChecked = false;
  }

  getClient() {
    if (!this._client) {
      this._client = new AWS.SimpleDB({
        region: this.region
      });
    }
    return this._client;
  }

  async ensureDomain() {
    if (!this.enabled || this._domainChecked) return;
    const client = this.getClient();
    try {
      await client.createDomain({ DomainName: this.domain }).promise();
      this._domainChecked = true;
    } catch (err) {
      console.warn(`[SimpleDB] Warning creating domain ${this.domain}:`, err.message);
    }
  }

  async putMetadata(key, metadata) {
    if (!this.enabled) return null;
    await this.ensureDomain();

    const client = this.getClient();
    const attributes = [
      { Name: 'originalName', Value: String(metadata.originalName || ''), Replace: true },
      { Name: 'size', Value: String(metadata.size || 0), Replace: true },
      { Name: 'mimeType', Value: String(metadata.mimeType || 'application/octet-stream'), Replace: true },
      { Name: 'uploadedAt', Value: String(metadata.uploadedAt || new Date().toISOString()), Replace: true },
      { Name: 'storage', Value: String(metadata.storage || 's3'), Replace: true },
      { Name: 'key', Value: String(key), Replace: true }
    ];

    return client.putAttributes({
      DomainName: this.domain,
      ItemName: key,
      Attributes: attributes
    }).promise();
  }

  async getMetadata(key) {
    if (!this.enabled) return null;
    await this.ensureDomain();

    const client = this.getClient();
    const result = await client.getAttributes({
      DomainName: this.domain,
      ItemName: key,
      ConsistentRead: true
    }).promise();

    if (!result.Attributes || result.Attributes.length === 0) {
      return null;
    }

    const data = { key };
    for (const attr of result.Attributes) {
      data[attr.Name] = attr.Value;
    }
    if (data.size) data.size = parseInt(data.size, 10);
    return data;
  }

  async listMetadata() {
    if (!this.enabled) return null;
    await this.ensureDomain();

    const client = this.getClient();
    const query = `select * from \`${this.domain}\``;

    const result = await client.select({
      SelectExpression: query,
      ConsistentRead: true
    }).promise();

    const items = (result.Items || []).map((item) => {
      const data = { key: item.Name };
      for (const attr of item.Attributes || []) {
        data[attr.Name] = attr.Value;
      }
      if (data.size) data.size = parseInt(data.size, 10);
      data.name = data.originalName || item.Name;
      return data;
    });

    return items;
  }

  async deleteMetadata(key) {
    if (!this.enabled) return null;
    await this.ensureDomain();

    const client = this.getClient();
    return client.deleteAttributes({
      DomainName: this.domain,
      ItemName: key
    }).promise();
  }
}

export const simpledbService = new SimpleDBService();

# Student File Management System - Backend API

Modular Express.js REST API supporting local disk storage and Amazon S3 cloud storage for the Student File Management System.

## Architecture & Storage Drivers

The backend provides a unified storage abstraction through `storageService.js`. Depending on the `STORAGE_DRIVER` environment variable, operations are routed to:

- `local`: Files are saved to the `uploads/` directory with sidecar metadata in `uploads/.metadata/`. File keys are sanitized to prevent directory traversal.
- `s3`: Files are uploaded to the configured Amazon S3 bucket using AWS SDK for JavaScript v3 (`@aws-sdk/client-s3`). Authentication uses the AWS SDK default credential provider chain:
  - On an AWS EC2 instance: automatically reads credentials from the attached IAM instance role via Instance Metadata Service (IMDS).
  - In local development: loads credentials from standard environment variables or `~/.aws/credentials`. No credentials are hardcoded.

## Prerequisites

- Node.js v18.0.0 or higher
- npm v9.0.0 or higher
- Windows Command Prompt (CMD)

## Setup and Installation (Windows CMD)

1. Open Windows Command Prompt (`cmd.exe`).
2. Navigate to the backend directory:

```cmd
cd /d "c:\Users\Vansh Gupta\Desktop\cc-aws\backend"
```

3. Install project dependencies:

```cmd
npm install
```

4. Create your local environment configuration file:

```cmd
copy .env.example .env
```

## Running the Backend

### Local Storage Mode (Default for Local Testing)

Ensure your `.env` contains:

```env
PORT=5000
NODE_ENV=development
STORAGE_DRIVER=local
LOCAL_UPLOAD_DIR=uploads
CORS_ORIGIN=*
MAX_FILE_SIZE_MB=15
```

Start the server:

```cmd
npm start
```

For automatic server restart on file changes:

```cmd
npm run dev
```

The server will be reachable at `http://localhost:5000`.

### Amazon S3 Mode (For AWS EC2 or S3 Testing)

Update your `.env` file:

```env
PORT=5000
NODE_ENV=production
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket-name
CORS_ORIGIN=*
MAX_FILE_SIZE_MB=15
```

Start the server:

```cmd
npm start
```

## REST API Documentation

### 1. Health Check
- **Endpoint**: `GET /api/health`
- **Description**: Returns backend health, uptime, and active storage driver info.
- **Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-11-05T15:27:11.890Z",
  "uptimeSeconds": 42,
  "environment": "development",
  "storage": {
    "driver": "local",
    "bucket": null,
    "region": null
  }
}
```

### 2. List Uploaded Files
- **Endpoint**: `GET /api/files`
- **Description**: Returns an array of uploaded files, total count, total byte size, and storage mode.
- **Response**:
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "key": "1793892431972-0f3bcce5-assignment.pdf",
        "name": "assignment.pdf",
        "size": 245100,
        "mimeType": "application/pdf",
        "uploadedAt": "2026-11-05T15:27:11.000Z",
        "extension": ".pdf"
      }
    ],
    "totalFiles": 1,
    "totalSizeBytes": 245100,
    "storage": {
      "driver": "local"
    }
  }
}
```

### 3. Upload File
- **Endpoint**: `POST /api/files`
- **Content-Type**: `multipart/form-data`
- **Body Field**: `file` (Binary file data, up to 15 MB)
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "key": "1793892431972-0f3bcce5-assignment.pdf",
    "originalName": "assignment.pdf",
    "mimeType": "application/pdf",
    "size": 245100,
    "uploadedAt": "2026-11-05T15:27:11.000Z",
    "storage": "local"
  }
}
```

### 4. Download File
- **Endpoint**: `GET /api/files/:key/download`
- **Description**: Streams the requested file binary with `Content-Disposition: attachment`.
- **Response**: Binary stream. Returns HTTP 404 if file does not exist.

### 5. Delete File
- **Endpoint**: `DELETE /api/files/:key`
- **Description**: Removes the file from storage.
- **Response**:
```json
{
  "success": true,
  "message": "File deleted successfully",
  "data": {
    "key": "1793892431972-0f3bcce5-assignment.pdf"
  }
}
```

## Running Automated Tests

Run the built-in Node.js test suite:

```cmd
npm test
```

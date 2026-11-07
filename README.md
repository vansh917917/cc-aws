# Student File Management System (AWS Learning Project)

A beginner-friendly, decoupled full-stack web application designed for learning AWS cloud hosting and infrastructure.

The system allows students and instructors to upload, view, search, download, and delete files. It supports two storage engines:
1. **Local Storage**: Files are saved to the local server filesystem for zero-dependency local development.
2. **Amazon S3 Storage**: Files are stored in an Amazon S3 bucket using AWS SDK v3 with IAM instance role authentication.

---

## 1. Project Overview

This project was built to practice hosting decoupled full-stack web applications on AWS.

The target AWS deployment architecture utilizes:
- **EC2 Instance 1 (Frontend)**: Hosts the static HTML/CSS/JavaScript web assets served via Nginx.
- **EC2 Instance 2 (Backend)**: Runs the Node.js Express REST API as a background service (e.g., via PM2 or systemd).
- **Amazon S3 (File Storage)**: Private object storage bucket holding student files.
- **AWS IAM (Security)**: An IAM Role attached as an Instance Profile to EC2 Instance 2 granting least-privilege permissions to S3 (`PutObject`, `GetObject`, `DeleteObject`, `ListBucket`).

---

## 2. Application Architecture

```
+-----------------------------------------------------------+
|                      USER BROWSER                         |
+-----------------------------------------------------------+
            |                                   |
            | HTTP GET                          | HTTP REST Requests
            | (HTML/CSS/JS)                     | (CORS Enabled)
            v                                   v
+--------------------------+       +--------------------------+
|      EC2 INSTANCE 1      |       |      EC2 INSTANCE 2      |
|    Frontend Web Server   |       |    Backend API Server    |
|                          |       |                          |
|         [ Nginx ]        |       |   [ Node.js + Express ]  |
|      Port 80 / 443       |       |        Port 5000         |
+--------------------------+       +--------------------------+
                                                |
                                                | AWS SDK v3
                                                | (IAM Instance Role)
                                                v
                                   +--------------------------+
                                   |      AMAZON S3 BUCKET    |
                                   |  (Private Object Storage)|
                                   +--------------------------+
```

### How the Architecture Supports Two EC2 Instances and S3

1. **Frontend-Backend Independence**:
   - The frontend is completely static. It never imports backend modules, relies on server-side rendering, or expects the backend to reside on the same host.
   - The frontend accesses the backend across the network using standard `fetch()` and `XMLHttpRequest` HTTP calls directed at `API_BASE_URL`.
   - On AWS, `API_BASE_URL` points to the public IP or DNS name of EC2 Instance 2 (e.g., `http://<EC2-BACKEND-PUBLIC-IP>:5000/api`).

2. **CORS Handling**:
   - Because the frontend (Instance 1) and backend (Instance 2) reside on different IP addresses or domains, browsers enforce the Same-Origin Policy.
   - The backend includes Express `cors` middleware configured via the `CORS_ORIGIN` environment variable. Set `CORS_ORIGIN=*` during initial learning, or restrict it to `http://<EC2-FRONTEND-PUBLIC-IP>` in production.

3. **Secure S3 Integration**:
   - The frontend never connects directly to S3 and never handles AWS credentials.
   - All S3 actions (upload, list, download stream, delete) occur exclusively on EC2 Instance 2 through Express.
   - The S3 bucket remains entirely private.
   - EC2 Instance 2 uses the AWS SDK default credential provider chain. When an IAM role is attached to the EC2 instance, the SDK retrieves short-lived temporary credentials from the EC2 Instance Metadata Service (IMDS) automatically.

---

## 3. Technology Stack

### Frontend
- HTML5 (semantic structure, accessibility)
- CSS3 (custom responsive styling, CSS variables, mobile-ready layout)
- Vanilla JavaScript (ES6+, `fetch` API, `XMLHttpRequest` for progress tracking)
- Zero external frontend frameworks or build steps

### Backend
- Node.js (v18+)
- Express.js (REST API routing and HTTP server)
- Multer (multipart/form-data streaming and file size validation)
- AWS SDK for JavaScript v3 (`@aws-sdk/client-s3`)
- Dotenv (environment variable management)
- CORS (Cross-Origin Resource Sharing middleware)

### Storage
- Storage Driver Abstraction (`local` vs `s3`)
- Path traversal prevention and filename sanitization

---

## 4. Folder Structure

```
student-file-management/
│
├── frontend/
│   ├── index.html          # Main dashboard user interface
│   ├── css/
│   │   └── style.css       # Complete dashboard design and responsive styles
│   ├── js/
│   │   ├── config.js       # Configurable API base URL (local vs EC2)
│   │   └── app.js          # Client-side UI logic, uploads, table, and toasts
│   └── README.md           # Frontend-specific documentation
│
├── backend/
│   ├── src/
│   │   ├── app.js          # Express app configuration, middleware, and routes
│   │   ├── server.js       # Server entry point and graceful shutdown
│   │   ├── config/
│   │   │   ├── env.js      # Environment variable loader and validation
│   │   │   └── s3Client.js # AWS SDK v3 S3Client with default credentials
│   │   ├── controllers/
│   │   │   └── fileController.js   # Handlers for list, upload, download, delete
│   │   ├── services/
│   │   │   ├── storageService.js     # Unified storage driver router
│   │   │   ├── localStorageService.js# Local disk file system storage
│   │   │   └── s3StorageService.js   # Amazon S3 operations via AWS SDK v3
│   │   ├── middleware/
│   │   │   ├── uploadMiddleware.js   # Multer file size & extension validator
│   │   │   └── errorHandler.js       # Centralized error handler
│   │   └── routes/
│   │       ├── fileRoutes.js   # /api/files endpoints
│   │       └── healthRoutes.js # /api/health endpoint
│   ├── uploads/            # Default directory for local storage mode
│   ├── test/
│   │   └── smoke.test.js   # Automated integration smoke tests
│   ├── package.json        # Node.js dependencies and run scripts
│   ├── .env.example        # Environment variable template
│   └── README.md           # Backend-specific documentation
│
├── .gitignore              # Ignores node_modules, .env, and uploaded files
└── README.md               # Master project documentation
```

---

## 5. Prerequisites

Before running the application locally:
- Node.js (v18 or higher) installed on your machine.
- npm (v9 or higher) installed with Node.js.
- Windows Command Prompt (`cmd.exe`).

Verify your installation in CMD:

```cmd
node -v
npm -v
```

---

## 6. How to Run the Backend Locally

All commands below are formatted for Windows Command Prompt (`cmd.exe`):

### Step 1: Open CMD and navigate to the backend folder

```cmd
cd /d "c:\Users\Vansh Gupta\Desktop\cc-aws\backend"
```

### Step 2: Install dependencies

```cmd
npm install
```

### Step 3: Configure the environment file

Create `.env` from `.env.example`:

```cmd
copy .env.example .env
```

By default, `.env` is configured for **local storage mode**:

```env
PORT=5000
NODE_ENV=development
STORAGE_DRIVER=local
LOCAL_UPLOAD_DIR=uploads
CORS_ORIGIN=*
MAX_FILE_SIZE_MB=15
```

### Step 4: Start the backend server

```cmd
npm start
```

For live code reloading:

```cmd
npm run dev
```

You should see:

```
========================================================
 Student File Management Backend running on port 5000
 Environment    : development
 Storage Driver : LOCAL
 Local Directory: ...\backend\uploads
 CORS Origin    : *
 Max File Size  : 15 MB
========================================================
```

---

## 7. How to Run the Frontend Locally

Open a **second** Windows Command Prompt window.

### Step 1: Navigate to the frontend folder

```cmd
cd /d "c:\Users\Vansh Gupta\Desktop\cc-aws\frontend"
```

### Step 2: Serve the static files

You can use `npx serve` (recommended):

```cmd
npx serve -l 3000
```

Alternatively, if you have Python installed:

```cmd
python -m http.server 3000
```

### Step 3: Open the application

Open your browser and navigate to:

```
http://localhost:3000
```

---

## 8. Storage Driver Configuration

The backend dynamically selects its storage engine based on the `STORAGE_DRIVER` environment variable.

### Option A: Local Storage Mode (`STORAGE_DRIVER=local`)

Used for development and testing without needing AWS:

```env
STORAGE_DRIVER=local
LOCAL_UPLOAD_DIR=uploads
```

- Uploaded files are stored in `backend/uploads/`.
- File metadata is saved in `backend/uploads/.metadata/`.
- File keys are checked against directory traversal (`..` and directory separators are blocked).

### Option B: Amazon S3 Mode (`STORAGE_DRIVER=s3`)

Used when deploying to AWS or testing against a real S3 bucket:

```env
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=my-student-files-bucket
```

Authentication mechanics:
- **On EC2 Instance 2**: The AWS SDK v3 automatically contacts the EC2 Instance Metadata Service (IMDS) to retrieve credentials from the attached IAM instance role. No keys are needed in `.env`.
- **On Local PC (if testing S3 locally)**: The AWS SDK v3 reads credentials from `~/.aws/credentials` (configured via `aws configure`) or environment variables `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.

---

## 9. API Endpoint Documentation

Base URL: `http://localhost:5000/api` (or `http://<BACKEND-EC2-IP>:5000/api`)

| Method | Endpoint | Description | Content-Type | Status Code |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service health, uptime, and storage driver | `application/json` | 200 |
| `GET` | `/api/files` | List all files and storage summary | `application/json` | 200 |
| `POST` | `/api/files` | Upload a file (`file` form field) | `multipart/form-data` | 201 |
| `GET` | `/api/files/:key/download` | Download file binary stream | Binary stream | 200 / 404 |
| `DELETE` | `/api/files/:key` | Delete file from storage | `application/json` | 200 / 404 |

### Request & Response Examples

#### 1. Upload File (`POST /api/files`)
Attach the file to form-data with the key `file`.

Success Response (201):
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "key": "1793892431972-0f3bcce5-syllabus.pdf",
    "originalName": "syllabus.pdf",
    "mimeType": "application/pdf",
    "size": 182390,
    "uploadedAt": "2026-11-05T15:27:11.980Z",
    "storage": "local"
  }
}
```

#### 2. Download File (`GET /api/files/:key/download`)
Returns the file as an attachment with appropriate headers:
```http
HTTP/1.1 200 OK
Content-Disposition: attachment; filename="syllabus.pdf"; filename*=UTF-8''syllabus.pdf
Content-Type: application/pdf
Content-Length: 182390
```

#### 3. Health Check (`GET /api/health`)
```json
{
  "status": "healthy",
  "timestamp": "2026-11-05T15:27:11.890Z",
  "uptimeSeconds": 128,
  "environment": "development",
  "storage": {
    "driver": "local",
    "bucket": null,
    "region": null
  }
}
```

---

## 10. How Frontend and Backend Communicate

1. **Configurable Endpoint**:
   - `frontend/js/config.js` defines `window.APP_CONFIG.getApiBaseUrl()`.
   - In local development, it defaults to `http://localhost:5000/api`.
   - For EC2 deployment, change `DEFAULT_API_BASE` in `config.js` to `http://<EC2-BACKEND-PUBLIC-IP>:5000/api`, or click the **API Connection** button directly in the UI.

2. **Network Protocol**:
   - Every action in the web UI corresponds to a REST request:
     - Page load or Refresh -> `GET /api/health` and `GET /api/files`
     - File drag or selection -> `POST /api/files` with `FormData` and real-time upload progress
     - Download click -> `GET /api/files/:key/download`
     - Delete click -> `DELETE /api/files/:key`

3. **Error Resilience**:
   - If the backend is stopped or unreachable, the frontend displays an "Offline" status badge and notifies the user with clear toast alerts.
   - Files are validated on both client-side and server-side to prevent blocked extensions (`.exe`, `.bat`, `.sh`, etc.) and enforce the 15 MB size limit.

---

## 11. How to Test All Application Features

### Automated Test Suite
From the backend directory in Windows CMD:

```cmd
cd /d "c:\Users\Vansh Gupta\Desktop\cc-aws\backend"
npm test
```

This runs integration tests verifying:
- Health endpoint status
- File listing
- File upload
- File download content integrity
- File deletion and subsequent 404 response

### Manual Testing Walkthrough

1. **Start Backend**: Ensure backend is running at `http://localhost:5000`.
2. **Start Frontend**: Open `http://localhost:3000` in your browser.
3. **Check Connection**:
   - Verify the top-left status shows a green dot and `Connected`.
   - The Storage Driver card displays `LOCAL`.
4. **Test Upload**:
   - Drag or select a sample document (e.g., a `.pdf`, `.txt`, or `.png` file).
   - Click **Upload File**.
   - Notice the real-time upload progress bar and confirmation toast.
   - The total files metric increments, and the file appears in the table.
5. **Test Validation**:
   - Try selecting an executable file (e.g., `.exe` or `.bat`). Notice the immediate security error toast.
   - Try uploading a file larger than 15 MB. Notice the size restriction error.
6. **Test Search Filter**:
   - Type in the search box to filter files dynamically by name or extension.
7. **Test Download**:
   - Click the **Download** button on any file row. The browser downloads the original file with its original filename intact.
8. **Test Delete**:
   - Click the **Delete** button. A confirmation modal appears.
   - Confirm deletion. The file is removed from disk and table, and metrics update.

---

## 12. Security Considerations

- **No Hardcoded Credentials**: Source code contains zero AWS access keys or secret keys.
- **Git Protection**: `.env` and `uploads/` are excluded via `.gitignore`.
- **Private S3 Bucket**: S3 bucket policies remain private; only the backend interacts with S3.
- **Directory Traversal Mitigation**: File keys are validated and sanitized to prevent `../` attacks on local storage.
- **Upload Restrictions**: Dangerous executable types are rejected, and maximum file size is enforced.
- **CORS Configuration**: Cross-origin resource sharing headers are configured for backend API endpoints.

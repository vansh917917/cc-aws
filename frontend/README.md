# Student File Management System - Frontend Application

Lightweight, static, framework-free dashboard built with semantic HTML5, CSS3, and vanilla JavaScript.

## Highlights

- Pure Vanilla JS: zero external frontend runtime dependencies (no React, Vue, or Angular).
- Static Deployment: can be served by Nginx, Apache, Python `http.server`, or any basic static file server.
- Decoupled Configuration: communicates with the backend solely via REST API calls over HTTP.
- Dynamic API Base URL: backend endpoint is configured in `js/config.js` or adjusted in real time via the UI settings modal.

## Prerequisites

- Any modern web browser (Google Chrome, Mozilla Firefox, Microsoft Edge, Safari)
- Optional: Python 3 or Node.js `npx serve` to serve static files locally

## Running the Frontend Locally (Windows CMD)

Open Windows Command Prompt (`cmd.exe`) and choose one of the following methods:

### Method 1: Using Node's npx serve (Recommended)

```cmd
cd /d "c:\Users\Vansh Gupta\Desktop\cc-aws\frontend"
npx serve -l 3000
```

Open your browser and navigate to: `http://localhost:3000`

### Method 2: Using Python Built-in HTTP Server

```cmd
cd /d "c:\Users\Vansh Gupta\Desktop\cc-aws\frontend"
python -m http.server 3000
```

Open your browser and navigate to: `http://localhost:3000`

### Method 3: Direct File Opening

You can also double-click `frontend/index.html` or run:

```cmd
start "" "c:\Users\Vansh Gupta\Desktop\cc-aws\frontend\index.html"
```

## Configuring the Backend API URL

### 1. In `js/config.js`
Open `frontend/js/config.js` and change `DEFAULT_API_BASE`:

```javascript
// Local testing:
const DEFAULT_API_BASE = 'http://localhost:5000/api';

// EC2 deployment (Instance 2 public IP or DNS):
const DEFAULT_API_BASE = 'http://<BACKEND-EC2-PUBLIC-IP>:5000/api';
```

### 2. Through the Web UI
Click the **API Connection** button in the sidebar or top bar to type a custom backend URL. The configuration is preserved in browser storage for your session.

## Deploying to EC2 Instance 1 with Nginx

When ready to host on your frontend EC2 instance:
1. Copy the contents of the `frontend/` directory to `/var/www/html/` on EC2 Instance 1.
2. Update `DEFAULT_API_BASE` in `js/config.js` to point to EC2 Instance 2 (Backend).
3. Ensure Nginx is running: `sudo systemctl restart nginx`.

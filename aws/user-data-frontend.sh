#!/bin/bash
# User Data script for Frontend EC2 Instances (Nginx)
# OS: Ubuntu 22.04 / 24.04 LTS

set -e
export DEBIAN_FRONTEND=noninteractive

# Update packages and install Nginx + Git
apt-get update -y
apt-get install -y nginx git

# Enable and start Nginx
systemctl enable nginx
systemctl start nginx

# Clone repository or pull frontend assets
# Replace YOUR_GIT_REPO_URL with your GitHub repository URL if cloning directly
WEB_ROOT="/var/www/html/student-file-management"
mkdir -p "$WEB_ROOT"

# Copy or place frontend static files
# In manual deployment, files are copied via scp into /var/www/html
cat <<'EOF' > /etc/nginx/sites-available/default
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html;

    server_name _;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Health check endpoint for ALB target group
    location /health {
        access_log off;
        return 200 "frontend healthy\n";
    }

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF

nginx -t
systemctl restart nginx

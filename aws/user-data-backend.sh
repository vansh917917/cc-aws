#!/bin/bash
# User Data script for Backend EC2 Instances (Node.js API + PM2)
# OS: Ubuntu 22.04 / 24.04 LTS

set -e
export DEBIAN_FRONTEND=noninteractive

# Update system packages
apt-get update -y
apt-get install -y curl git build-essential

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2 process manager globally
npm install -g pm2

# Setup app directory
APP_DIR="/opt/student-file-management"
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Clone or deploy backend code (user can also scp files)
# git clone <YOUR_REPO_URL> .

# Setup backend systemd service via PM2 on boot
pm2 startup systemd -u root --hp /root
pm2 save

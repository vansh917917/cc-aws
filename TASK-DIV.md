# Project Task Division: Student File Management System (AWS)

This document outlines the four-way division of technical responsibilities, underlying cloud concepts, and exact AWS configuration steps for the Cloud Computing (CC) project presentation.

---

## Team Roster and Ownership Summary

| Member | Assigned Focus Area | Owned AWS Services | Key Deliverable |
| :--- | :--- | :--- | :--- |
| **Vansh** | Architecture, Security & Object Storage | **IAM**, **Amazon S3** | Least-privilege IAM Role/Policy, S3 Bucket configuration, System Architecture design |
| **Sudhanshu** | Compute, Block Storage & NoSQL Metadata | **Amazon EC2**, **Amazon EBS**, **Amazon SimpleDB** | Security Groups, EC2 Launch, gp3 EBS setup, SimpleDB metadata domain & indexing |
| **Sanjana** | Full-Stack Server & Service Deployment | **EC2 Application Layer** (Nginx, Node.js, PM2) | Frontend deployment on EC2 #1 & #2, Backend API deployment under PM2 on EC2 #3 & #4 |
| **Shalini** | Ingress Traffic Routing & Observability | **Application Load Balancer (ALB)**, **Amazon CloudWatch** | Dual Target Groups, ALB path routing (`/api*`), CloudWatch Logs, Metrics & Alarms |

---

## Member 1: Vansh
### Focus: System Architecture, IAM Security, and Amazon S3 Object Storage

### 1. Underlying Cloud Concepts
- **Decoupled Architecture:** Separating the user interface (client-side static assets) from the API and persistent storage prevents single-server failure and allows independent horizontal scaling.
- **Principle of Least Privilege (IAM):** Rather than granting blanket administrative rights or storing static credentials (`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`) in `.env` files, an IAM Instance Profile dynamically delivers temporary credentials to EC2 instances through the Instance Metadata Service (IMDS).
- **Object Storage vs. Block Storage:** Object storage (S3) stores files as discrete objects with metadata and a unique key, designed for massive scale and 99.999999999% (11 9s) data durability, rather than being tied to a single operating system disk.

### 2. AWS Steps and Exact Commands Executed
1. **IAM Policy Creation:**
   - Navigated to **IAM** -> **Policies** -> **Create policy** (JSON tab).
   - Pasted least-privilege policy allowing `s3:*` on the project bucket, `sdb:*` for SimpleDB, and `logs:*` / `cloudwatch:*` for telemetry.
   - Policy Name: `StudentFileAppPolicy`.
2. **IAM Role Creation:**
   - Navigated to **IAM** -> **Roles** -> **Create role**.
   - Trusted entity: **AWS Service**, Use case: **EC2**.
   - Attached policy: `StudentFileAppPolicy`.
   - Role Name: `StudentFileEC2Role`.
3. **Amazon S3 Bucket Creation:**
   - Navigated to **Amazon S3** -> **Create bucket**.
   - Bucket name: `student-files-storage-vansh-2026` in Region `ap-south-1`.
   - Security: Checked **Block all public access** (enforces that all reads and writes flow strictly through the authenticated backend API).
4. **IAM Role Attachment:**
   - In EC2 console, selected backend instances -> **Actions** -> **Security** -> **Modify IAM role** -> Attached `StudentFileEC2Role`.

### 3. Verification and Evidence
- Backend environment variable `STORAGE_DRIVER=s3` verified via `/api/health`.
- Uploaded files appear directly inside bucket `student-files-storage-vansh-2026`.

---

## Member 2: Sudhanshu
### Focus: Virtual Compute (EC2), Block Storage (EBS), and NoSQL Metadata (SimpleDB)

### 1. Underlying Cloud Concepts
- **Compute Sizing and Quotas:** AWS accounts enforce an 8 vCPU quota limit on standard on-demand instances. Selecting `t3.micro` instances (2 vCPUs each) across 4 servers consumes `4 x 2 = 8 vCPUs`, reaching maximum allowable capacity.
- **Elastic Block Store (EBS):** EBS gp3 volumes act as network-attached SSD block storage. Unlike instance store volumes (which are ephemeral and wipe upon stop), EBS volumes retain the operating system, installed libraries, and system configurations across restarts.
- **NoSQL Attribute-Value Indexing (SimpleDB):** Storing structured metadata (file size, original name, MIME type, upload timestamp) in SimpleDB allows fast attribute lookups and queries (`select * from ...`) without scanning thousands of S3 objects.

### 2. AWS Steps and Exact Commands Executed
1. **Security Groups Configuration:**
   - Created `frontend-sg`: Inbound HTTP (Port 80) from `0.0.0.0/0`, SSH (Port 22) from `0.0.0.0/0`.
   - Created `backend-sg`: Inbound Custom TCP (Port 5000) from `0.0.0.0/0`, SSH (Port 22) from `0.0.0.0/0`.
2. **EC2 Provisioning with EBS Volumes:**
   - Launched 2 Frontend instances (`frontend-1`, `frontend-2`): Ubuntu 24.04 LTS, `t3.micro`, 20 GiB gp3 EBS, attached to `frontend-sg`.
   - Launched 2 Backend instances (`backend-1`, `backend-2`): Ubuntu 24.04 LTS, `t3.micro`, 20 GiB gp3 EBS, attached to `backend-sg`.
3. **SimpleDB Domain Creation:**
   - Initialized the domain using AWS CLI:
     ```bash
     aws sdb create-domain --domain-name student_files_metadata --region ap-south-1
     ```
   - Verified active domain:
     ```bash
     aws sdb list-domains --region ap-south-1
     ```

### 3. Verification and Evidence
- 4 instances running in EC2 console with 20 GB gp3 EBS volumes attached to `/dev/sda1`.
- SimpleDB select query returns JSON metadata for uploaded documents:
  ```bash
  aws sdb select --select-expression "select * from student_files_metadata" --region ap-south-1
  ```

---

## Member 3: Sanjana
### Focus: Application Deployment, Web Server (Nginx), and Process Management (Node.js & PM2)

### 1. Underlying Cloud Concepts
- **Static Asset Delivery via Nginx:** Serving HTML, CSS, and client-side JavaScript through an asynchronous, event-driven web server (Nginx) maximizes throughput while consuming minimal CPU and RAM.
- **Process Supervision (PM2):** In production, running Node.js directly (`node server.js`) is dangerous because unhandled exceptions kill the process. PM2 acts as a process manager that automatically restarts crashed processes and binds to Linux `systemd` to revive applications after an instance reboot.
- **Environment Variable Isolation:** Production configuration (`PORT`, `AWS_REGION`, `AWS_S3_BUCKET_NAME`, `ENABLE_SIMPLEDB`, `ENABLE_CLOUDWATCH`) is injected through `.env` files rather than hardcoded into source files.

### 2. AWS Steps and Exact Commands Executed
1. **Backend Deployment (`backend-1` and `backend-2`):**
   - Connected via EC2 Instance Connect (`ubuntu`).
   - Installed Node.js 20 LTS, Git, and PM2:
     ```bash
     sudo apt-get update -y
     curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
     sudo apt-get install -y nodejs git
     sudo npm install -g pm2
     ```
   - Cloned repository into `/opt/app` and installed dependencies:
     ```bash
     sudo mkdir -p /opt/app && sudo chown -R ubuntu:ubuntu /opt/app
     cd /opt/app && git clone https://github.com/vansh917917/cc-aws.git .
     cd /opt/app/backend && npm install
     ```
   - Configured `.env` with S3 bucket name, SimpleDB domain, and CloudWatch namespace.
   - Started and daemonized API with PM2:
     ```bash
     pm2 start src/server.js --name "student-api"
     pm2 save
     sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
     ```
2. **Frontend Deployment (`frontend-1` and `frontend-2`):**
   - Connected via EC2 Instance Connect (`ubuntu`).
   - Installed and enabled Nginx:
     ```bash
     sudo apt-get update -y && sudo apt-get install -y nginx git
     sudo rm -rf /var/www/html/*
     git clone https://github.com/vansh917917/cc-aws.git /tmp/cc-aws
     sudo cp -r /tmp/cc-aws/frontend/* /var/www/html/
     sudo systemctl restart nginx
     ```

### 3. Verification and Evidence
- Backend health check returns `status: healthy` on port 5000:
  ```bash
  curl http://localhost:5000/api/health
  ```
- Frontend loads the FileVault dashboard when accessing the frontend EC2 public IP over port 80.

---

## Member 4: Shalini
### Focus: Traffic Routing (Load Balancer) and Telemetry (CloudWatch)

### 1. Underlying Cloud Concepts
- **Path-Based Routing:** An Application Load Balancer operates at Layer 7 (HTTP/HTTPS) of the OSI model. By inspecting the URL request path, it routes `/*` to the frontend web tier and `/api*` to the backend application tier under a single DNS hostname.
- **Target Group Health Checking:** The ALB sends periodic synthetic requests (`/` on port 80, `/api/health` on port 5000). If an instance fails consecutive checks, it is taken out of service with zero impact to users.
- **Observability (Metrics, Logs, and Alarms):** CloudWatch aggregates application logs, monitors system metrics (latency, upload count), and triggers automated alarms when predefined operational thresholds are breached.

### 2. AWS Steps and Exact Commands Executed
1. **Target Groups Setup:**
   - Created `tg-frontend-80`: Protocol HTTP, Port 80, Health check path `/`, registered `frontend-1` and `frontend-2`.
   - Created `tg-backend-5000`: Protocol HTTP, Port 5000, Health check path `/api/health`, registered `backend-1` and `backend-2`.
2. **Application Load Balancer Creation:**
   - Created `student-app-alb`: Scheme **Internet-facing**, IPv4, default VPC with at least two subnets (`ap-south-1a`, `ap-south-1b`).
   - Attached Security Group: `frontend-sg` (Port 80 HTTP).
   - Listener HTTP:80 default action: Forward to `tg-frontend-80`.
3. **Configured Path-Based Routing Rule:**
   - Selected HTTP:80 Listener -> Added rule:
     - Condition: Path is `/api*`.
     - Action: Forward to `tg-backend-5000`.
     - Priority: `1`.
4. **CloudWatch Telemetry Configuration:**
   - Created Log Group: `/aws/student-file-manager/backend` with a 7-day retention period.
   - Verified custom metrics under namespace `StudentFileManager`: `ApiRequestCount`, `ApiRequestLatency`, `FileListCount`.
   - Created CloudWatch Alarm: `backend-api-latency-alarm` triggering when `ApiRequestLatency >= 1000 ms`.

### 3. Verification and Evidence
- Live ALB DNS URL (`http://student-app-alb-1149279081.ap-south-1.elb.amazonaws.com`) loads the dashboard with a green "Connected" status.
- CloudWatch Metrics console displays live graphs for both backend instances.
- CloudWatch Alarm shows state **OK**.

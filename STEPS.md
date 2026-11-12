# AWS Deployment Guide: Student File Management System

This document explains the architecture theory and provides a complete, step-by-step deployment guide for the Student File Management System. Any teammate can follow these exact instructions to reproduce this infrastructure on AWS from scratch.

---

## 1. Architecture Overview and Theory

The application uses a decoupled, highly available cloud architecture spread across multiple AWS services.

```
                                  Internet
                                     |
                                     v
                  +--------------------------------------+
                  |   Application Load Balancer (ALB)   |
                  +--------------------------------------+
                         |                        |
         Path: /*        |                        | Path: /api/*
         (Port 80)       v                        v (Port 5000)
             +-----------------------+   +-----------------------+
             | Frontend Target Group |   | Backend Target Group  |
             +-----------------------+   +-----------------------+
                    |         |                 |         |
                    v         v                 v         v
             +------------+ +------------+ +------------+ +------------+
             | frontend-1 | | frontend-2 | | backend-1  | | backend-2  |
             |   (Nginx)  | |   (Nginx)  | |  (Node.js) | |  (Node.js) |
             +------------+ +------------+ +------------+ +------------+
                   [EBS gp3]    [EBS gp3]        [EBS gp3]    [EBS gp3]
                                                        |
                                           +------------+------------+
                                           | IAM Role Authentication |
                                           +------------+------------+
                                             /          |          \
                                            v           v           v
                                     +-----------+ +-----------+ +-----------+
                                     | Amazon S3 | | SimpleDB  | |CloudWatch |
                                     | (Objects) | |(Metadata) | |(Logs/Mtr) |
                                     +-----------+ +-----------+ +-----------+
```

### Why Each Service Is Used

1. **Amazon EC2 (Elastic Compute Cloud):**
   - We run 4 virtual machines: 2 frontend web servers and 2 backend API servers.
   - **Why 2 of each?** High availability and fault tolerance. If one server crashes or AWS reboots the underlying hardware, the second server keeps the application online with zero downtime.
   - **Why separate frontend and backend?** Separation of concerns. The frontend (Nginx) serves static HTML, CSS, and JS with almost zero CPU load. The backend (Node.js) handles heavy multipart file streams, S3 uploads, and database writes. Isolating them prevents backend workloads from freezing the user interface.

2. **Amazon EBS (Elastic Block Store):**
   - Every EC2 instance uses a persistent gp3 EBS volume (20 to 30 GB) as its root file system.
   - EBS provides high-throughput block storage for the Linux OS, Node.js runtime, Nginx web server, and application dependencies.

3. **AWS IAM (Identity and Access Management):**
   - Instead of hardcoding AWS Secret Access Keys inside application configuration files (which is a severe security risk), we attach an **IAM Role** directly to the backend EC2 instances as an **Instance Profile**.
   - The AWS SDK automatically requests temporary, auto-rotating credentials from the EC2 Instance Metadata Service (IMDS).

4. **Amazon S3 (Simple Storage Service):**
   - EC2 instances are ephemeral and can be replaced at any time. Storing uploaded student files on local EC2 disks means files uploaded to `backend-1` would be completely inaccessible to users connecting to `backend-2`.
   - Amazon S3 acts as a centralized, highly durable (99.999999999%) object store. All backend servers read and write to the same central bucket.

5. **Amazon SimpleDB:**
   - SimpleDB is a lightweight NoSQL data store.
   - When a student uploads a file, the binary data is stored in S3, while its structured metadata (original file name, file size, MIME type, upload timestamp, and S3 object key) is indexed into a SimpleDB domain called `student_files_metadata`.
   - This allows fast attribute queries and metadata retrieval without having to scan the entire S3 bucket.

6. **Amazon CloudWatch:**
   - **CloudWatch Logs:** Application request logs and error traces are streamed from Node.js to the log group `/aws/student-file-manager/backend` for centralized auditing.
   - **CloudWatch Metrics:** Custom application metrics (`FileUploadCount`, `FileDeleteCount`, `UploadedFileSizeBytes`, `ApiRequestLatency`) are published into the `StudentFileManager` namespace to monitor health and performance.

7. **Application Load Balancer (ALB):**
   - The ALB acts as the single entry point for all incoming user traffic.
   - It performs **path-based routing**:
     - Traffic matching `/api*` is forwarded to the backend instances on port 5000.
     - All other traffic (`/*`) is forwarded to the frontend Nginx servers on port 80.
   - It continually health-checks all 4 instances (`/` for frontend, `/api/health` for backend) and automatically stops routing traffic to any unhealthy instance.

---

## 2. Prerequisites

Before beginning the deployment, ensure you have:
1. An active AWS Account.
2. An EC2 Key Pair created in your AWS Region (e.g. `sms-key.pem`).
3. The Git repository URL: `https://github.com/vansh917917/cc-aws.git`.
4. Your target AWS Region (this guide uses Mumbai: `ap-south-1`, but you can use `us-east-1` or any other region).

---

## 3. Phase 1: Security and Permissions (IAM)

We create the IAM permissions before launching servers so the backend instances can authenticate to AWS services automatically.

### Step 1: Create the IAM Policy
1. Open the **AWS Console** and search for **IAM**.
2. In the left menu, click **Policies**, then click **Create policy**.
3. Select the **JSON** tab and paste the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3ObjectPermissions",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SimpleDBPermissions",
      "Effect": "Allow",
      "Action": [
        "sdb:CreateDomain",
        "sdb:DeleteDomain",
        "sdb:DomainMetadata",
        "sdb:ListDomains",
        "sdb:PutAttributes",
        "sdb:GetAttributes",
        "sdb:DeleteAttributes",
        "sdb:Select"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogsAndMetrics",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "*"
    }
  ]
}
```

4. Click **Next**.
5. Set **Policy name** to `StudentFileAppPolicy`.
6. Click **Create policy**.

### Step 2: Create the IAM Role
1. In the left menu, click **Roles**, then click **Create role**.
2. Select **AWS service** as the trusted entity type.
3. Select **EC2** as the common use case, then click **Next**.
4. In the permissions search box, type `StudentFileAppPolicy` and check the checkbox next to it.
5. Click **Next**.
6. Set **Role name** to `StudentFileEC2Role`.
7. Click **Create role**.

---

## 4. Phase 2: Storage and Observability (S3, SimpleDB, CloudWatch)

### Step 3: Create the S3 Bucket
1. Navigate to **Amazon S3** in the AWS Console.
2. Click **Create bucket**.
3. Set **Bucket name** to a globally unique name (e.g. `student-files-storage-<yourname>-2026`).
4. Set **AWS Region** to your working region (e.g. `ap-south-1`).
5. Leave **Block all public access** checked.
6. Click **Create bucket**. Record this bucket name for later.

### Step 4: SimpleDB Domain Initialization
The backend application includes an automatic `ensureDomain()` check on startup. When the backend boots, it creates the domain `student_files_metadata` if it does not already exist.

*(Optional manual check via AWS CLI)*:
```bash
aws sdb create-domain --domain-name student_files_metadata --region ap-south-1
```

### Step 5: Create the CloudWatch Log Group
1. Navigate to **CloudWatch** in the AWS Console.
2. In the left sidebar, expand **Logs** and click **Log groups**.
3. Click **Create log group**.
4. Set **Log group name** to:
   ```
   /aws/student-file-manager/backend
   ```
5. Set **Retention setting** to **7 days** (prevents unnecessary storage costs).
6. Click **Create**.

---

## 5. Phase 3: Networking and Compute (Security Groups & EC2)

### Step 6: Create Security Groups

Under **EC2** -> **Network & Security** -> **Security Groups**:

#### Security Group 1: `frontend-sg`
- Description: `Frontend Web Traffic`
- Inbound Rules:
  - **HTTP (Port 80):** Source `0.0.0.0/0` (Anywhere-IPv4)
  - **SSH (Port 22):** Source `0.0.0.0/0` (Required for EC2 Instance Connect browser terminal)

#### Security Group 2: `backend-sg`
- Description: `Backend API Traffic`
- Inbound Rules:
  - **Custom TCP (Port 5000):** Source `0.0.0.0/0` (API access)
  - **SSH (Port 22):** Source `0.0.0.0/0` (EC2 Instance Connect)

---

### Step 7: Launch the 4 EC2 Instances

> [!NOTE]
> AWS accounts have an account quota of 8 vCPUs for standard instances. `t3.micro` uses 2 vCPUs per instance. Four `t3.micro` instances use exactly `4 x 2 = 8 vCPUs`. Do not launch a 5th `t3.micro` instance or AWS will reject the request with a vCPU quota error.

#### Launch Frontend Instances (`frontend-1`, `frontend-2`):
1. In the EC2 Console, click **Launch instances**.
2. **Name:** `frontend-server`
3. **Number of instances:** `2`
4. **OS:** Ubuntu Server 24.04 LTS (or 22.04 LTS)
5. **Instance type:** `t3.micro` (or `t2.micro`)
6. **Key pair:** Select your key pair (`sms-key`)
7. **Network settings:**
   - Auto-assign public IP: **Enable**
   - Select existing security group: `frontend-sg`
8. **Storage (EBS):** 20 GiB gp3
9. Click **Launch instance**.
10. In the instances list, rename the two instances to `frontend-1` and `frontend-2`.

#### Launch Backend Instances (`backend-1`, `backend-2`):
1. Click **Launch instances**.
2. **Name:** `backend-server`
3. **Number of instances:** `2`
4. **OS:** Ubuntu Server 24.04 LTS (or 22.04 LTS)
5. **Instance type:** `t3.micro` (or `t2.micro`)
6. **Key pair:** Select your key pair (`sms-key`)
7. **Network settings:**
   - Auto-assign public IP: **Enable**
   - Select existing security group: `backend-sg`
8. **Storage (EBS):** 20 GiB gp3
9. **Advanced details (Critical):**
   - **IAM instance profile:** Select `StudentFileEC2Role`
10. Click **Launch instance**.
11. Rename the instances to `backend-1` and `backend-2`.

*(If you forgot to set the IAM role during launch: select instance -> Actions -> Security -> Modify IAM role -> choose `StudentFileEC2Role` -> Update).*

---

## 6. Phase 4: Application Code Deployment

### Step 8: Deploy Backend on `backend-1`
1. Go to **EC2** -> **Instances**, select **`backend-1`**, and click **Connect**.
2. In the **EC2 Instance Connect** tab, ensure the username is `ubuntu` and click **Connect**.
3. In the black terminal, paste this script and hit **Enter**:

```bash
# 1. Update system and install Node.js 20, Git, and PM2
sudo apt-get update -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo npm install -g pm2

# 2. Clone repository into /opt/app
sudo mkdir -p /opt/app
sudo chown -R ubuntu:ubuntu /opt/app
cd /opt/app
git clone https://github.com/vansh917917/cc-aws.git .

# 3. Install backend dependencies
cd /opt/app/backend
npm install

# 4. Write production environment configuration
cat <<'EOF' > .env
PORT=5000
NODE_ENV=production
INSTANCE_ID=backend-1
STORAGE_DRIVER=s3
AWS_REGION=ap-south-1
AWS_S3_BUCKET_NAME=student-files-storage-vansh-2026
ENABLE_SIMPLEDB=true
AWS_SIMPLEDB_DOMAIN=student_files_metadata
ENABLE_CLOUDWATCH=true
CLOUDWATCH_LOG_GROUP=/aws/student-file-manager/backend
CLOUDWATCH_METRIC_NAMESPACE=StudentFileManager
CORS_ORIGIN=*
MAX_FILE_SIZE_MB=15
EOF

# 5. Start server using PM2 process manager
pm2 start src/server.js --name "student-api"
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# 6. Verify health check
curl http://localhost:5000/api/health
```

*(Replace `AWS_REGION` and `AWS_S3_BUCKET_NAME` with your actual region and bucket name if different).*

### Step 9: Deploy Backend on `backend-2`
1. Connect to **`backend-2`** via EC2 Instance Connect.
2. Paste the exact same command block from Step 8 (change `INSTANCE_ID=backend-2` inside the `.env` section).
3. Confirm health: `curl http://localhost:5000/api/health`.

---

### Step 10: Deploy Frontend on `frontend-1`
1. In EC2 Instances, select **`frontend-1`** and click **Connect**.
2. Run this command block:

```bash
# 1. Install Nginx and Git
sudo apt-get update -y
sudo apt-get install -y nginx git

# 2. Remove default Nginx welcome page
sudo rm -rf /var/www/html/*

# 3. Clone repository and copy frontend assets
git clone https://github.com/vansh917917/cc-aws.git /tmp/cc-aws
sudo cp -r /tmp/cc-aws/frontend/* /var/www/html/
rm -rf /tmp/cc-aws

# 4. Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

3. Open `http://<FRONTEND-1-PUBLIC-IP>` in your browser to verify the dashboard loads.

### Step 11: Deploy Frontend on `frontend-2`
1. Connect to **`frontend-2`** via EC2 Instance Connect.
2. Run the same commands from Step 10.
3. Open `http://<FRONTEND-2-PUBLIC-IP>` to verify.

---

## 7. Phase 5: Application Load Balancer Setup

The Load Balancer connects the frontend and backend under a single unified URL.

### Step 12: Create the Frontend Target Group
1. In EC2 console, navigate to **Load Balancing** -> **Target Groups**.
2. Click **Create target group**.
3. Target type: **Instances**.
4. Name: `tg-frontend-80`.
5. Protocol: **HTTP**, Port: **80**.
6. Health check path: `/`.
7. Click **Next**.
8. Select both **`frontend-1`** and **`frontend-2`**, click **Include as pending below**.
9. Click **Create target group**.

### Step 13: Create the Backend Target Group
1. Click **Create target group**.
2. Target type: **Instances**.
3. Name: `tg-backend-5000`.
4. Protocol: **HTTP**, Port: **5000**.
5. Health check path: **`/api/health`**.
6. Click **Next**.
7. Select both **`backend-1`** and **`backend-2`**, click **Include as pending below**.
8. Click **Create target group**.

### Step 14: Create the Load Balancer
1. In the left menu, click **Load Balancers**, then click **Create load balancer**.
2. Select **Application Load Balancer** -> **Create**.
3. Name: `student-app-alb`.
4. Scheme: **Internet-facing**, IP address type: **IPv4**.
5. **Network mapping:** Select your default VPC and check the boxes for **at least 2 Availability Zones** (e.g. `ap-south-1a`, `ap-south-1b`).
6. **Security groups:** Select `frontend-sg` (allows HTTP Port 80). Remove `default` if present.
7. **Listeners and routing:**
   - Protocol: `HTTP`, Port: `80`.
   - Default action: Forward to **`tg-frontend-80`**.
8. Click **Create load balancer**.

### Step 15: Add Path-Based Routing Rule
1. Click on the newly created load balancer (`student-app-alb`).
2. Go to the **Listeners and rules** tab.
3. Click on the **HTTP:80** listener link.
4. Click **Add rule**:
   - Rule name: `api-routing`
   - Condition: Click **Add condition** -> **Path** -> enter `/api*` -> Confirm -> Next.
   - Action: **Forward to target groups** -> select `tg-backend-5000` -> Next.
   - Priority: `1` -> Next -> Create.

---

## 8. Phase 6: End-to-End Verification

1. Go to **EC2** -> **Load Balancers** -> select `student-app-alb`.
2. Copy the **DNS name** (e.g. `http://student-app-alb-xxxx.ap-south-1.elb.amazonaws.com`).
3. Open the URL in any web browser:
   - **Frontend Check:** The dashboard loads over port 80.
   - **Load Balancer & Backend Check:** The status indicator turns **green (Connected)**, and storage driver shows **S3**.
   - **S3 Upload Check:** Upload a sample file (e.g. `.txt`, `.pdf`, `.png`). It will appear in the table and be stored inside your S3 bucket.
   - **SimpleDB Check:** The file metadata is indexed into SimpleDB.
   - **CloudWatch Logs Check:** Open CloudWatch -> Log groups -> `/aws/student-file-manager/backend` to view live HTTP request logs.
   - **CloudWatch Metrics Check:** Open CloudWatch -> Metrics -> All metrics -> `StudentFileManager` to view metrics like `FileUploadCount` and `ApiRequestLatency`.

---

## 9. Troubleshooting and Common Issues

1. **"Failed to connect to your instance" in EC2 Instance Connect:**
   - Cause: Security group restricts Port 22 to a specific IP address that does not include AWS browser servers.
   - Fix: Open Port 22 in `backend-sg` / `frontend-sg` to `0.0.0.0/0`. Make sure the username is `ubuntu`.

2. **Frontend shows "HTTP error 404" when visiting EC2 IP directly:**
   - Cause: Visiting `http://<FRONTEND-IP>` directly looks for `/api` on the frontend Nginx server, where no backend runs.
   - Fix: Access the site through the **Load Balancer DNS URL**, which automatically splits `/` to Frontend and `/api*` to Backend. Alternatively, use the in-app "API Connection" button to point directly to `http://<BACKEND-IP>:5000/api`.

3. **vCPU Quota Exceeded error when launching instances:**
   - Cause: Default AWS limit is 8 vCPUs. 4 instances of `t3.micro` use `4 x 2 = 8 vCPUs`.
   - Fix: Stick to 4 instances (2 frontend, 2 backend), or switch instance types to `t2.micro` (1 vCPU each) if 5 instances are strictly required.

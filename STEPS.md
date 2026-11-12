# AWS Deployment Guide: Student File Management System

This guide walks through deploying the Student File Management System on a brand new AWS account. It starts directly with creating your EC2 compute instances, then configures IAM permissions, S3 storage, SimpleDB metadata, CloudWatch observability, application code, and an Application Load Balancer.

---

## 1. Architecture Overview and Theory

The application uses a decoupled, highly available cloud architecture distributed across multiple AWS services:

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
   - We deploy 4 virtual machines: 2 frontend web servers and 2 backend API servers.
   - **High Availability:** Running 2 instances of each layer ensures that if an instance crashes or undergoes hardware maintenance, user traffic routes automatically to the healthy node with zero downtime.
   - **Decoupled Architecture:** Frontend Nginx servers deliver static assets (HTML/CSS/JS) with minimal memory and CPU usage. Backend Node.js servers process multipart file uploads, interact with S3, and write metadata. Isolating them prevents heavy backend file streaming from starving frontend delivery.

2. **Amazon EBS (Elastic Block Store):**
   - Each EC2 instance uses a 20 GiB to 30 GiB gp3 persistent EBS volume as its root filesystem, hosting the operating system, packages, and local configuration.

3. **AWS IAM (Identity and Access Management):**
   - Application servers authenticate to AWS services using an IAM Role attached as an EC2 Instance Profile.
   - The AWS SDK v3 automatically fetches auto-rotating, short-lived credentials from the EC2 Instance Metadata Service (IMDS). This eliminates hardcoded access keys in configuration files.

4. **Amazon S3 (Simple Storage Service):**
   - Centralized, durable object storage for uploaded student files.
   - EC2 disks are ephemeral and isolated. If files were stored locally on `backend-1`, users routed to `backend-2` could not access them. S3 gives all backend nodes a shared, highly durable storage tier.

5. **Amazon SimpleDB:**
   - Lightweight NoSQL key-value store used to catalog file metadata (filename, size, MIME type, upload timestamp, and storage key).
   - Enables fast querying and listing without scanning all objects in the S3 bucket.

6. **Amazon CloudWatch:**
   - **CloudWatch Logs:** Collects application stdout/stderr and error events under log group `/aws/student-file-manager/backend`.
   - **CloudWatch Metrics:** Ingests real-time operational data (`FileUploadCount`, `FileDeleteCount`, `UploadedFileSizeBytes`, `ApiRequestLatency`) into the `StudentFileManager` namespace.

7. **Application Load Balancer (ALB):**
   - Exposes a single public DNS endpoint for the entire system.
   - **Path-Based Routing:** Routes `/api*` to the backend target group (port 5000) and `/*` to the frontend target group (port 80).
   - Performs continuous health checks and automatically drops unhealthy instances from rotation.

---

## 2. New Account Setup and Region Selection

When working in a newly created AWS account:
1. Log in to the **AWS Management Console** as the root user or an administrator IAM user.
2. Select your target **AWS Region** from the top-right navigation bar (for example: `ap-south-1` for Mumbai, or `us-east-1` for N. Virginia).
3. Keep all subsequent resources (EC2, S3, IAM, SimpleDB, CloudWatch, ALB) in this exact same region.

> [!NOTE]
> Standard AWS accounts have a default service quota of 8 vCPUs for running standard EC2 instances. Four `t3.micro` instances (2 vCPUs each) use exactly `4 x 2 = 8 vCPUs`. Do not launch a 5th instance or the launch will be rejected with a vCPU quota error.

---

## 3. Phase 1: Launch EC2 Compute Instances

We start directly with the EC2 Launch wizard to create the SSH key pair, security groups, and virtual machines.

### Step 1: Launch Frontend Instances (`frontend-1`, `frontend-2`)

1. Open the **EC2 Console** and click **Launch instances**.
2. **Name:** Enter `frontend-server`.
3. **Number of instances:** Set to `2`.
4. **Application and OS Images:** Select **Ubuntu** (Ubuntu Server 24.04 LTS or 22.04 LTS, 64-bit x86).
5. **Instance type:** Select `t3.micro` (or `t2.micro` if `t3` is not free-tier eligible in your region).
6. **Key pair (login):**
   - Click **Create new key pair**.
   - Key pair name: `sms-key`.
   - Key pair type: `RSA`.
   - Private key file format: `.pem`.
   - Click **Create key pair** and save the downloaded file to your computer.
7. **Network settings:**
   - Click **Edit**.
   - Ensure the default VPC is selected and **Auto-assign public IP** is set to **Enable**.
   - Select **Create security group**.
   - Security group name: `frontend-sg`.
   - Description: `Frontend web and SSH traffic`.
   - Inbound security group rules:
     - **Rule 1 (SSH):** Type `SSH`, Port `22`, Source type `Anywhere` (`0.0.0.0/0`). This allows connecting via browser-based EC2 Instance Connect.
     - **Rule 2 (HTTP):** Click **Add security group rule**, Type `HTTP`, Port `80`, Source type `Anywhere` (`0.0.0.0/0`).
8. **Configure storage:** Keep default 8 to 20 GiB `gp3`.
9. Click **Launch instance**.
10. Go to the **Instances** list. You will see two new instances. Rename them to:
    - `frontend-1`
    - `frontend-2`

---

### Step 2: Launch Backend Instances (`backend-1`, `backend-2`)

1. In the EC2 Console, click **Launch instances**.
2. **Name:** Enter `backend-server`.
3. **Number of instances:** Set to `2`.
4. **Application and OS Images:** Select **Ubuntu** (Ubuntu Server 24.04 LTS or 22.04 LTS, 64-bit x86).
5. **Instance type:** Select `t3.micro` (or `t2.micro`).
6. **Key pair (login):** Select the existing `sms-key` created in Step 1.
7. **Network settings:**
   - Click **Edit**.
   - Ensure default VPC is selected and **Auto-assign public IP** is set to **Enable**.
   - Select **Create security group**.
   - Security group name: `backend-sg`.
   - Description: `Backend API and SSH traffic`.
   - Inbound security group rules:
     - **Rule 1 (SSH):** Type `SSH`, Port `22`, Source type `Anywhere` (`0.0.0.0/0`).
     - **Rule 2 (Custom TCP):** Click **Add security group rule**, Type `Custom TCP`, Port `5000`, Source type `Anywhere` (`0.0.0.0/0`).
8. **Configure storage:** 20 GiB `gp3`.
9. Click **Launch instance**.
10. In the **Instances** list, rename the two new instances to:
    - `backend-1`
    - `backend-2`

---

## 4. Phase 2: Security and Permissions (IAM Setup)

Because instances were launched first, we now create the required IAM role and attach it directly to both backend instances. This allows the backend Node.js process to interact with S3, SimpleDB, and CloudWatch without hardcoding AWS access keys.

### Step 3: Create the IAM Policy

1. Search for **IAM** in the AWS console search bar and open it.
2. In the left navigation, click **Policies**, then click **Create policy**.
3. Select the **JSON** editor tab, delete any placeholder content, and paste the following policy:

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
5. **Policy name:** Enter `StudentFileAppPolicy`.
6. Click **Create policy**.

---

### Step 4: Create the IAM Role

1. In the IAM left navigation, click **Roles**, then click **Create role**.
2. **Trusted entity type:** Select **AWS service**.
3. **Use case:** Under common use cases, select **EC2**, then click **Next**.
4. **Add permissions:** Search for `StudentFileAppPolicy`, check the box next to it, and click **Next**.
5. **Role name:** Enter `StudentFileEC2Role`.
6. Click **Create role**.

---

### Step 5: Attach the IAM Role to Backend Instances

1. Return to the **EC2 Console** and click **Instances**.
2. Select **`backend-1`**.
3. Click **Actions** -> **Security** -> **Modify IAM role**.
4. In the dropdown, choose **`StudentFileEC2Role`**.
5. Click **Update IAM role**.
6. Repeat the exact same steps for **`backend-2`**:
   - Select `backend-2` -> **Actions** -> **Security** -> **Modify IAM role** -> choose `StudentFileEC2Role` -> **Update IAM role**.

Both backend servers now have temporary auto-rotating AWS credentials available through IMDS.

---

## 5. Phase 3: Storage and Observability Setup

### Step 6: Create the Amazon S3 Bucket

1. In the AWS console search bar, search for **S3** and open it.
2. Click **Create bucket**.
3. **Bucket name:** Choose a globally unique name (for example: `student-files-storage-<yourname>-2026`). Bucket names can contain only lowercase letters, numbers, and hyphens.
4. **AWS Region:** Select the same region where your EC2 instances run (e.g. `ap-south-1`).
5. **Object Ownership:** Keep **ACLs disabled (recommended)**.
6. **Block Public Access settings:** Keep **Block all public access** checked. All access goes through the backend API via IAM credentials.
7. Click **Create bucket**.
8. Note down your bucket name for the backend configuration.

---

### Step 7: Verify SimpleDB Metadata Domain

The backend application contains automated initialization logic (`ensureDomain()`). When the backend boots for the first time, it checks for and creates the SimpleDB domain `student_files_metadata` automatically if it does not already exist.

*(Optional)* You can also initialize the domain manually using the AWS CLI:
```bash
aws sdb create-domain --domain-name student_files_metadata --region ap-south-1
```

---

### Step 8: Create the CloudWatch Log Group

1. Search for **CloudWatch** in the AWS console search bar and open it.
2. In the left menu, expand **Logs** and click **Log groups**.
3. Click **Create log group**.
4. **Log group name:** Enter:
   ```
   /aws/student-file-manager/backend
   ```
5. **Retention setting:** Select **7 days** (avoids accumulation of stale logs).
6. Click **Create**.

*Metrics Note:* The application publishes metrics to the `StudentFileManager` namespace automatically on file upload and API calls. There is no manual creation required for metrics.

---

## 6. Phase 4: Deploy Application Code to Instances

### Step 9: Deploy Backend on `backend-1`

1. Go to **EC2** -> **Instances**, check **`backend-1`**, and click **Connect** at the top right.
2. In the **EC2 Instance Connect** tab, verify the username is `ubuntu` and click **Connect**. A terminal window opens in your browser.
3. Paste and run the following script block:

```bash
# 1. Update system and install Node.js 20, Git, and PM2
sudo apt-get update -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo npm install -g pm2

# 2. Prepare app directory
sudo mkdir -p /opt/app
sudo chown -R ubuntu:ubuntu /opt/app
cd /opt/app

# 3. Clone repository
git clone https://github.com/vansh917917/cc-aws.git .

# 4. Install backend dependencies
cd /opt/app/backend
npm install

# 5. Write production environment file
# Note: Update AWS_REGION and AWS_S3_BUCKET_NAME to your actual values
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

# 6. Start the application with PM2 and configure boot startup
pm2 start src/server.js --name "student-api"
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# 7. Test the health endpoint
curl http://localhost:5000/api/health
```

Verify that the health check output returns JSON indicating `"status": "ok"` and `"driver": "s3"`.

---

### Step 10: Deploy Backend on `backend-2`

1. In the EC2 Instances list, select **`backend-2`** and click **Connect**.
2. Connect via **EC2 Instance Connect**.
3. Run the exact same script block as Step 9, with one edit: change `INSTANCE_ID=backend-1` to `INSTANCE_ID=backend-2` in the `.env` creation block:

```bash
sudo apt-get update -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo npm install -g pm2

sudo mkdir -p /opt/app
sudo chown -R ubuntu:ubuntu /opt/app
cd /opt/app
git clone https://github.com/vansh917917/cc-aws.git .

cd /opt/app/backend
npm install

cat <<'EOF' > .env
PORT=5000
NODE_ENV=production
INSTANCE_ID=backend-2
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

pm2 start src/server.js --name "student-api"
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

curl http://localhost:5000/api/health
```

---

### Step 11: Deploy Frontend on `frontend-1`

1. In the EC2 Instances list, select **`frontend-1`** and click **Connect**.
2. Open **EC2 Instance Connect** and click **Connect**.
3. Paste and run the following deployment commands:

```bash
# 1. Install Nginx and Git
sudo apt-get update -y
sudo apt-get install -y nginx git

# 2. Clear default Nginx web root
sudo rm -rf /var/www/html/*

# 3. Clone repository and copy frontend assets
git clone https://github.com/vansh917917/cc-aws.git /tmp/cc-aws
sudo cp -r /tmp/cc-aws/frontend/* /var/www/html/
rm -rf /tmp/cc-aws

# 4. Restart and enable Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

4. Copy the **Public IPv4 address** of `frontend-1` from the EC2 console and open `http://<FRONTEND-1-PUBLIC-IP>` in your browser to verify the dashboard loads.

---

### Step 12: Deploy Frontend on `frontend-2`

1. Select **`frontend-2`** in the EC2 Console and connect via **EC2 Instance Connect**.
2. Run the same commands from Step 11:

```bash
sudo apt-get update -y
sudo apt-get install -y nginx git
sudo rm -rf /var/www/html/*
git clone https://github.com/vansh917917/cc-aws.git /tmp/cc-aws
sudo cp -r /tmp/cc-aws/frontend/* /var/www/html/
rm -rf /tmp/cc-aws
sudo systemctl restart nginx
sudo systemctl enable nginx
```

3. Open `http://<FRONTEND-2-PUBLIC-IP>` in your browser to confirm the UI is active.

---

## 7. Phase 5: Application Load Balancer Setup

The ALB binds both frontend servers and both backend servers under one unified DNS address, performing path-based routing.

### Step 13: Create the Frontend Target Group

1. In the EC2 console left menu, scroll down to **Load Balancing** and click **Target Groups**.
2. Click **Create target group**.
3. **Target type:** Select **Instances**.
4. **Target group name:** Enter `tg-frontend-80`.
5. **Protocol:** `HTTP`, **Port:** `80`.
6. **VPC:** Default VPC.
7. **Health check path:** `/`.
8. Click **Next**.
9. Under **Available instances**, select both **`frontend-1`** and **`frontend-2`**.
10. Click **Include as pending below**.
11. Click **Create target group**.

---

### Step 14: Create the Backend Target Group

1. Click **Create target group**.
2. **Target type:** Select **Instances**.
3. **Target group name:** Enter `tg-backend-5000`.
4. **Protocol:** `HTTP`, **Port:** `5000`.
5. **VPC:** Default VPC.
6. **Health check path:** Enter `/api/health`.
7. Click **Next**.
8. Select both **`backend-1`** and **`backend-2`**.
9. Click **Include as pending below**.
10. Click **Create target group**.

---

### Step 15: Create the Load Balancer

1. In the left navigation, click **Load Balancers**, then click **Create load balancer**.
2. Under **Application Load Balancer**, click **Create**.
3. **Load balancer name:** Enter `student-app-alb`.
4. **Scheme:** `Internet-facing`.
5. **IP address type:** `IPv4`.
6. **Network mapping:**
   - Select your default VPC.
   - Under **Mappings**, check the boxes for **at least two Availability Zones** (for example: `ap-south-1a` and `ap-south-1b`).
7. **Security groups:**
   - Select `frontend-sg` (allows HTTP Port 80).
   - Uncheck `default` if it is selected.
8. **Listeners and routing:**
   - Protocol: `HTTP`, Port: `80`.
   - Default action: Forward to **`tg-frontend-80`**.
9. Click **Create load balancer**.

---

### Step 16: Configure Path-Based Routing Rule

1. Click on the newly created load balancer (`student-app-alb`).
2. Select the **Listeners and rules** tab.
3. Click the **HTTP:80** listener.
4. Click **Add rule**.
5. **Rule name:** Enter `api-routing`.
6. Under **Conditions**, click **Add condition**:
   - Choose **Path**.
   - Enter `/api*`.
   - Click **Confirm**, then click **Next**.
7. Under **Actions**, select **Forward to target groups**:
   - Choose **`tg-backend-5000`**.
   - Click **Next**.
8. **Priority:** Set priority to `1`, click **Next**, and click **Create**.

Traffic matching `/api*` is now forwarded to the backend instances on port 5000, while all other traffic (`/*`) routes to frontend Nginx on port 80.

---

## 8. Phase 6: End-to-End Verification

1. Go to **EC2** -> **Load Balancers** and select `student-app-alb`.
2. Copy the **DNS name** (for example: `http://student-app-alb-123456789.ap-south-1.elb.amazonaws.com`).
3. Open this URL in any web browser:
   - **Frontend Check:** The web UI loads over port 80.
   - **Backend Routing Check:** The status indicator badge in the top-right header updates to a green **Connected** status, and the Storage Driver displays **S3**.
   - **S3 Upload Check:** Upload a test document (`.pdf`, `.png`, `.txt`). The upload progress bar reaches 100%, and the file appears in the active file list table.
   - **SimpleDB Verification:** The uploaded file record is queryable and shows metadata (size, upload timestamp, MIME type).
   - **CloudWatch Logs Verification:** Open AWS CloudWatch -> **Log groups** -> `/aws/student-file-manager/backend`. Click the latest log stream to inspect live HTTP access and upload logs.
   - **CloudWatch Metrics Verification:** Open CloudWatch -> **Metrics** -> **All metrics** -> select `StudentFileManager` to observe custom counters (`FileUploadCount`, `ApiRequestLatency`).

---

## 9. Troubleshooting and New Account Gotchas

1. **EC2 Instance Connect fails with timeout:**
   - *Cause:* The security group (`frontend-sg` or `backend-sg`) lacks an inbound rule for SSH Port 22 from `0.0.0.0/0`.
   - *Fix:* In EC2 -> Security Groups, edit inbound rules and ensure Port 22 is open to `0.0.0.0/0`. Verify the login user is `ubuntu`.

2. **Frontend UI displays 404 when testing an EC2 IP directly:**
   - *Cause:* Accessing `http://<FRONTEND-IP>` directly looks for `/api` on that frontend server where no backend is running.
   - *Fix:* Always access the system using the **Load Balancer DNS URL**, which performs path-based routing. If direct EC2 testing is needed, click the "API Connection" button in the web UI and enter `http://<BACKEND-IP>:5000/api`.

3. **vCPU Quota Exceeded on fresh AWS accounts:**
   - *Cause:* New AWS accounts are restricted to 8 vCPUs for standard EC2 instances. Launching five `t3.micro` instances (10 vCPUs) fails.
   - *Fix:* Keep to exactly 4 instances (2 frontend, 2 backend) or switch to `t2.micro` (1 vCPU each).

4. **S3 Bucket Creation Error (BucketAlreadyExists):**
   - *Cause:* S3 bucket names are globally unique across all AWS accounts worldwide.
   - *Fix:* Append random numbers or your name (e.g. `student-files-storage-vansh-917917`). Update the `AWS_S3_BUCKET_NAME` in both backend `.env` files accordingly.

5. **Backend fails with AccessDenied or CredentialProviderError:**
   - *Cause:* The IAM Role was not attached to the backend EC2 instance, or permissions are missing.
   - *Fix:* In the EC2 Console, select the backend instance -> **Actions** -> **Security** -> **Modify IAM role** -> ensure `StudentFileEC2Role` is attached.

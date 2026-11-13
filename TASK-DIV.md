# Project Task Division: Student File Management System (AWS)

This document outlines the four-way division of technical responsibilities, underlying cloud concepts, and exact AWS configuration steps for the Cloud Computing (CC) project presentation.

---

## Team Roster, Owned AWS Services, and Speaking Order

| Speaking Order | Member | Assigned Focus Area | Owned AWS Services | Key Deliverable |
| :--- | :--- | :--- | :--- | :--- |
| **1st Speaker** | **Sudhanshu** | Architecture, Security & Object Storage | **IAM**, **Amazon S3** | Least-privilege IAM Role/Policy, S3 Bucket configuration, System Architecture design |
| **2nd Speaker** | **Sanjana** | Compute, Block Storage & NoSQL Metadata | **Amazon EC2**, **Amazon EBS**, **Amazon SimpleDB** | Security Groups, EC2 Launch, gp3 EBS setup, SimpleDB metadata domain & indexing |
| **3rd Speaker** | **Shalini** | Ingress Traffic Routing & High Availability | **Application Load Balancer (ALB)** | Dual Target Groups, ALB path routing (`/api*`), health checks & failover |
| **4th Speaker** | **Vansh** | Observability, Telemetry & Anomaly Detection | **Amazon CloudWatch** | CloudWatch Log Groups, custom metrics & namespace, CloudWatch Alarms |

---

## Speaker 1: Sudhanshu
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

## Speaker 2: Sanjana
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

## Speaker 3: Shalini
### Focus: Ingress Traffic Routing and Load Balancing (Application Load Balancer)

### 1. Underlying Cloud Concepts
- **Layer 7 Path-Based Routing:** An Application Load Balancer operates at Layer 7 (HTTP/HTTPS) of the OSI model. By inspecting incoming HTTP request paths, a single public DNS endpoint routes static asset requests (`/*`) to port 80 on the frontend web tier and API transactions (`/api*`) to port 5000 on the backend tier.
- **Target Group Health Checking:** The ALB sends periodic synthetic HTTP health check probes (`/` on port 80, `/api/health` on port 5000). If an instance fails consecutive checks, the ALB stops routing traffic to that instance automatically, ensuring zero user impact.
- **High Availability and Fault Tolerance:** Traffic is distributed across multiple availability zones (`ap-south-1a`, `ap-south-1b`), eliminating single points of failure across the infrastructure.

### 2. AWS Steps and Exact Commands Executed
1. **Target Groups Setup:**
   - Created `tg-frontend-80`: Protocol HTTP, Port 80, Health check path `/`, registered `frontend-1` and `frontend-2`.
   - Created `tg-backend-5000`: Protocol HTTP, Port 5000, Health check path `/api/health`, registered `backend-1` and `backend-2`.
2. **Application Load Balancer Creation:**
   - Created `student-app-alb`: Scheme **Internet-facing**, IPv4, default VPC spanning subnets `ap-south-1a` and `ap-south-1b`.
   - Attached Security Group: `frontend-sg` (Port 80 HTTP).
   - Listener HTTP:80 default forward action: Forward to `tg-frontend-80`.
3. **Configured Path-Based Routing Rule:**
   - Selected HTTP:80 Listener -> Added rule:
     - Condition: Path is `/api*`.
     - Action: Forward to `tg-backend-5000`.
     - Priority: `1`.

### 3. Verification and Evidence
- Live ALB DNS URL (`http://student-app-alb-1149279081.ap-south-1.elb.amazonaws.com`) loads the FileVault dashboard with a green "Connected" status.
- Both target groups display instances in the **Healthy** state in the EC2 Load Balancing console.

---

## Speaker 4: Vansh
### Focus: Telemetry, Observability, and Proactive Alerting (Amazon CloudWatch)

### 1. Underlying Cloud Concepts
- **Centralized Cloud Observability:** Rather than storing logs locally on individual VM disks (which are lost if an instance is terminated), Amazon CloudWatch centralizes all application logs and operational metrics in one managed location.
- **Custom Application Metrics:** Beyond standard hypervisor metrics (CPU/Network), CloudWatch enables custom business metrics (`FileUploadCount`, `FileDeleteCount`, `ApiRequestLatency`, `UploadedFileSizeBytes`) to monitor operational performance in real time.
- **Automated Metric Alarms:** CloudWatch Alarms continuously evaluate metric data points against static thresholds. When an anomaly occurs (such as high API latency), the alarm changes state and can trigger alerts or automated remediations.

### 2. AWS Steps and Exact Commands Executed
1. **CloudWatch Log Group Creation:**
   - Navigated to **CloudWatch** -> **Logs** -> **Log groups**.
   - Created Log Group:
     ```
     /aws/student-file-manager/backend
     ```
   - Configured retention period to **7 days** to optimize log storage costs.
2. **Custom Metrics Verification:**
   - In CloudWatch console, navigated to **Metrics** -> **All metrics**.
   - Verified custom namespace **`StudentFileManager`**.
   - Monitored metrics:
     - `ApiRequestCount`: Total incoming requests.
     - `ApiRequestLatency`: Response latency in milliseconds.
     - `FileUploadCount`: Successful file uploads.
     - `UploadedFileSizeBytes`: Uploaded payload size in bytes.
3. **CloudWatch Alarm Creation:**
   - Navigated to **CloudWatch** -> **Alarms** -> **Create alarm**.
   - Selected metric: `StudentFileManager` -> `ApiRequestLatency`.
   - Metric condition: **Static**, Greater than or equal to **`1000 ms`** for 1 evaluation period (1 minute).
   - Alarm name: `backend-api-latency-alarm`.
   - Configured alarm state triggers (`In alarm`, `OK`).

### 3. Verification and Evidence (What to Show in Viva/Demo)
- **Live Logs:** In CloudWatch Log Groups, open `/aws/student-file-manager/backend` and display live log streams capturing backend API requests and health checks.
- **Live Metrics Dashboard:** Show the `StudentFileManager` metric graphs with real-time spikes corresponding to test file uploads and API calls.
- **Alarm Status:** Show `backend-api-latency-alarm` in the green **OK** state in the CloudWatch Alarms dashboard.

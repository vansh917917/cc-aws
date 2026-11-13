# Presentation Speaking Scripts: Student File Management System (AWS)

This document contains word-for-word speaking scripts, slide cues, speaker transitions, and teacher Q&A preparation for all 4 team members.

---

## Presentation Overview and Timing

| Speaking Order | Speaker | Section | Target Time | Key AWS Services Covered |
| :--- | :--- | :--- | :--- | :--- |
| **1st Speaker** | **Sudhanshu** | Introduction, System Architecture & Storage Security | 2.5 - 3.0 min | **IAM**, **Amazon S3** |
| **2nd Speaker** | **Sanjana** | Compute Infrastructure, EBS & NoSQL Metadata | 2.5 - 3.0 min | **Amazon EC2**, **Amazon EBS**, **Amazon SimpleDB** |
| **3rd Speaker** | **Shalini** | Ingress Traffic Routing & High Availability | 2.5 - 3.0 min | **Application Load Balancer (ALB)** |
| **4th Speaker** | **Vansh** | Telemetry, Observability, Alarms & Live Demo | 3.0 - 3.5 min | **Amazon CloudWatch** |
| **Total** | | Full Group Presentation & Live Demonstration | **11 - 12.5 min** | **All 7 AWS Services** |

---

## Speaker 1: Sudhanshu
### Focus: Project Introduction, Architecture Strategy, IAM Security, and Amazon S3

#### [Screen / Slide Cue: Project Title & High-Level Architecture Diagram]

**Spoken Script:**

> "Good morning respected professors and fellow students. Today, our team is presenting our Cloud Computing project: a decoupled, highly available **Student File Management System** deployed on Amazon Web Services.
> 
> When designing cloud applications, one of the most common pitfalls is building monolithic systems where the web server, application logic, and file storage all live on a single virtual machine. If that single server experiences high load or crashes, your entire application goes down. 
> 
> To solve this, our project implements a production-grade, three-tier cloud architecture utilizing seven core AWS services: EC2, EBS, IAM, S3, SimpleDB, CloudWatch, and an Application Load Balancer.
> 
> My specific responsibility was laying the security foundations and setting up persistent object storage.
> 
> First, for security, we used **AWS IAM**. In amateur deployments, developers often hardcode static AWS Access Keys and Secret Keys inside configuration files. If that code is pushed to GitHub, those credentials can be compromised in minutes. 
> 
> To eliminate this vulnerability, we implemented the principle of least privilege using an **IAM Instance Profile**. We created a custom policy named `StudentFileAppPolicy` that grants strictly necessary permissions for S3, SimpleDB, and CloudWatch. We attached this policy to a role called `StudentFileEC2Role` and assigned it directly to our backend EC2 instances. 
> 
> This means our Node.js code automatically retrieves short-lived, auto-rotating credentials from the EC2 Instance Metadata Service without storing a single password on disk.
> 
> Second, for file storage, we provisioned an **Amazon S3 bucket** named `student-files-storage-vansh-2026`. Unlike local instance storage, S3 provides eleven nines of data durability and infinite scale. We configured the bucket with 'Block all public access' enabled, ensuring that students can never access or scrape files directly from S3. Every upload, download, and delete request must authenticate through our backend API.
> 
> Now, to explain how our virtual compute instances, block storage, and metadata indexing were engineered, I will hand over to Sanjana."

#### Potential Teacher Viva Questions for Sudhanshu:
- **Q: Why not just store the files on the EC2 hard drive?**
  - *Answer:* EC2 instance storage is tied to a single machine. If a user uploads on server 1, server 2 cannot see that file. Furthermore, EC2 instances are ephemeral. If an instance terminates, the files are lost. S3 decouples storage from compute.
- **Q: How does the backend talk to S3 without AWS access keys in `.env`?**
  - *Answer:* Through an IAM Instance Profile. The AWS SDK for JavaScript v3 automatically checks the EC2 Instance Metadata Service at `169.254.169.254` and fetches temporary credentials.

---

## Speaker 2: Sanjana
### Focus: Virtual Compute (EC2), Block Storage (EBS), and NoSQL Metadata (SimpleDB)

#### [Screen / Slide Cue: EC2 Console, Security Groups, SimpleDB Architecture]

**Spoken Script:**

> "Thank you, Sudhanshu. 
> 
> My responsibility was architecting the compute infrastructure, persistent block storage, and the NoSQL metadata layer.
> 
> For our compute tier, we deployed **four Amazon EC2 instances** running Ubuntu 24.04 LTS across multiple Availability Zones in the Mumbai region:
> - Two instances, `frontend-1` and `frontend-2`, act as our presentation web tier.
> - Two instances, `backend-1` and `backend-2`, run our application API tier.
> 
> A critical engineering challenge we encountered and solved during deployment was AWS account quotas. In modern AWS accounts, there is a default quota limit of 8 vCPUs for standard on-demand instances. Because `t3.micro` instances provide 2 vCPUs each, running four instances consumed `4 x 2 = 8 vCPUs` exactly. This required careful capacity planning to ensure our instances did not exceed account limits while maintaining high availability.
> 
> Next, for our operating system and runtime storage, we attached **Amazon EBS (Elastic Block Store)** gp3 volumes to each instance. Unlike ephemeral instance storage, EBS volumes are network-attached SSDs that persist even when instances are stopped and restarted. We configured 20 GiB gp3 volumes per instance, delivering a baseline performance of 3,000 IOPS and 125 MB/s throughput for fast application boot times.
> 
> To isolate our servers, we configured dedicated **Security Groups**:
> - `frontend-sg` permits HTTP traffic on port 80 and SSH on port 22.
> - `backend-sg` permits Custom TCP traffic on port 5000 strictly for API communication, alongside SSH on port 22.
> 
> Finally, we integrated **Amazon SimpleDB**. While S3 stores the physical file binary, searching S3 directly for file properties is slow and costly. We initialized a SimpleDB domain called `student_files_metadata`. Whenever a student uploads a document, our backend records structured key-value attributes: the original filename, file size, MIME type, upload timestamp, and the S3 key. 
> 
> This gives us a dedicated NoSQL catalog that allows instant queries using SQL-like syntax such as `select * from student_files_metadata`.
> 
> I will now pass the presentation to Shalini to explain how incoming user traffic was balanced and routed across these servers."

#### Potential Teacher Viva Questions for Sanjana:
- **Q: What is the difference between EBS and S3?**
  - *Answer:* EBS is block storage mounted directly as a virtual hard drive for the operating system and running processes. S3 is object storage accessed over HTTP through an API, designed for unstructured files like PDFs and images.
- **Q: Why use SimpleDB instead of a traditional relational database like MySQL?**
  - *Answer:* For file metadata, we need simple schema-less key-value pairs without relational joins. SimpleDB requires zero server maintenance, scales automatically, and allows fast attribute querying.

---

## Speaker 3: Shalini
### Focus: Application Load Balancer (ALB), Path-Based Routing & High Availability

#### [Screen / Slide Cue: Load Balancer Architecture, Target Groups Console, Routing Rules]

**Spoken Script:**

> "Thank you, Sanjana.
> 
> My responsibility was engineering the traffic ingress layer using an **Application Load Balancer (ALB)** to provide single-endpoint access, intelligent routing, and high availability.
> 
> In a production cloud deployment, client browsers should never communicate directly with individual EC2 instance IP addresses. Doing so exposes internal IP addresses, creates cross-origin resource sharing (CORS) complications, and fails if any single instance crashes.
> 
> To solve this, we provisioned an Internet-facing Application Load Balancer named `student-app-alb` spanning across multiple availability zones. Operating at Layer 7 of the OSI model, our ALB performs intelligent **path-based routing**:
> - We created two Target Groups: `tg-frontend-80` on port 80, and `tg-backend-5000` on port 5000.
> - We registered `frontend-1` and `frontend-2` into `tg-frontend-80`.
> - We registered `backend-1` and `backend-2` into `tg-backend-5000`.
> - The ALB listener evaluates incoming traffic: any request matching the path pattern `/api*` is forwarded directly to `tg-backend-5000`.
> - All default traffic (`/*`) forwards to `tg-frontend-80`.
> 
> This provides users with one unified public entry point: `http://student-app-alb-1149279081.ap-south-1.elb.amazonaws.com`.
> 
> Furthermore, the ALB continuously sends synthetic health check probes. If either backend server fails its health check on `/api/health`, the ALB drops that server from rotation within seconds and routes 100% of requests to the healthy instance, giving our users zero downtime.
> 
> Now, to explain how we monitor system health, collect telemetry, and handle alarms across our running cloud infrastructure, I hand over to Vansh."

#### Potential Teacher Viva Questions for Shalini:
- **Q: How does the Load Balancer distinguish between frontend and backend traffic?**
  - *Answer:* Through Layer 7 Path-Based Routing. The ALB listener inspects the HTTP request URI. Requests matching `/api*` are forwarded to the backend target group on port 5000, while all other requests default to the frontend target group on port 80.
- **Q: What happens if `backend-1` crashes?**
  - *Answer:* The ALB health check on `/api/health` will fail for `backend-1`. The ALB will automatically route all API traffic to `backend-2`, so users experience zero interruption.

---

## Speaker 4: Vansh
### Focus: Telemetry, Observability, Custom Metrics, Alarms (Amazon CloudWatch) & Live Demo

#### [Screen / Slide Cue: CloudWatch Log Groups, Metrics Dashboard, CloudWatch Alarm, Live Browser Demo]

**Spoken Script:**

> "Thank you, Shalini.
> 
> My responsibility was engineering the observability, telemetry, and automated alerting system using **Amazon CloudWatch**.
> 
> In a production cloud system with multiple distributed instances, you cannot log in via SSH to every virtual machine to read local log files. If an instance auto-scales down or crashes, its local disk logs are lost forever. You also have no real-time visibility into whether users are experiencing slow API response times.
> 
> To solve this, we implemented Amazon CloudWatch across three distinct layers:
> 
> First, **Centralized Logging with CloudWatch Logs**:
> We provisioned a log group named `/aws/student-file-manager/backend`. Using the AWS SDK v3 in our backend API, every HTTP request, upload confirmation, and application warning is streamed to CloudWatch in real time. We set a 7-day retention period to optimize log storage costs while preserving operational history.
> 
> Second, **Custom Telemetry Metrics with CloudWatch Metrics**:
> Standard EC2 metrics only report basic CPU utilization and network bytes. To monitor true application performance, we created a custom CloudWatch metric namespace called `StudentFileManager`. Our application code publishes four custom time-series metrics:
> 1. `ApiRequestCount`: Tracking total traffic volume.
> 2. `ApiRequestLatency`: Measuring API response times in milliseconds.
> 3. `FileUploadCount`: Tracking successful file submissions.
> 4. `UploadedFileSizeBytes`: Monitoring data throughput into our storage layer.
> 
> Each metric is tagged with dimensions such as `InstanceId` and `Environment`, allowing us to isolate performance bottlenecks down to a specific virtual machine.
> 
> Third, **Proactive Alerting with CloudWatch Alarms**:
> We configured an automated alarm named `backend-api-latency-alarm`. It continuously evaluates `ApiRequestLatency`. If the average response latency reaches or exceeds 1,000 milliseconds over a 1-minute evaluation period, the alarm automatically shifts from the green `OK` state into the red `ALARM` state to notify system administrators before users are impacted.
> 
> Now, let us demonstrate the live system.
> 
> *(Switch to browser showing the live ALB URL)*
> 
> As you can see, loading our ALB DNS URL loads the FileVault interface immediately. The status badge displays green 'Connected' and confirms our storage driver is Amazon S3.
> 
> *(Upload a file live on screen)*
> 
> When we upload a document, it routes through the Application Load Balancer to an active backend EC2 instance, stores the file in S3, indexes the metadata in SimpleDB, and emits telemetry to CloudWatch.
> 
> *(Switch to CloudWatch Console)*
> 
> In the CloudWatch console under Log Groups, you can see our live log stream capturing the upload transaction with exact timestamps. Under Metrics in the `StudentFileManager` namespace, the `ApiRequestCount` and `FileUploadCount` graphs reflect our activity immediately, while our `backend-api-latency-alarm` remains in the healthy `OK` state.
> 
> This completes our presentation. We have successfully deployed a decoupled, highly available, and observable cloud system using seven core AWS services. We are now happy to take any questions."

#### Potential Teacher Viva Questions for Vansh:
- **Q: Why use CloudWatch instead of storing logs locally on the EC2 instances?**
  - *Answer:* EC2 instances are ephemeral and can be terminated or replaced by auto-scaling. Local logs would be permanently lost. CloudWatch centralizes logs from all instances into one durable, searchable repository.
- **Q: How does your backend code authenticate with CloudWatch?**
  - *Answer:* Through the IAM Instance Profile attached to the EC2 instances (`StudentFileEC2Role`). The AWS SDK automatically retrieves temporary credentials from the Instance Metadata Service (IMDS), so no hardcoded keys are stored in our code.
- **Q: What is a CloudWatch Metric Dimension?**
  - *Answer:* A dimension is a key-value attribute that categorizes and filters metric data. We tag our metrics with `InstanceId` and `Environment` so we can analyze performance per server or across the whole fleet.
- **Q: What are the three states of a CloudWatch Alarm?**
  - *Answer:* `OK` (metric is within acceptable threshold), `ALARM` (metric has breached the threshold condition), and `INSUFFICIENT_DATA` (not enough data points have arrived to determine state).

# Presentation Speaking Scripts: Student File Management System (AWS)

This document contains word-for-word speaking scripts, slide cues, speaker transitions, and teacher Q&A preparation for all 4 team members.

---

## Presentation Overview & Timing

| Speaker | Section | Target Time | Key AWS Services Covered |
| :--- | :--- | :--- | :--- |
| **Sudhanshu** | Introduction, System Architecture & Storage Security | 2.5 - 3.0 min | **IAM**, **Amazon S3** |
| **Sanjana** | Compute Infrastructure, EBS & NoSQL Metadata | 2.5 - 3.0 min | **Amazon EC2**, **Amazon EBS**, **Amazon SimpleDB** |
| **Vansh** | Full-Stack Application Deployment & High Availability | 2.5 - 3.0 min | **Nginx Web Tier**, **Node.js API & PM2** |
| **Shalini** | Ingress Traffic Routing, Telemetry & Live Demo | 3.0 - 3.5 min | **Application Load Balancer**, **Amazon CloudWatch** |
| **Total** | Full Group Presentation & Live Demonstration | **11 - 12.5 min** | **All 7 AWS Services** |

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
> First, for security, we used **AWS IAM**. In amateur deployments, developers often hardcode static AWS Access Keys and Secret Keys inside `.env` configuration files. If that code is pushed to GitHub, those credentials can be compromised in minutes. 
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
> I will now pass the presentation to Vansh to explain how our full-stack application code was deployed and managed across these servers."

#### Potential Teacher Viva Questions for Sanjana:
- **Q: What is the difference between EBS and S3?**
  - *Answer:* EBS is block storage mounted directly as a virtual hard drive for the operating system and running processes. S3 is object storage accessed over HTTP through an API, designed for unstructured files like PDFs and images.
- **Q: Why use SimpleDB instead of a traditional relational database like MySQL?**
  - *Answer:* For file metadata, we need simple schema-less key-value pairs without relational joins. SimpleDB requires zero server maintenance, scales automatically, and allows fast attribute querying.

---

## Speaker 3: Vansh
### Focus: Application Deployment, Nginx Web Server, Node.js API, and PM2 Process Supervision

#### [Screen / Slide Cue: Terminal Sessions, PM2 Status, Frontend Dashboard]

**Spoken Script:**

> "Thank you, Sanjana.
> 
> My focus was deploying, configuring, and supervising the full-stack software application across all four EC2 instances.
> 
> On the frontend servers (`frontend-1` and `frontend-2`), we installed **Nginx**, a high-performance, asynchronous web server. We configured Nginx to serve our static single-page application directly from `/var/www/html`. Because Nginx operates on an event-driven architecture, it serves HTML, CSS, and client-side JavaScript with minimal memory overhead, easily handling hundreds of concurrent users.
> 
> On the backend servers (`backend-1` and `backend-2`), we deployed our **Node.js Express REST API**. We installed Node.js version 20 LTS and utilized Multer for handling multipart file upload streams. 
> 
> In a production environment, running Node.js with a simple `node server.js` command is unacceptable. If an unhandled exception occurs, the process terminates and the API goes offline. 
> 
> To ensure continuous availability, we implemented **PM2**, an enterprise-grade production process manager. PM2 runs our API as a background daemon named `student-api`, automatically reboots worker processes if they crash, and hooks directly into the Linux `systemd` init system. This guarantees that if AWS reboots an instance for maintenance, our API starts up automatically without human intervention.
> 
> In our application configuration, we dynamically connected our services via an environment file (`.env`). We configured `STORAGE_DRIVER=s3`, pointed `AWS_S3_BUCKET_NAME` to our S3 bucket, enabled `ENABLE_SIMPLEDB=true`, and activated `ENABLE_CLOUDWATCH=true`.
> 
> We verified our application tier using automated health check endpoints. Running `curl http://localhost:5000/api/health` returns a complete JSON payload verifying that S3, SimpleDB, and CloudWatch connections are all healthy.
> 
> At this stage, however, our frontend and backend were on separate IP addresses. To demonstrate how we unified these instances under one URL and set up system observability, I hand over to Shalini."

#### Potential Teacher Viva Questions for Vansh:
- **Q: What is the role of PM2? Why not run node in the background using `nohup` or `&`?**
  - *Answer:* `nohup` does not restart the process if it crashes with an uncaught exception, nor does it automatically revive the application upon system reboot. PM2 manages process lifecycle, restarts crashed workers, and integrates with Linux systemd.
- **Q: What does the `/api/health` endpoint do?**
  - *Answer:* It acts as our application heartbeat. It checks server uptime and verifies the active storage driver, bucket connectivity, and SimpleDB status. This endpoint is used by our Load Balancer for health checks.

---

## Speaker 4: Shalini
### Focus: Application Load Balancer (ALB), Path-Based Routing, CloudWatch Observability & Live Demo

#### [Screen / Slide Cue: Load Balancer Architecture, CloudWatch Metrics / Alarms, Live Browser Demo]

**Spoken Script:**

> "Thank you, Vansh.
> 
> My responsibility was engineering the traffic ingress layer using an **Application Load Balancer (ALB)** and establishing full observability using **Amazon CloudWatch**.
> 
> Initially, accessing the frontend directly caused a 404 error because the frontend had no direct connection to the backend. In production cloud architecture, clients should never speak directly to individual EC2 IP addresses.
> 
> To solve this, we provisioned an Internet-facing Application Load Balancer named `student-app-alb`. Operating at Layer 7 of the OSI model, our ALB performs intelligent **path-based routing**:
> - We created two Target Groups: `tg-frontend-80` on port 80, and `tg-backend-5000` on port 5000.
> - The ALB listener evaluates incoming traffic: any request matching the path pattern `/api*` is forwarded directly to `tg-backend-5000`.
> - All default traffic (`/*`) forwards to `tg-frontend-80`.
> 
> This provides our users with one single unified entry point: `http://student-app-alb-1149279081.ap-south-1.elb.amazonaws.com`. Furthermore, the ALB continuously sends heartbeat health checks. If any instance fails, the ALB automatically removes it from the routing pool.
> 
> Next, for monitoring and operations, we implemented **Amazon CloudWatch**:
> 1. **CloudWatch Logs:** We configured a log group named `/aws/student-file-manager/backend`. Every incoming HTTP request and file operation is streamed in real time.
> 2. **CloudWatch Custom Metrics:** Our backend code publishes custom metrics into the `StudentFileManager` namespace. In our AWS console, we can see live metric streams for `ApiRequestCount`, `ApiRequestLatency`, and `FileListCount` coming from both `backend-1` and `backend-2`.
> 3. **CloudWatch Alarms:** We configured an active alarm named `backend-api-latency-alarm`. If API response latency exceeds 1000 milliseconds, the alarm triggers and alerts the operations team.
> 
> Now, let us demonstrate the live system.
> 
> *(Switch to browser showing the ALB URL)*
> 
> As you can see, loading our ALB DNS URL loads the FileVault interface immediately. The status badge displays green 'Connected' and indicates storage driver 'S3'.
> 
> *(Upload a file live on screen)*
> 
> We will now upload a document called `test-document.pdf`. When we click 'Upload File', the file is streamed across our Load Balancer, processed by our backend EC2, stored permanently in Amazon S3, indexed in SimpleDB, and logged in CloudWatch. The file appears in our table instantly.
> 
> Clicking 'Download' streams the file back directly from S3.
> 
> This concludes our presentation. We have successfully designed and demonstrated a fault-tolerant, scalable, and secure cloud system using seven core AWS services. We are now open for questions."

#### Potential Teacher Viva Questions for Shalini:
- **Q: How does the Load Balancer distinguish between frontend and backend traffic?**
  - *Answer:* Through Layer 7 Path-Based Routing. The ALB listener inspects the HTTP request URI. Requests matching `/api*` are forwarded to the backend target group on port 5000, while all other requests default to the frontend target group on port 80.
- **Q: What happens if `backend-1` crashes right now?**
  - *Answer:* The ALB health check on `/api/health` will fail for `backend-1`. The ALB will automatically route 100% of API traffic to `backend-2` within seconds, so users experience zero interruption.

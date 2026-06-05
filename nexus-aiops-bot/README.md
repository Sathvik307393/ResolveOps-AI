# Nexus AIOps SRE Dashboard

![Nexus AIOps](https://img.shields.io/badge/Status-Active-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue)

**Nexus AIOps** is an AI-powered Site Reliability Engineering (SRE) console that functions as a real-time operational RAG (Retrieval-Augmented Generation) system. It seamlessly integrates telemetry, CI/CD pipeline statuses, and AI-driven diagnostics to drastically reduce Mean Time To Resolution (MTTR) for complex distributed systems.

## 📖 Project Report & Overview

### 1. Problem Statement
In modern cloud-native architectures and microservices environments, system complexity has outpaced the human capacity to manually monitor, diagnose, and resolve operational incidents. When an outage or degradation occurs, Site Reliability Engineers (SREs) are often overwhelmed by fragmented telemetry data, disjointed logs, and alert fatigue. 

### 2. Current Challenges
*   **Alert Fatigue and Noise:** Traditional monitoring tools generate an overwhelming volume of alerts without distinguishing between root causes and symptomatic failures.
*   **Siloed Observability:** CI/CD pipelines (e.g., GitHub Actions), runtime container orchestration (e.g., Kubernetes), and application logs exist in separate portals, requiring operators to context-switch constantly during a crisis.
*   **Manual Diagnostic Overhead:** Identifying the root cause of complex failures requires specialized domain knowledge and tedious manual log analysis.

### 3. Proposed Solution
Nexus AIOps addresses these challenges by:
*   **Unified Telemetry Hub:** Aggregating GitHub CI/CD DevSecOps pipeline statuses, live Kubernetes pod cluster health, and application logs into a single pane of glass.
*   **Generative AI Diagnostics:** Utilizing RAG connected to Azure Log Analytics, Event Hubs, and Azure AI Search to instantly interpret stack traces and system states.
*   **Proactive Remediation:** Offering a "DevOps Suggestion Hub" and an interactive AI SRE Chat Assistant that maps runtime anomalies to verified, step-by-step action plans.

### 4. Real-World Use Cases
*   **Financial Technology (FinTech):** Rapidly diagnosing transaction gateway timeouts to prevent financial loss and SLA breaches.
*   **E-Commerce Platforms:** Monitoring inventory databases during high-traffic events and automatically alerting on connection pool exhaustion before complete failure.
*   **Cybersecurity Operations:** Instantly detecting and correlating brute-force authentication attempts across distributed auth-services, enabling automated IP blocking.

### 5. Competitive Advantage
Unlike traditional APM tools (e.g., Datadog, Dynatrace) which are heavily metric-focused, Nexus AIOps uniquely blends the conversational flexibility of Large Language Models with strict, retrieval-augmented grounding from the organization's own historical incident logs and architecture documentation. This actively *converses* with SREs about their specific architecture, significantly lowering the barrier to entry for junior DevOps engineers.

---

## 🚀 Getting Started

### Prerequisites
* Docker and Docker Compose
* Git

### Installation & Running Locally

1. **Clone the repository:**
   ```bash
   git clone <your-repository-url>
   cd NexusAI/nexus-aiops-bot
   ```

2. **Start the application using Docker Compose:**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

3. **Access the Application:**
   Open your browser and navigate to `https://nexusai.sathvikdevops.online` (or `http://nexusai.sathvikdevops.online`) to access the Streamlit Dashboard.

### Stopping the Application
To stop the running containers:
```bash
docker-compose down
```

---

## 🛣️ Implementation Roadmap
*   **Phase 1: Prototype & Integration:** Core Streamlit dashboard, GitHub Actions API integration, and simulated telemetry.
*   **Phase 2: RAG Engine & Cloud Sync:** Deploy Azure Log Analytics & AI Search, and integrate LangChain/OpenAI backend.
*   **Phase 3: Beta Testing & Security Hardening:** Pilot with microservices, implement RBAC, JWT authentication.
*   **Phase 4: Real-World Deployment:** Roll out to production, integrate with live Event Hubs, and begin iterative feedback loops.

---

*This project report/documentation is designed for academic presentations, investor discussions, and technical onboarding.*

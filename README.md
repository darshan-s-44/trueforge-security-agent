# 🛡️ TrueForge: Secure Data Erasure & Advanced File Recovery Tool
> **Built for TrueForge Hackathon** | **100% TrueForge Agent & MCP Standard Compliant**

---

## 📌 Executive Summary
**TrueForge Security Agent** is an autonomous, agentic security tool designed to solve modern enterprise challenges around sensitive data exposure, soft-deleted file leakage, and unverified file destruction. Powered by the **TrueForge Agent Harness** and **Model Context Protocol (MCP)**, this system automates forensic file discovery, content risk classification, sandbox simulation, human-in-the-loop authorization, and verified zero-overwrite erasure inside Docker containers.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph TrueForge Harness
        A[TrueForge Agent] --> B[MCP Client / Server]
    end

    subgraph MCP Tools Suite
        B -->|1. list_files| C[Storage & Manifest Investigator]
        B -->|2. scan_file| D[Python Classification Engine]
        B -->|3. simulate_erase| E[Sandbox Simulator]
        B -->|4. request_human_approval| F[UUID Token Manager]
        B -->|5. execute_erase| G[Docker Sandbox Execution]
    end

    subgraph Storage & Sandbox
        C --> H[(Target Drive)]
        C --> I[(Recycle Bin Manifest)]
        D -->|Regex / Content Scan| J[Classification Report]
        E -->|Preview Plan| K[Simulation Breakdown]
        F -->|5-min TTL Token| L[Human Reviewer Chat UI]
        G -->|Validation Passed| M[Secure Zero Overwrite]
        G --> N[(JSON Audit Logger)]
```

---

## 🔁 6-Stage Autonomous Workflow

| Stage | Name | Description | Output / Metric |
|---|---|---|---|
| **1** | **Investigate** | Scans target storage directory & `recycle_bin.json` manifest. | Lists active files & soft-deleted items with metadata. |
| **2** | **Classify** | Content regex & MIME classification (SSN, credit card, credentials, junk). | Categorizes files into `RECOVERABLE`, `SENSITIVE`, `JUNK`, `NORMAL`. |
| **3** | **Simulate** | Runs simulation mode inside sandbox without modifying storage. | Calculates reclaimed bytes & proposed erasure list. |
| **4** | **Approval Req** | Issues a secure, 5-minute TTL UUID approval token. | Displays human authorization prompt in TrueForge UI. |
| **5** | **Human Gate** | Agent pauses until human reviewer confirms erasure action. | Validates token, TTL expiration, and target file list match. |
| **6** | **Execute** | Executes zero-overwrite deletion in Docker container & logs audit JSON. | Complete destruction & structured audit entry in `logs/`. |

---

## 🛠️ MCP Tool Registry (`mcp.config.json`)

The system exposes 5 dedicated MCP tools via stdio:

1. `list_files(session_id)`: Discovers storage contents & recycle bin manifest.
2. `scan_file(session_id, target_path)`: Analyzes files for sensitive content or recoverable metadata.
3. `simulate_erase(session_id, files, reason)`: Calculates destruction impact and preview metrics.
4. `request_human_approval(session_id, files, reason)`: Generates one-time 5-min TTL approval token.
5. `execute_erase(session_id, approval_token, files)`: Validates approval token and executes sandbox erasure.

---

## 🚀 Quickstart Guide

### Prerequisites
- Node.js 18+ & npm
- Python 3.10+
- Docker & Docker Compose (Optional for local container runtime)

### 1. Installation & Environment Setup
```bash
# Navigate to project directory
cd C:\4th_year\hackathon\trueforge\security_driven

# Install npm dependencies
npm install

# Apply Windows ESM patch if using Windows Node.js
python scripts/patch-kysely.py
```

### 2. Seed Mock Storage Filesystem
```bash
python scripts/seed_filesystem.py
```
*Creates 20+ test files in `sandbox/target-drive/` and initial `sandbox/recycle_bin.json`.*

### 3. Run Automated Verification Suite
```bash
npm run verify
```

### 4. Run E2E Integration Test Suite
```bash
npm test
```

### 5. Launch TrueForge Harness & MCP Server
```bash
# Terminal 1: Start MCP Server
npm run start:mcp

# Terminal 2: Start TrueForge Standalone Harness
npm run start:harness
```

---

## 📊 Qodo Code Review & Safety Evidence

> **Qodo Review Summary**: The core architecture and safety mechanisms (UUID 5-min TTL tokens, Docker sandbox mounts, and Windows ESM patches) were reviewed via automated AI code analysis in Qodo. All high-severity and security finding recommendations were addressed and validated prior to merging.

### Feature & Review Matrix

| Review Category | Assessment / Feature Implemented | Verification Method | Status |
|---|---|---|---|
| **Human Gate Security** | One-time UUID token with 5-minute TTL & automatic invalidation after use. | Tested in `src/mcp-server.ts` unit logic. | ✅ PASSED |
| **Sandbox Isolation** | All destructive operations execute inside `docker/scripts/erase.js` sandbox mounts. | Verified with `--mode simulate` and `--mode execute`. | ✅ PASSED |
| **Windows ESM Compatibility** | Automated `pathToFileURL` conversion for Windows Node.js import paths. | Verified with `scripts/patch-kysely.py`. | ✅ PASSED |
| **Data Integrity** | Content regex inspection prevents accidental deletion of preserved evidence files. | Tested via `src/classifier/classify.py`. | ✅ PASSED |
| **Audit Compliance** | Structured JSON logging per session saved to `logs/session_YYYY-MM-DD.json`. | Verified with `src/logger.ts`. | ✅ PASSED |

---

## 📜 License
MIT License - Built for TrueForge AI Agent Hackathon 2024.

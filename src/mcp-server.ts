import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { defaultLogger } from "./logger.js";

// Paths
const ROOT_DIR = process.cwd();
const TARGET_DIR = "sandbox/target-drive";
const RECYCLE_BIN_FILE = "sandbox/recycle_bin.json";
const CLASSIFIER_SCRIPT = path.join(ROOT_DIR, "src", "classifier", "classify.py");
const ERASE_SCRIPT = path.join(ROOT_DIR, "docker", "scripts", "erase.js");

// Human Approval Token Storage (In-Memory with TTL)
interface ApprovalToken {
  token: string;
  files: string[];
  reason: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

const activeTokens = new Map<string, ApprovalToken>();

// Clean up expired tokens every minute
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of activeTokens.entries()) {
    if (now > data.expiresAt || data.used) {
      activeTokens.delete(token);
    }
  }
}, 60000);

const server = new Server(
  {
    name: "trueforge-security-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register Tools Schema
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_files",
        description: "Scans target storage location and recycle bin manifest for files requiring inspection.",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string", description: "Current workflow session UUID" },
          },
          required: ["session_id"],
        },
      },
      {
        name: "scan_file",
        description: "Classifies a file or directory as RECOVERABLE, SENSITIVE, JUNK, or NORMAL using content inspection & regex.",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string", description: "Current workflow session UUID" },
            target_path: { type: "string", description: "Relative or absolute path of file/folder to classify" },
          },
          required: ["session_id", "target_path"],
        },
      },
      {
        name: "simulate_erase",
        description: "Simulates destruction plan in sandbox without modifying files. Returns reclaimed bytes and proposed plan.",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string", description: "Current workflow session UUID" },
            files: { type: "array", items: { type: "string" }, description: "List of filenames targeted for erasure" },
            reason: { type: "string", description: "Justification for erasure proposal" },
          },
          required: ["session_id", "files"],
        },
      },
      {
        name: "request_human_approval",
        description: "Generates a secure, 5-minute TTL approval token requiring explicit human confirmation before erasure.",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string", description: "Current workflow session UUID" },
            files: { type: "array", items: { type: "string" }, description: "List of filenames to approve for erasure" },
            reason: { type: "string", description: "Clear explanation for human reviewer" },
          },
          required: ["session_id", "files", "reason"],
        },
      },
      {
        name: "execute_erase",
        description: "Executes approved file erasure in Docker sandbox using valid approval token.",
        inputSchema: {
          type: "object",
          properties: {
            session_id: { type: "string", description: "Current workflow session UUID" },
            approval_token: { type: "string", description: "UUID token returned by request_human_approval" },
            files: { type: "array", items: { type: "string" }, description: "List of filenames matching the approved token" },
          },
          required: ["session_id", "approval_token", "files"],
        },
      },
    ],
  };
});

// Tool Call Handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "list_files") {
      const sessionId = (args?.session_id as string) || "default-session";
      
      if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
      }

      const files = fs.readdirSync(TARGET_DIR);
      let recycleBinItems = [];
      if (fs.existsSync(RECYCLE_BIN_FILE)) {
        try {
          recycleBinItems = JSON.parse(fs.readFileSync(RECYCLE_BIN_FILE, "utf-8"));
        } catch {}
      }

      const responseData = {
        target_directory: TARGET_DIR,
        file_count: files.length,
        files: files,
        recycle_bin_manifest: RECYCLE_BIN_FILE,
        recoverable_items_count: recycleBinItems.length,
        recoverable_items: recycleBinItems,
      };

      defaultLogger.log(sessionId, "INVESTIGATE", "Discovered storage files & recycle bin manifest", responseData);

      return {
        content: [{ type: "text", text: JSON.stringify(responseData, null, 2) }],
      };
    }

    if (name === "scan_file") {
      const sessionId = (args?.session_id as string) || "default-session";
      let targetPath = (args?.target_path as string) || TARGET_DIR;

      if (!path.isAbsolute(targetPath)) {
        targetPath = path.join(TARGET_DIR, targetPath);
      }

      const pythonCmd = process.platform === "win32" ? "python" : "python3";
      const cmd = `${pythonCmd} "${CLASSIFIER_SCRIPT}" "${targetPath}"`;
      
      const stdout = execSync(cmd, { encoding: "utf-8" });
      const classificationResult = JSON.parse(stdout);

      defaultLogger.log(sessionId, "CLASSIFY", `Scanned file path: ${targetPath}`, { classificationResult });

      return {
        content: [{ type: "text", text: JSON.stringify(classificationResult, null, 2) }],
      };
    }

    if (name === "simulate_erase") {
      const sessionId = (args?.session_id as string) || "default-session";
      const files = (args?.files as string[]) || [];
      const reason = (args?.reason as string) || "Security cleanup simulation";

      const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
      const filesJsonStr = JSON.stringify(files).replace(/"/g, '\\"');
      const runnerCmd = `${npxCmd} tsx "${ERASE_SCRIPT}" --mode simulate --target-dir "${TARGET_DIR}" --recycle-bin "${RECYCLE_BIN_FILE}" --files "${filesJsonStr}" --reason "${reason}"`;
      
      let simulationOutput = "";
      try {
        simulationOutput = execSync(runnerCmd, { encoding: "utf-8" });
      } catch (err: any) {
        simulationOutput = err.stdout || err.message;
      }

      let parsedResult;
      try {
        parsedResult = JSON.parse(simulationOutput);
      } catch {
        parsedResult = { raw_output: simulationOutput };
      }

      defaultLogger.log(sessionId, "SIMULATE", "Ran erasure simulation plan", { proposed_files: files, result: parsedResult });

      return {
        content: [{ type: "text", text: JSON.stringify(parsedResult, null, 2) }],
      };
    }

    if (name === "request_human_approval") {
      const sessionId = (args?.session_id as string) || "default-session";
      const files = (args?.files as string[]) || [];
      const reason = (args?.reason as string) || "Required human authorization";

      const token = uuidv4();
      const createdAt = Date.now();
      const expiresAt = createdAt + 5 * 60 * 1000; // 5 minutes TTL

      const tokenData: ApprovalToken = {
        token,
        files,
        reason,
        createdAt,
        expiresAt,
        used: false,
      };

      activeTokens.set(token, tokenData);

      const approvalPayload = {
        status: "PENDING_HUMAN_APPROVAL",
        approval_token: token,
        expires_in_seconds: 300,
        expires_at_iso: new Date(expiresAt).toISOString(),
        files_requested: files,
        reason,
        user_prompt: `⚠️ APPROVAL REQUIRED: Destroy ${files.length} sensitive/junk files?\nFiles: ${files.join(", ")}\nReason: ${reason}\n\nTo approve, proceed with approval_token: "${token}"`,
      };

      defaultLogger.log(sessionId, "APPROVAL_REQUEST", "Issued human approval token", approvalPayload);

      return {
        content: [{ type: "text", text: JSON.stringify(approvalPayload, null, 2) }],
      };
    }

    if (name === "execute_erase") {
      const sessionId = (args?.session_id as string) || "default-session";
      const token = (args?.approval_token as string) || "";
      const files = (args?.files as string[]) || [];

      // Validate Token
      const tokenData = activeTokens.get(token);
      if (!tokenData) {
        const errRes = { status: "REJECTED", error: "Invalid or expired approval token." };
        defaultLogger.log(sessionId, "APPROVAL_RESPONSE", "Rejected execute_erase due to invalid token", errRes);
        return { content: [{ type: "text", text: JSON.stringify(errRes, null, 2) }], isError: true };
      }

      if (Date.now() > tokenData.expiresAt) {
        activeTokens.delete(token);
        const errRes = { status: "REJECTED", error: "Approval token has expired (5-minute TTL exceeded)." };
        defaultLogger.log(sessionId, "APPROVAL_RESPONSE", "Rejected execute_erase due to expired token", errRes);
        return { content: [{ type: "text", text: JSON.stringify(errRes, null, 2) }], isError: true };
      }

      if (tokenData.used) {
        const errRes = { status: "REJECTED", error: "Approval token has already been used once." };
        defaultLogger.log(sessionId, "APPROVAL_RESPONSE", "Rejected execute_erase due to re-used token", errRes);
        return { content: [{ type: "text", text: JSON.stringify(errRes, null, 2) }], isError: true };
      }

      // Mark token used
      tokenData.used = true;
      activeTokens.delete(token);

      defaultLogger.log(sessionId, "APPROVAL_RESPONSE", "Human approval granted & validated", { token, approved_files: files });

      // Run Execution
      const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
      const filesJsonStr = JSON.stringify(files).replace(/"/g, '\\"');
      const runnerCmd = `${npxCmd} tsx "${ERASE_SCRIPT}" --mode execute --target-dir "${TARGET_DIR}" --recycle-bin "${RECYCLE_BIN_FILE}" --files "${filesJsonStr}" --reason "Human Approved Erasure Execution"`;

      let executionOutput = "";
      try {
        executionOutput = execSync(runnerCmd, { encoding: "utf-8" });
      } catch (err: any) {
        executionOutput = err.stdout || err.message;
      }

      let parsedResult;
      try {
        parsedResult = JSON.parse(executionOutput);
      } catch {
        parsedResult = { raw_output: executionOutput };
      }

      defaultLogger.log(sessionId, "EXECUTION", "Executed sandbox secure erasure", { result: parsedResult });
      defaultLogger.log(sessionId, "AUDIT_FINAL", "Workflow completed successfully", { total_files_erased: parsedResult.erased_count });

      return {
        content: [{ type: "text", text: JSON.stringify(parsedResult, null, 2) }],
      };
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (error: any) {
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "error", message: error.message }, null, 2) }],
      isError: true,
    };
  }
});

// Start Transport
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("TrueForge Security MCP Server listening on stdio...");
}

run().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});

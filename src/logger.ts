import fs from "fs";
import path from "path";

export interface AuditLogEntry {
  timestamp: string;
  session_id: string;
  stage: "INVESTIGATE" | "CLASSIFY" | "SIMULATE" | "APPROVAL_REQUEST" | "APPROVAL_RESPONSE" | "EXECUTION" | "AUDIT_FINAL";
  action: string;
  details: Record<string, any>;
}

export class SessionLogger {
  private logDir: string;

  constructor(customLogDir?: string) {
    this.logDir = customLogDir || path.join(process.cwd(), "logs");
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFilePath(): string {
    const dateStr = new Date().toISOString().split("T")[0];
    return path.join(this.logDir, `session_${dateStr}.json`);
  }

  public log(sessionId: string, stage: AuditLogEntry["stage"], action: string, details: Record<string, any>): AuditLogEntry {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      stage,
      action,
      details,
    };

    const filePath = this.getLogFilePath();
    let logs: AuditLogEntry[] = [];

    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        logs = JSON.parse(fileContent);
      } catch (err) {
        logs = [];
      }
    }

    logs.push(entry);
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), "utf-8");

    console.log(`[AUDIT LOG] [${entry.stage}] ${action} (Session: ${sessionId})`);
    return entry;
  }

  public getSessionLogs(sessionId: string): AuditLogEntry[] {
    const filePath = this.getLogFilePath();
    if (!fs.existsSync(filePath)) return [];

    try {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const logs: AuditLogEntry[] = JSON.parse(fileContent);
      return logs.filter((l) => l.session_id === sessionId);
    } catch {
      return [];
    }
  }
}

export const defaultLogger = new SessionLogger();

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT_DIR = process.cwd();

const requiredFiles = [
  "package.json",
  "tsconfig.json",
  ".env",
  "mcp.config.json",
  "docker-compose.yml",
  "scripts/seed_filesystem.py",
  "src/classifier/classify.py",
  "src/logger.ts",
  "docker/scripts/erase.sh",
  "docker/Dockerfile",
  "src/mcp-server.ts",
  "agent/trueforge.yaml",
  "src/agent.ts",
];

function runVerification() {
  console.log("🔍 Running Automated TrueForge Security Setup Verification Suite...\n");
  let passed = 0;
  let failed = 0;

  requiredFiles.forEach((file) => {
    const fullPath = path.join(ROOT_DIR, file);
    if (fs.existsSync(fullPath)) {
      console.log(`  ✅ Found: ${file}`);
      passed++;
    } else {
      console.log(`  ❌ Missing: ${file}`);
      failed++;
    }
  });

  // Verify Python Classifier Execution
  try {
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    const targetDir = path.join(ROOT_DIR, "sandbox", "target-drive");
    const classifyPath = path.join(ROOT_DIR, "src", "classifier", "classify.py");
    execSync(`${pythonCmd} "${classifyPath}" "${targetDir}"`, { stdio: "ignore" });
    console.log("  ✅ Python File Classifier Test: PASSED");
    passed++;
  } catch (err) {
    console.log(`  ❌ Python File Classifier Test: FAILED (${err.message})`);
    failed++;
  }

  console.log(`\n======================================================`);
  console.log(`Verification Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification();

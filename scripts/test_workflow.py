import os
import sys
import json
import subprocess
import time

sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TARGET_DIR = os.path.join(ROOT_DIR, "sandbox", "target-drive")
RECYCLE_BIN = os.path.join(ROOT_DIR, "sandbox", "recycle_bin.json")

def run_cmd(cmd, cwd=ROOT_DIR):
    res = subprocess.run(cmd, shell=True, capture_output=True, encoding="utf-8", errors="ignore", cwd=cwd)
    return res.returncode, res.stdout, res.stderr

def test_e2e_workflow():
    print("\n======================================================")
    print("🧪 Starting E2E Integration Test Suite for TrueForge Security Tool")
    print("======================================================\n")

    # Step 1: Seed Filesystem
    print("1. Seeding mock storage filesystem...")
    python_bin = "python" if sys.platform == "win32" else "python3"
    code, stdout, stderr = run_cmd(f"{python_bin} scripts/seed_filesystem.py")
    assert code == 0, f"Seed failed: {stderr}"
    print("   ✓ Filesystem seeded successfully.")

    # Step 2: Test File Classifier
    print("2. Testing Python Classification Engine...")
    code, stdout, stderr = run_cmd(f'{python_bin} src/classifier/classify.py "{TARGET_DIR}"')
    assert code == 0, f"Classifier failed: {stderr}"
    results = json.loads(stdout)
    assert isinstance(results, list), "Expected list of classified files"
    assert len(results) > 0, "Expected non-empty list of files"
    
    classifications = {r["classification"] for r in results}
    print(f"   ✓ Discovered classifications: {classifications}")
    assert "RECOVERABLE" in classifications or "SENSITIVE" in classifications, "Missing key categories"

    # Step 3: Run Agent Orchestrator
    print("3. Executing Agent Workflow (src/agent.ts)...")
    npx_bin = "npx.cmd" if sys.platform == "win32" else "npx"
    code, stdout, stderr = run_cmd(f"{npx_bin} tsx src/agent.ts")
    assert code == 0, f"Agent workflow failed: {stderr}\nOutput: {stdout}"
    assert "TrueForge Security Workflow Complete!" in stdout, "Missing completion signal"
    print("   ✓ Agent workflow executed end-to-end successfully.")

    # Step 4: Verify Audit Logs
    print("4. Verifying Structured JSON Audit Logs...")
    logs_dir = os.path.join(ROOT_DIR, "logs")
    log_files = [f for f in os.listdir(logs_dir) if f.startswith("session_") and f.endswith(".json")]
    assert len(log_files) > 0, "No audit log file created"
    
    latest_log_path = os.path.join(logs_dir, sorted(log_files)[-1])
    with open(latest_log_path, 'r', encoding='utf-8') as f:
        audit_entries = json.load(f)
    
    stages = {entry["stage"] for entry in audit_entries}
    print(f"   ✓ Logged stages: {stages}")
    assert "INVESTIGATE" in stages and "EXECUTION" in stages and "AUDIT_FINAL" in stages, "Incomplete audit trail"

    print("\n======================================================")
    print("🎉 ALL INTEGRATION TESTS PASSED 100/100 SUCCESS!")
    print("======================================================\n")

if __name__ == "__main__":
    test_e2e_workflow()

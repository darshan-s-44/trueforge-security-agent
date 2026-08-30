import os
import sys
import json
import re

sys.stdout.reconfigure(encoding='utf-8')

RECYCLE_BIN_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "sandbox", "recycle_bin.json")

# Sensitive Regex Patterns
SSN_REGEX = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')
CREDIT_CARD_REGEX = re.compile(r'\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b')
CREDENTIAL_KEYWORDS = ["password", "pass:", "pin:", "secret", "api_key", "aws_secret", "private_key", "bearer", "token"]
SENSITIVE_EXTENSIONS = [".env", ".pem", ".key", ".pfx", ".p12"]
JUNK_EXTENSIONS = [".tmp", ".log", ".bak", ".dmp", ".exe", ".db"]
JUNK_EXACT_NAMES = ["thumbs.db", ".ds_store"]

def load_recycle_bin():
    if os.path.exists(RECYCLE_BIN_FILE):
        try:
            with open(RECYCLE_BIN_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []
    return []

def classify_single_file(filepath, recycle_bin_data):
    filename = os.path.basename(filepath)
    ext = os.path.splitext(filename)[1].lower()
    
    reasons = []
    classification = "NORMAL"
    recommendation = "KEEP"
    confidence = 0.80

    # 1. Check Recycle Bin Manifest (Recoverable / Soft-Deleted)
    is_recoverable = False
    for item in recycle_bin_data:
        if item.get("original_filename") == filename or item.get("file_path") == filepath:
            is_recoverable = True
            reasons.append(f"Marked soft-deleted in recycle_bin.json (ID: {item.get('id')})")
            break

    # Read Content Preview if text-like
    content = ""
    if os.path.exists(filepath):
        size_bytes = os.path.getsize(filepath)
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read(4096)  # Read first 4KB
        except Exception as e:
            content = ""
    else:
        size_bytes = 0

    # 2. Check for Sensitivity
    has_ssn = bool(SSN_REGEX.search(content))
    has_cc = bool(CREDIT_CARD_REGEX.search(content))
    has_credentials = any(kw in content.lower() for kw in CREDENTIAL_KEYWORDS) or ext in SENSITIVE_EXTENSIONS

    if has_ssn:
        reasons.append("Detected Social Security Number (SSN) pattern")
    if has_cc:
        reasons.append("Detected Credit Card number pattern")
    if has_credentials:
        reasons.append("Contains credentials, API keys, or security tokens")

    is_sensitive = has_ssn or has_cc or has_credentials

    # Determine Classification & Recommendation
    if is_recoverable:
        classification = "RECOVERABLE"
        if is_sensitive:
            reasons.append("FLAGGED: Recoverable file contains sensitive data! Needs forensic preservation or authorized wipe.")
            recommendation = "PRESERVE_EVIDENCE"
            confidence = 0.98
        else:
            recommendation = "RESTORE_OR_PURGE"
            confidence = 0.95
    elif is_sensitive:
        classification = "SENSITIVE"
        recommendation = "PERMANENT_ERASE"
        confidence = 0.95
    elif ext in JUNK_EXTENSIONS or filename.lower() in JUNK_EXACT_NAMES or "temp" in filename.lower():
        classification = "JUNK"
        reasons.append(f"Temporary file or junk extension matched ({ext or filename})")
        recommendation = "CLEANUP_JUNK"
        confidence = 0.90
    else:
        classification = "NORMAL"
        reasons.append("No sensitive patterns or soft-deletion markers found.")
        recommendation = "KEEP"
        confidence = 0.85

    return {
        "filename": filename,
        "filepath": filepath,
        "classification": classification,
        "confidence": confidence,
        "reasons": reasons,
        "is_recoverable": is_recoverable,
        "is_sensitive": is_sensitive,
        "size_bytes": size_bytes,
        "action_recommendation": recommendation
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python classify.py <filepath_or_directory>"}))
        sys.exit(1)

    target_path = sys.argv[1]
    recycle_bin = load_recycle_bin()

    if os.path.isfile(target_path):
        result = classify_single_file(target_path, recycle_bin)
        print(json.dumps(result, indent=2))
    elif os.path.isdir(target_path):
        results = []
        for root, _, files in os.walk(target_path):
            for file in files:
                full_path = os.path.join(root, file)
                results.append(classify_single_file(full_path, recycle_bin))
        print(json.dumps(results, indent=2))
    else:
        print(json.dumps({"error": f"Path not found: {target_path}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()

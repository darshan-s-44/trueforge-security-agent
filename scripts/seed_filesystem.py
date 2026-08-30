import os
import json
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

TARGET_DIR = os.path.join(os.path.dirname(__file__), "..", "sandbox", "target-drive")
RECYCLE_BIN_FILE = os.path.join(os.path.dirname(__file__), "..", "sandbox", "recycle_bin.json")

def seed():
    os.makedirs(TARGET_DIR, exist_ok=True)

    # 1. Target Drive Files
    files_to_create = {
        # Recoverable / Soft-Deleted in recycle bin (Simulated)
        "deleted_passwords.txt": "facebook_pass: 123456\nbank_pin: 9988", # Also sensitive
        "tax_return_2023.pdf": "%PDF-1.4 Mock Tax Return Content SSN: 000-12-3456",
        "old_family_photo.png": "PNG Mock Image Data Header",
        
        # Sensitive Files (Live)
        "employee_ssn_list.csv": "Name,SSN,Salary\nJohn Doe,123-45-6789,$85000\nJane Smith,987-65-4321,$92000",
        "credit_cards_export.txt": "Card Numbers:\n4532-0156-9872-1234\n5412-7512-3412-9856",
        "db_credentials.env": "POSTGRES_USER=admin\nPOSTGRES_PASSWORD=supersecretpass123!\nDB_HOST=10.0.0.5",
        "api_keys.json": json.dumps({"AWS_SECRET_KEY": "AKIAIOSFODNN7EXAMPLE", "STRIPE_KEY": "sk_test_51Mz..."}, indent=2),
        "medical_records.docx": "Confidential Patient Record: Patient ID 44521 Diagnosis Confidential",
        "corporate_strategy_2025.pdf": "%PDF-1.5 Secret M&A Acquisition Plan Confidential internal distribution only",
        
        # Junk / Temp Files
        "session_cache.tmp": "TEMP_SESSION_DATA_CACHE_ID_88492019",
        "app_debug.log": "[DEBUG] 2024-08-30 10:00:01 - Memory garbage collector triggered\n[INFO] User logged out",
        "thumbs.db": "Mock Windows Thumbnail Cache",
        "system_update.bak": "Backup configuration state 2023-01-01",
        "crash_dump.dmp": "ELF Mock Linux Crash Dump",
        ".DS_Store": "Bud1 Mock Mac OS Finder state",
        "temp_installer.exe": "MZ Mock Windows Executable Installer",

        # Standard Preserved Files (Normal business data)
        "annual_report_public.pdf": "%PDF-1.4 Public Annual Report TrueForge Inc 2024",
        "project_readme.md": "# Project Documentation\nWelcome to TrueForge Open Platform",
        "company_logo.svg": "<svg><text>TrueForge</text></svg>",
        "meeting_notes.txt": "Discussed Q3 roadmaps. Next meeting scheduled for Monday.",
        "software_license.mit": "MIT License Copyright (c) 2024 TrueForge",
        "index.html": "<!DOCTYPE html><html><body><h1>TrueForge Portal</h1></body></html>"
    }

    for filename, content in files_to_create.items():
        filepath = os.path.join(TARGET_DIR, filename)
        if isinstance(content, str):
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
        else:
            with open(filepath, "wb") as f:
                f.write(content)

    # 2. Recycle Bin Manifest (Simulated Deleted Files with Recovery Metadata)
    recycle_bin_data = [
        {
            "id": "rb-001",
            "original_filename": "deleted_passwords.txt",
            "file_path": os.path.join(TARGET_DIR, "deleted_passwords.txt"),
            "deleted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 86400)),
            "deleted_by": "user_alice",
            "original_size_bytes": os.path.getsize(os.path.join(TARGET_DIR, "deleted_passwords.txt")),
            "recoverable": True,
            "forensic_hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
            "id": "rb-002",
            "original_filename": "tax_return_2023.pdf",
            "file_path": os.path.join(TARGET_DIR, "tax_return_2023.pdf"),
            "deleted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 43200)),
            "deleted_by": "user_bob",
            "original_size_bytes": os.path.getsize(os.path.join(TARGET_DIR, "tax_return_2023.pdf")),
            "recoverable": True,
            "forensic_hash": "sha256:8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4"
        },
        {
            "id": "rb-003",
            "original_filename": "old_family_photo.png",
            "file_path": os.path.join(TARGET_DIR, "old_family_photo.png"),
            "deleted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 3600)),
            "deleted_by": "user_alice",
            "original_size_bytes": os.path.getsize(os.path.join(TARGET_DIR, "old_family_photo.png")),
            "recoverable": True,
            "forensic_hash": "sha256:7c9e7c1494b2684ab7c19d6e6ab37a1e0b0e5d0124317181c000e335274d8969"
        }
    ]

    with open(RECYCLE_BIN_FILE, "w", encoding="utf-8") as f:
        json.dump(recycle_bin_data, f, indent=2)

    print(f"✅ Successfully seeded {len(files_to_create)} files to {TARGET_DIR}")
    print(f"✅ Successfully created recycle bin manifest at {RECYCLE_BIN_FILE} with {len(recycle_bin_data)} recoverable items.")

if __name__ == "__main__":
    seed()

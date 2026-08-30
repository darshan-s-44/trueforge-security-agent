import os
import sys

# Force UTF-8 stdout encoding if possible
sys.stdout.reconfigure(encoding='utf-8')

node_modules_dir = os.path.join(os.path.dirname(__file__), "..", "node_modules")
file_migration_provider = os.path.join(node_modules_dir, "kysely", "dist", "esm", "migration", "file-migration-provider.js")

def patch():
    if not os.path.exists(file_migration_provider):
        print("[INFO] Kysely migration provider not found in node_modules yet.")
        return

    with open(file_migration_provider, "r", encoding="utf-8") as f:
        content = f.read()

    # Windows URL patch for Kysely FileMigrationProvider import
    target = "import(filePath)"
    replacement = "import(pathToFileURL(filePath).href)"

    if target in content and "pathToFileURL" not in content:
        patched = "import { pathToFileURL } from 'node:url';\n" + content.replace(target, replacement)
        with open(file_migration_provider, "w", encoding="utf-8") as f:
            f.write(patched)
        print("[SUCCESS] Kysely Windows ESM patch applied cleanly!")
    else:
        print("[INFO] Kysely migration provider already patched or target not found.")

if __name__ == "__main__":
    patch()

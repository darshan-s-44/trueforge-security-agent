#!/usr/bin/env bash
set -euo pipefail

MODE="simulate"
FILES_JSON="[]"
TARGET_DIR="sandbox/target-drive"
RECYCLE_BIN="sandbox/recycle_bin.json"
REASON="Automated Secure Erasure Execution"

while [[ $# -gt 0 ]]; do
  case $1 in
    --mode)
      MODE="$2"
      shift 2
      ;;
    --files)
      FILES_JSON="$2"
      shift 2
      ;;
    --target-dir)
      TARGET_DIR="$2"
      shift 2
      ;;
    --recycle-bin)
      RECYCLE_BIN="$2"
      shift 2
      ;;
    --reason)
      REASON="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# Python fallback for JSON processing if jq is not present
parse_json_len() {
    if command -v jq &> /dev/null; then
        echo "$1" | jq '. | length' 2>/dev/null || echo 0
    else
        python -c "import json, sys; data=json.loads(sys.argv[1]); print(len(data))" "$1" 2>/dev/null || echo 0
    fi
}

parse_json_elem() {
    if command -v jq &> /dev/null; then
        echo "$1" | jq -r ".[$2]" 2>/dev/null
    else
        python -c "import json, sys; data=json.loads(sys.argv[1]); print(data[int(sys.argv[2])])" "$1" "$2" 2>/dev/null
    fi
}

TOTAL_BYTES=0
ERASE_LIST=()
PRESERVE_LIST=()

FILE_COUNT=$(parse_json_len "$FILES_JSON")

if [ "$FILE_COUNT" -eq 0 ]; then
    echo '{"status": "error", "message": "No files provided in --files parameter"}'
    exit 1
fi

for i in $(seq 0 $((FILE_COUNT - 1))); do
    FILE_NAME=$(parse_json_elem "$FILES_JSON" "$i")
    FULL_PATH="${TARGET_DIR}/${FILE_NAME}"

    if [ -f "$FULL_PATH" ]; then
        SIZE=$(stat -c%s "$FULL_PATH" 2>/dev/null || stat -f%z "$FULL_PATH" 2>/dev/null || echo 0)
        TOTAL_BYTES=$((TOTAL_BYTES + SIZE))
        ERASE_LIST+=("$FILE_NAME")
    else
        PRESERVE_LIST+=("$FILE_NAME (Not Found / Already Removed)")
    fi
done

if [ "$MODE" == "simulate" ]; then
    cat <<EOF
{
  "status": "simulation_success",
  "mode": "SIMULATION",
  "reason": "$REASON",
  "proposed_erasure_count": ${#ERASE_LIST[@]},
  "proposed_preserve_count": ${#PRESERVE_LIST[@]},
  "reclaimed_bytes": $TOTAL_BYTES,
  "erasure_targets": $FILES_JSON,
  "notice": "No files were deleted during simulation mode. Human approval token required for execution."
}
EOF
    exit 0
fi

if [ "$MODE" == "execute" ]; then
    ERASED_SUCCESS=()
    ERASED_FAILED=()

    for FILE_NAME in "${ERASE_LIST[@]}"; do
        FULL_PATH="${TARGET_DIR}/${FILE_NAME}"
        if [ -f "$FULL_PATH" ]; then
            if command -v shred &> /dev/null; then
                shred -u -n 1 "$FULL_PATH" 2>/dev/null || rm -f "$FULL_PATH"
            else
                rm -f "$FULL_PATH"
            fi
            
            if [ ! -f "$FULL_PATH" ]; then
                ERASED_SUCCESS+=("$FILE_NAME")
            else
                ERASED_FAILED+=("$FILE_NAME")
            fi
        fi
    done

    # Update Recycle Bin JSON if present
    if [ -f "$RECYCLE_BIN" ]; then
        python -c "
import json, sys
rb_path = sys.argv[1]
erased = json.loads(sys.argv[2])
try:
    with open(rb_path, 'r') as f:
        data = json.load(f)
    new_data = [item for item in data if item.get('original_filename') not in erased]
    with open(rb_path, 'w') as f:
        json.dump(new_data, f, indent=2)
except Exception:
    pass
" "$RECYCLE_BIN" "$FILES_JSON" || true
    fi

    cat <<EOF
{
  "status": "execution_success",
  "mode": "EXECUTION",
  "reason": "$REASON",
  "erased_count": ${#ERASED_SUCCESS[@]},
  "failed_count": ${#ERASED_FAILED[@]},
  "reclaimed_bytes": $TOTAL_BYTES,
  "erased_files": $FILES_JSON,
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
    exit 0
fi

echo '{"status": "error", "message": "Invalid mode specified"}'
exit 1

#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ "${SKIP_BUILD:-}" != "1" ]]; then
  echo "Building library (set SKIP_BUILD=1 to reuse existing dist)..."
  (
    cd "${REPO_ROOT}"
    npm run build
  )
  echo ""
fi

node "${SCRIPT_DIR}/convert-asterics-grid.js" "$@"

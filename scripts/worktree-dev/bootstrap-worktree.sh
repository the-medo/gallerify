#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd -- "${SCRIPT_DIR}/../.."

source "${SCRIPT_DIR}/runtime.sh"
command -v yarn >/dev/null || { echo 'Yarn 1.22.22 must be on PATH (see packageManager).' >&2; exit 1; }
[[ "$(yarn --version)" == 1.22.22 ]] || { echo 'Use Yarn 1.22.22 to preserve yarn.lock.' >&2; exit 1; }

yarn install --frozen-lockfile --non-interactive
exec "${SCRIPT_DIR}/gallerify-worktree-dev" setup "$@"

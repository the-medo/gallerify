#!/usr/bin/env bash
# Sourced by both entry points. Agent shells may not initialize a version manager.
# Reuse an already-installed mise runtime without installing or changing defaults.
if ! command -v node >/dev/null; then
  GALLERIFY_MISE_BIN="$(command -v mise || true)"
  if [[ -z "${GALLERIFY_MISE_BIN}" && -x "${HOME}/.local/bin/mise" ]]; then
    GALLERIFY_MISE_BIN="${HOME}/.local/bin/mise"
  fi
  if [[ -n "${GALLERIFY_MISE_BIN}" ]]; then
    if GALLERIFY_NODE_DIR="$("${GALLERIFY_MISE_BIN}" where node@24 2>/dev/null)"; then
      export PATH="${GALLERIFY_NODE_DIR}/bin:${PATH}"
    fi
  fi
fi
command -v node >/dev/null || { echo 'Activate Node.js 24 (see .node-version), then retry.' >&2; exit 1; }
[[ "$(node -p 'process.versions.node.split(".")[0]')" == 24 ]] || { echo 'Use Node.js 24.' >&2; exit 1; }

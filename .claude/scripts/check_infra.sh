#!/usr/bin/env bash
set -euo pipefail
set -x

# No dedicated CI job or local lint/test command exists for infra changes — they're only
# verified via tag-triggered release jobs (see docs/agents/contributing.md's CI Checks table).
# This is a sanity check only, not a substitute for that.
docker-compose config --quiet

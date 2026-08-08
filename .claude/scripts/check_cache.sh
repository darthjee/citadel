#!/usr/bin/env bash
set -euo pipefail
set -x

# navi/ has no CI job or test suite of its own (see docs/agents/contributing.md's CI Checks
# table). This is a YAML syntax sanity check only, not a substitute for one.
docker run --rm -v "$PWD/navi":/navi python:3-alpine sh -c '
  pip install --quiet pyyaml
  for f in $(find /navi -name "*.yaml" -o -name "*.yml"); do
    python3 -c "import yaml, sys; yaml.safe_load(open(sys.argv[1]))" "$f" || exit 1
  done
'

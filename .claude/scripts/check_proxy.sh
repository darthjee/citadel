#!/usr/bin/env bash
set -euo pipefail
set -x

docker run --rm -v "$PWD":/repo darthjee/tent:0.10.1 sh -c '
  find /repo/proxy -name "*.php" -print0 | xargs -0 -n1 php -l
'
docker-compose run --rm proxy_lint
docker-compose run proxy_tests

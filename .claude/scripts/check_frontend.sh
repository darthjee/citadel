#!/usr/bin/env bash
set -euo pipefail
set -x

docker-compose run --rm citadel_placeholder_fe yarn coverage
docker-compose run --rm citadel_placeholder_fe yarn lint

#!/bin/sh
set -e

yarn migration:run

exec node dist/main.js

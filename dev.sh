#!/usr/bin/env bash
# Levanta el sitio en http://localhost:8000
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v php >/dev/null 2>&1; then
  echo "Necesitás PHP 8.2 o superior instalado." >&2
  exit 1
fi

mkdir -p public_html/storage/uploads

echo "Jetcopy → http://localhost:8000"
php -d upload_max_filesize=50M -d post_max_size=55M -S localhost:8000 -t public_html server.php

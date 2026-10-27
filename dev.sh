#!/usr/bin/env bash
# Levanta el sitio en http://127.0.0.1:8001
#
# Puerto y host distintos a los de Jetcopy (localhost:8000) para poder correr
# los dos a la vez: los navegadores comparten las cookies de "localhost" entre
# puertos, así que con el mismo host la sesión y el token CSRF de un proyecto
# pisarían los del otro. "127.0.0.1" es otro host para el navegador.
set -euo pipefail

cd "$(dirname "$0")"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8001}"

if ! command -v php >/dev/null 2>&1; then
  echo "Necesitás PHP 8.2 o superior instalado." >&2
  exit 1
fi

mkdir -p public_html/storage/uploads public_html/storage/thumbs public_html/storage/sessions

echo "PDF Color → http://$HOST:$PORT"
php -d upload_max_filesize=50M -d post_max_size=55M -S "$HOST:$PORT" -t public_html server.php

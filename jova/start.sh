#!/bin/sh
# Запускает собственную модель и сайт вместе (для хостинга и Docker).
python3 own/serve.py &
export JOVA_OWN_URL="${JOVA_OWN_URL:-http://127.0.0.1:8765}"
exec node server.js

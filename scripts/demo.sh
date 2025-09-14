#!/usr/bin/env bash
set -euo pipefail

echo "[1/4] Build & up..."
docker compose up --build -d

echo "[2/4] whoami x3 (balanceo)"
for i in 1 2 3; do
  curl -s http://localhost:8080/whoami; echo
done

echo "[3/4] Obtener token y crear/listar nota"
TOKEN=$(curl -s -X POST http://localhost:8080/login | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
curl -i http://localhost:8080/notes | head -n 1
curl -s -X POST http://localhost:8080/notes   -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json"   -d '{"title":"Hola <> mundo","body":"Contenido <script>"}' | jq .
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/notes | jq .

echo "[4/4] Probar rate limiting (429)"
for i in {1..12}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/health; done

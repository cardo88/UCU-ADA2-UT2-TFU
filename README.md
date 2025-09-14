# UCU-ADA2-UT2-TFU


## Correr
```bash
docker compose up --build -d
```

La API queda en `http://localhost:8080` detrás de Nginx (balanceo entre dos réplicas).

## Probas
```bash
# Alternancia entre réplicas (api-1 / api-2)
curl -s http://localhost:8080/whoami
curl -s http://localhost:8080/whoami
curl -s http://localhost:8080/whoami

# Obtener token
TOKEN=$(curl -s -X POST http://localhost:8080/login | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

# 401 sin token
curl -i http://localhost:8080/notes

# Crear nota (con token)
curl -s -X POST http://localhost:8080/notes   -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json"   -d '{"title":"Hola <> mundo","body":"Contenido <script>"}'

# Listar notas (verás alternar instance)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/notes

# Rate limiting (>=11 req en 15s → 429)
for i in {1..12}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/health; done
```

# UT2 – Tácticas de Arquitectura: Rendimiento + Seguridad

Demo con **2 réplicas de API Node.js** detrás de **Nginx (round-robin)**, aplicando:
- **Rendimiento**: múltiples copias + balanceo de carga.
- **Seguridad**: rate limiting (DoS básico), **JWT** en endpoints protegidos y sanitización de input.

## Requisitos
- Docker + Docker Compose
- (Opcional) `jq` y `curl` para los scripts de prueba

## Levantar
```bash
docker compose up --build -d
````

Expuesto en: `http://localhost:8080`

## Endpoints

* `GET /health` → status de la instancia (sin auth)
* `GET /whoami` → devuelve `{ instance, pid }` de la réplica que respondió (sin auth)
* `POST /login` → emite token JWT de prueba (sin credenciales, solo demo)
* `GET /notes` (auth JWT)
* `POST /notes` (auth JWT, valida y sanitiza `title` y `body`)

## Probar

```bash
# Alternancia de réplicas (api-1 / api-2)
for i in {1..6}; do curl -s http://localhost:8080/whoami; echo; done

# Token
TOKEN=$(curl -s -X POST http://localhost:8080/login | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

# Acceder sin Token : {"error":"Missing token"}
curl -i http://localhost:8080/notes

# Crear nota con token
curl -s -X POST http://localhost:8080/notes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Hola <> mundo","body":"Contenido <script>"}'

# Listar notas (Repetir para alternar replicas)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/notes | jq .
```

## Rate limiting (429)

El limitador está **en cada instancia** (10 req / 15s por IP). Con 2 réplicas, el conteo se reparte.

* Forzarlo sin tocar nada: mandar muchos requests en <15s

```bash
for i in {1..30}; do
  curl -s -w " (%{http_code})\n" http://localhost:8080/whoami -o -
done
```

## Parar/Limpiar

```bash
docker compose down -v
```

## Colección Postman

Importar `UCU-ADA2-UT2-TFU.postman_collection.json` y usar las requests preconfiguradas:

* Login → copiar `token` a variable `{{TOKEN}}`
* Whoami, Health, Notes GET/POST


# Arquitectura y Tácticas

## Vista general
````

Cliente ──> Nginx (LB) ──round-robin──> api1 (Express)
└───────────> api2 (Express)

```

- **Nginx**: balanceo simple (round-robin), cabeceras `X-Forwarded-*`.
- **API (Node.js + Express)**:
  - `helmet` (headers de seguridad)
  - `express-rate-limit` (límite 10 req / 15s por IP)
  - `JWT` en endpoints protegidos (`/notes`, POST/GET)
  - Validación/sanitización básica de inputs (`title`, `body`)

## Tácticas demostradas
- **Rendimiento**
  - *Múltiples copias de cómputo* + *balanceo de carga*: mejor throughput y tiempos estables ante picos.
- **Seguridad (resistir ataques)**
  - *Rate limiting*: mitiga DoS básicos y abuso de endpoints.
  - *Autenticación por token (JWT)*: controla acceso a recursos.
  - *Validación/sanitización de inputs*: reduce superficie de inyección/fuzzing.

## Trade-offs
- + Throughput, + resiliencia ante picos, + control de abuso.
- – Complejidad operativa (orquestación, secretos), – contadores por instancia (si no hay store compartido).

## Alternativas (si hay tiempo)
- Rate limit central en **Nginx** (`limit_req`).
- Compartir contadores con **Redis** (`express-rate-limit` + `rate-limit-redis`).
- Pruebas de carga: `hey`, `k6`, `ab`.
```

---

# docs/DEMO.md

````markdown
# Guion de demo (2–3 min)

1. **Quién soy** (`/whoami`)
   ```bash
   for i in {1..6}; do curl -s http://localhost:8080/whoami; echo; done
````

> Se alternan `api-1` y `api-2` (round-robin) → *múltiples copias + balanceo*.

2. **Auth y protección de recursos**

   ```bash
   curl -i http://localhost:8080/notes   # 401
   TOKEN=$(curl -s -X POST http://localhost:8080/login | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
   curl -s -X POST http://localhost:8080/notes \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"title":"Hola <> mundo","body":"Contenido <script>"}'
   curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/notes | jq .
   ```

   > 401 sin token, 201/200 con token; sanitiza `< >` en inputs.

3. **Rate limiting**

   * Variante A (fácil, más requests):

     ```bash
     for i in {1..30}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/health; done
     ```
   * Variante B (una réplica):

     ```bash
     docker compose stop api2
     for i in {1..12}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/health; done
     ```

   > Aparecen **429** al exceder 10 req / 15s por IP en una instancia.

````

---

# docs/TROUBLESHOOTING.md
```markdown
# Troubleshooting

## Siempre veo 200, no 429
- Estás con 2 réplicas; cada una cuenta por separado. Mandá más requests o detén `api2`.

## Veo la misma réplica siempre
- Nginx hace round-robin por conexión. Usá múltiples requests separados (como en `/whoami` con `curl` en bucle).

## JWT no funciona
- Ajustá `JWT_SECRET` en `docker-compose.yml` (api1/api2 iguales).
- Revisá que el header sea `Authorization: Bearer <token>`.

## Nginx no levanta
- Verificá el bind del volumen: `./nginx/nginx.conf:/etc/nginx/nginx.conf:ro`
- Logs: `docker compose logs nginx --tail=200`

## Cambié el puerto
- Nginx espera `server api1:3000; server api2:3000;`. Si cambiaste `PORT`, alineá Nginx y las env vars.

## Quiero ver réplica + status code en una línea
```bash
for i in {1..12}; do
  curl -s http://localhost:8080/whoami -w " (%{http_code})\n" -o -
done
````

````

---

# scripts/test-replicas.sh
```bash
#!/usr/bin/env bash
set -euo pipefail
for i in {1..12}; do
  curl -s http://localhost:8080/whoami -w " (%{http_code})\n" -o -
done
````

# scripts/test-rl.sh

```bash
#!/usr/bin/env bash
set -euo pipefail
for i in {1..30}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/health
done
```

---

Si querés, pegá estos archivos tal cual en tu repo:

* `README.md`
* `docs/ARQUITECTURA.md`
* `docs/DEMO.md`
* `docs/TROUBLESHOOTING.md`
* `scripts/test-replicas.sh` (chmod +x)
* `scripts/test-rl.sh` (chmod +x)

¿Querés que además te deje un **CHANGELOG.md** inicial y un **Makefile** con targets (`make up`, `make down`, `make demo`)?

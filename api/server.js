import express from "express";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

const app = express();
app.use(helmet());
app.use(express.json());

// === Config ===
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const INSTANCE = process.env.INSTANCE || "api-unknown";

// === Rate limiting (táctica: throttling) ===
const limiter = rateLimit({
  windowMs: 15 * 1000,          // 15s
  max: 10,                      // 10 reqs/ventana
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// === Auth JWT (resistir ataques de acceso no autorizado) ===
function auth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// === Validación básica de input (resistir inyección) ===
function validateNote(req, res, next) {
  const { title, body } = req.body || {};
  const isStr = v => typeof v === "string" && v.length > 0 && v.length < 256;
  if (!isStr(title) || !isStr(body)) {
    return res.status(400).json({ error: "Invalid input" });
  }
  // Sanitización mínima
  req.body.title = title.replace(/[<>]/g, "");
  req.body.body  = body.replace(/[<>]/g, "");
  next();
}

// === Endpoints ===
app.get("/health", (req, res) => {
  res.json({ status: "ok", instance: INSTANCE, ts: Date.now() });
});

// Login de demo (solo para obtener token de prueba)
app.post("/login", (req, res) => {
  // Usuario fijo de demo
  const token = jwt.sign({ sub: "student", role: "demo" }, JWT_SECRET, { expiresIn: "30m" });
  res.json({ token });
});

// CRUD mínimo protegido
const notes = [];
app.get("/notes", auth, (req, res) => res.json({ instance: INSTANCE, notes }));

app.post("/notes", auth, validateNote, (req, res) => {
  const { title, body } = req.body;
  const id = notes.length + 1;
  notes.push({ id, title, body, by: req.user.sub });
  res.status(201).json({ created: { id }, instance: INSTANCE });
});

// Para visualizar el balanceo
app.get("/whoami", (req, res) => res.json({ instance: INSTANCE, pid: process.pid }));

app.listen(PORT, () => {
  console.log(`API ${INSTANCE} listening on ${PORT}`);
});

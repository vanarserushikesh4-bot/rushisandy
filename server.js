// STRATUM IT INDIA — store server
// Run:  npm install  then  npm start   (opens on http://localhost:3000)
// Admin panel: http://localhost:3000/admin   (default password: stratum@123 — change it in Settings)

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const SEED_FILE = path.join(DATA_DIR, "seed.json");
const UPLOAD_DIR = path.join(__dirname, "public", "uploads");
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || "stratum@123";

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- tiny JSON database ----------
function loadDb() {
  if (!fs.existsSync(DB_FILE)) fs.copyFileSync(SEED_FILE, DB_FILE);
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
let db = loadDb();
function saveDb() {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// ---------- password + sessions ----------
function hashPassword(pw, salt = crypto.randomBytes(16).toString("hex")) {
  return salt + ":" + crypto.scryptSync(pw, salt, 64).toString("hex");
}
function checkPassword(pw) {
  if (!db.admin || !db.admin.passwordHash) return safeEqual(pw, DEFAULT_PASSWORD);
  const [salt, hash] = db.admin.passwordHash.split(":");
  return safeEqual(crypto.scryptSync(pw, salt, 64).toString("hex"), hash);
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const sessions = new Map(); // token -> expiry
const SESSION_MS = 12 * 60 * 60 * 1000;
function getCookie(req, name) {
  const m = (req.headers.cookie || "").split(";").map(s => s.trim()).find(s => s.startsWith(name + "="));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
function requireAdmin(req, res, next) {
  const t = getCookie(req, "admin_token");
  const exp = t && sessions.get(t);
  if (!exp || exp < Date.now()) return res.status(401).json({ error: "Please log in" });
  next();
}

// ---------- helpers ----------
const uid = (p) => p + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString("hex").toUpperCase();
const str = (v, max = 500) => String(v ?? "").trim().slice(0, max);
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; };
function publicStore() {
  const { settings, banners, categories, features } = db;
  return { settings, banners, categories, features, products: db.products.filter(p => p.visible !== false) };
}
function cleanProduct(b, existing = {}) {
  return {
    ...existing,
    name: str(b.name, 120) || existing.name || "New laptop",
    brand: str(b.brand, 40),
    tags: Array.isArray(b.tags) ? b.tags.map(t => str(t, 40)).filter(Boolean) : existing.tags || [],
    cpu: str(b.cpu, 80), ram: str(b.ram, 40), storage: str(b.storage, 40), display: str(b.display, 60),
    price: num(b.price), mrp: num(b.mrp), stock: num(b.stock),
    condition: str(b.condition, 80), warranty: str(b.warranty, 80), battery: str(b.battery, 80),
    description: str(b.description, 2000),
    images: Array.isArray(b.images) ? b.images.map(i => str(i, 300)).filter(Boolean) : existing.images || [],
    visible: b.visible !== false,
    featured: !!b.featured,
  };
}

const app = express();
app.use(express.json({ limit: "1mb" }));

// ---------- public API ----------
app.get("/api/store", (req, res) => res.json(publicStore()));

app.post("/api/orders", (req, res) => {
  const b = req.body || {};
  const c = b.customer || {};
  const customer = {
    name: str(c.name, 80), phone: str(c.phone, 15).replace(/[^\d+]/g, ""), email: str(c.email, 120),
    address: str(c.address, 400), city: str(c.city, 60), state: str(c.state, 60), pincode: str(c.pincode, 6),
  };
  if (!customer.name || customer.phone.replace(/\D/g, "").length < 10 || !customer.address || !/^\d{6}$/.test(customer.pincode))
    return res.status(400).json({ error: "Please fill name, a 10-digit phone number, address and 6-digit pincode." });
  if (!Array.isArray(b.items) || !b.items.length) return res.status(400).json({ error: "Your cart is empty." });

  const items = [];
  for (const it of b.items) {
    const p = db.products.find(x => x.id === it.id && x.visible !== false);
    const qty = Math.max(1, Math.min(20, num(it.qty)));
    if (!p) return res.status(400).json({ error: "A product in your cart is no longer available." });
    if (p.stock < qty) return res.status(400).json({ error: `Only ${p.stock} left of ${p.name}.` });
    items.push({ id: p.id, name: p.name, price: p.price, qty, image: p.images[0] || "" });
  }
  items.forEach(it => { db.products.find(p => p.id === it.id).stock -= it.qty; });
  const payment = ["Cash on Delivery", "UPI / Online (we will share details)", "Bank Transfer"].includes(b.payment) ? b.payment : "Cash on Delivery";
  const order = {
    id: uid("ST"), createdAt: new Date().toISOString(), status: "New", customer, items, payment,
    note: str(b.note, 500), total: items.reduce((s, i) => s + i.price * i.qty, 0),
  };
  db.orders.unshift(order);
  saveDb();
  res.json({ ok: true, order });
});

app.get("/api/orders/track", (req, res) => {
  const id = str(req.query.id, 40).toUpperCase();
  const phone = str(req.query.phone, 15).replace(/\D/g, "").slice(-10);
  const o = db.orders.find(o => o.id === id && o.customer.phone.replace(/\D/g, "").slice(-10) === phone);
  if (!o) return res.status(404).json({ error: "No order found with that Order ID and phone number." });
  res.json({ id: o.id, status: o.status, createdAt: o.createdAt, total: o.total, items: o.items.map(i => ({ name: i.name, qty: i.qty })) });
});

// ---------- admin API ----------
app.post("/api/admin/login", (req, res) => {
  if (!checkPassword(str(req.body && req.body.password, 200))) return res.status(401).json({ error: "Wrong password" });
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + SESSION_MS);
  res.setHeader("Set-Cookie", `admin_token=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_MS / 1000}`);
  res.json({ ok: true, usingDefault: !db.admin || !db.admin.passwordHash });
});
app.post("/api/admin/logout", (req, res) => {
  sessions.delete(getCookie(req, "admin_token"));
  res.setHeader("Set-Cookie", "admin_token=; HttpOnly; Path=/; Max-Age=0");
  res.json({ ok: true });
});
app.get("/api/admin/data", requireAdmin, (req, res) => {
  res.json({ ...db, admin: { usingDefault: !db.admin || !db.admin.passwordHash } });
});

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" }[file.mimetype];
      cb(null, Date.now() + "-" + crypto.randomBytes(4).toString("hex") + ext);
    },
  }),
  limits: { fileSize: 6 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)),
});
app.post("/api/admin/upload", requireAdmin, upload.array("photos", 10), (req, res) => {
  if (!req.files || !req.files.length) return res.status(400).json({ error: "Please choose JPG, PNG, WEBP or GIF photos up to 6 MB." });
  res.json({ urls: req.files.map(f => "/uploads/" + f.filename) });
});

app.post("/api/admin/products", requireAdmin, (req, res) => {
  const p = { id: uid("P"), ...cleanProduct(req.body || {}) };
  db.products.unshift(p); saveDb(); res.json(p);
});
app.put("/api/admin/products/:id", requireAdmin, (req, res) => {
  const i = db.products.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: "Not found" });
  db.products[i] = cleanProduct(req.body || {}, db.products[i]); saveDb(); res.json(db.products[i]);
});
app.delete("/api/admin/products/:id", requireAdmin, (req, res) => {
  db.products = db.products.filter(p => p.id !== req.params.id); saveDb(); res.json({ ok: true });
});
app.put("/api/admin/banners", requireAdmin, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "Bad data" });
  db.banners = req.body.slice(0, 8).map((b, i) => ({ id: str(b.id, 20) || "b" + i, image: str(b.image, 300), link: str(b.link, 300) }));
  saveDb(); res.json(db.banners);
});
app.put("/api/admin/categories", requireAdmin, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "Bad data" });
  db.categories = req.body.slice(0, 12).map(c => ({ slug: str(c.slug, 40), name: str(c.name, 40), subtitle: str(c.subtitle, 80), image: str(c.image, 300) }));
  saveDb(); res.json(db.categories);
});
app.put("/api/admin/settings", requireAdmin, (req, res) => {
  const b = req.body || {};
  db.settings = { ...db.settings, storeName: str(b.storeName, 60), tagline: str(b.tagline, 80),
    whatsapp: str(b.whatsapp, 15).replace(/\D/g, ""), phone: str(b.phone, 20), email: str(b.email, 120), address: str(b.address, 300), logo: str(b.logo, 300) };
  saveDb(); res.json(db.settings);
});
app.put("/api/admin/password", requireAdmin, (req, res) => {
  const { current, next } = req.body || {};
  if (!checkPassword(str(current, 200))) return res.status(400).json({ error: "Current password is wrong" });
  if (str(next, 200).length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });
  db.admin = { passwordHash: hashPassword(str(next, 200)) }; saveDb(); res.json({ ok: true });
});
app.put("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const o = db.orders.find(o => o.id === req.params.id);
  if (!o) return res.status(404).json({ error: "Not found" });
  const statuses = ["New", "Confirmed", "Shipped", "Delivered", "Cancelled"];
  if (statuses.includes(req.body.status)) {
    if (req.body.status === "Cancelled" && o.status !== "Cancelled") // put stock back
      o.items.forEach(it => { const p = db.products.find(p => p.id === it.id); if (p) p.stock += it.qty; });
    o.status = req.body.status;
  }
  if (typeof req.body.adminNote === "string") o.adminNote = str(req.body.adminNote, 500);
  saveDb(); res.json(o);
});

// ---------- pages ----------
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin.html")));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.use((err, req, res, next) => res.status(400).json({ error: err.message || "Something went wrong" }));

app.listen(PORT, () => {
  console.log(`STRATUM store running:  http://localhost:${PORT}`);
  console.log(`Admin panel:            http://localhost:${PORT}/admin`);
  if (!db.admin || !db.admin.passwordHash) console.log(`Admin password is the default (${process.env.ADMIN_PASSWORD ? "from ADMIN_PASSWORD" : "stratum@123"}). Change it in Admin → Settings.`);
});

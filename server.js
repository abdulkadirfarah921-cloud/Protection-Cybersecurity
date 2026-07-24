const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1); // <-- ضفنا ده عشان Render
const PORT = process.env.PORT || 3000;
const DB_FILE = 'db.json';

// ===== قاعدة البيانات =====
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const data = { users: [], publishers: [], api_keys: [crypto.randomBytes(32).toString('hex')], files: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(data));
    return data;
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
let db = readDB();

// ===== بيانات الادمن =====
const ADMIN_USER = "admin";
const ADMIN_PASS_HASH = "$2b$12$8K1p0F5vZ9xY2wQ7rT4uOuL3mN6bV9cX1zA4sD7gH0jK3lM5nP8qR"; // باسورد: Fortress@2026_New

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({ secret: crypto.randomBytes(64).toString('hex'), resave: false, saveUninitialized: false, cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 } }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/login');
}
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (db.api_keys.includes(key)) return next();
  res.status(403).json({ error: "Invalid API Key" });
}

// ===== نظام الفحص =====
function deepScan(filename, content) {
  const highRisk = ["eval(", "exec(", "rm -rf", "child_process", "fs.unlinkSync", "password=", "api_key="];
  const mediumRisk = ["http://", "document.cookie", "localStorage", "alert("];
  if (highRisk.some(k => content.includes(k))) return { risk: "عالي", color: "red", action: "حذف فوري", block: true };
  if (mediumRisk.some(k => content.includes(k))) return { risk: "قوي", color: "orange", action: "تحذير احمر", block: false };
  if (content.length > 50000) return { risk: "متوسط", color: "yellow", action: "تحذير حجم", block: false };
  return { risk: "امن", color: "green", action: "مسموح", block: false };
}

// ===== الصفحات =====
app.get('/', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Fortress</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:40px;text-align:center}</style></head><body><h1>🛡️ FORTRESS CYBERSECURITY SERVER</h1><p>السيرفر شغال ✅</p><a href="/buy" style="color:#0F0">رابط الدفع</a> | <a href="/login" style="color:#0F0">دخول الادمن</a></body></html>`));
app.get('/buy', (req,res)=> res.sendFile(path.join(__dirname, 'buy.html')));
app.get('/terms', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Terms</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:40px}</style></head><body><h1>Terms of Service</h1><p>By purchasing you agree to legal use only. Digital product - No refunds.</p></body></html>`));
app.get('/privacy', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Privacy</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:40px}</style></head><body><h1>Privacy Policy</h1><p>We use Paddle for payments. We do not store card details.</p></body></html>`));
app.get('/refund', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Refund</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:40px}</style></head><body><h1>Refund Policy</h1><p>Digital licenses are non-refundable. Contact support for issues.</p></body></html>`));

// LOGIN + ADMIN + API ... نفس الكود اللي فوق

app.listen(PORT, ()=> console.log(`🔒 FORTRESS X ACTIVE ON ${PORT}`));
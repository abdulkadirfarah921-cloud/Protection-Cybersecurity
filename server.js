const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const geoip = require('geoip-lite');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const app = express();
const PORT = process.env.PORT || 3000;

// قاعدة بيانات بسيطة
const adapter = new JSONFile('db.json');
const db = new Low(adapter);
await db.read();
db.data ||= { users: [], publishers: [], api_keys: ["MASTER_KEY_12345"] }

// ===== بيانات الادمن =====
const ADMIN_USER = "admin";
const ADMIN_PASS_HASH = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyY9uVJ8K3aO"; // Fortress@2026

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // عشان ملفات السياسات
app.use(session({ secret: crypto.randomBytes(64).toString('hex'), resave: false, saveUninitialized: false, cookie: { httpOnly: true, maxAge: 1000 * 60 * 30 } }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/login');
}

// ===== حماية خارجية: اي موقع يتصل لازم API KEY =====
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (db.data.api_keys.includes(key)) return next();
  res.status(403).json({ error: "Invalid API Key" });
}

// ===== 0. الصفحات العامة لـ Paddle - بدون تسجيل دخول =====
app.get('/buy', (req,res)=> res.sendFile(path.join(__dirname, 'buy.html')));

app.get('/terms', (req,res)=> res.send(`<h1>Terms of Service</h1><p>By purchasing ShadowKing Fab License you agree to use it legally. Product is digital and non-refundable.</p>`));
app.get('/privacy', (req,res)=> res.send(`<h1>Privacy Policy</h1><p>We collect email and payment info through Paddle. We do not store card details.</p>`));
app.get('/refund', (req,res)=> res.send(`<h1>Refund Policy</h1><p>Digital products are non-refundable. Contact support for issues.</p>`));

// 1. تسجيل الدخول للادمن
app.get('/login', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>LOGIN</title><style>body{background:#000;color:#0F0;font-family:Cairo;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}.box{background:#111;padding:40px;border-radius:16px;border:2px solid #0F0;width:350px;text-align:center}input{width:90%;padding:14px;margin:10px;background:#000;border:1px solid #0F0;color:#0F0;border-radius:8px}.btn{width:95%;padding:14px;background:#0F0;color:#000;border:none;border-radius:8px;font-weight:900}</style></head><body><div class="box"><h2>🛡️ FORTRESS RANK</h2><form method="POST" action="/login"><input name="username" placeholder="Username"><input type="password" name="password" placeholder="Password"><button class="btn">دخول</button></form></div></body></html>`));
app.post('/login', async (req,res)=>{
  const {username, password} = req.body;
  if(username === ADMIN_USER && await bcrypt.compare(password, ADMIN_PASS_HASH)){
    req.session.authenticated = true;
    res.redirect('/');
  } else res.redirect('/login');
});

// 2. الصفحة الرئيسية - توب الناشرين
app.get('/', requireAuth, async (req,res)=>{
  await db.read();
  const top = db.data.publishers.sort((a,b)=>b.products - a.products).slice(0,10);
  let html = `<h1>🏆 توب 10 ناشرين</h1><table border="1" style="color:#0F0;width:100%">`;
  top.forEach((p,i)=> html += `<tr><td>${i+1}</td><td>${p.name}</td><td>${p.products} منتج</td></tr>`);
  html += `</table><a href="/dashboard">لوحة التحكم</a> <a href="/logout">خروج</a>`;
  res.send(html);
});

// 3. لوحة التحكم للادمن
app.get('/dashboard', requireAuth, (req,res)=> res.sendFile(path.join(__dirname, 'dashboard.html')));

// 4. API خارجي - اي موقع يربط معانا
app.post('/api/publish', requireApiKey, async (req,res)=>{
  const { publisher } = req.body;
  await db.read();
  let pub = db.data.publishers.find(p=>p.name === publisher);
  if(pub) pub.products += 1;
  else db.data.publishers.push({ name: publisher, products: 1 });
  await db.write();
  res.json({ success: true, message: `${publisher} +1 product` });
});

// 5. API لاخذ الترتيب
app.get('/api/leaderboard', requireApiKey, async (req,res)=>{
  await db.read();
  res.json(db.data.publishers.sort((a,b)=>b.products - a.products));
});

app.get('/logout', (req,res)=>{ req.session.destroy(); res.redirect('/login'); });

app.listen(PORT, ()=> console.log(`🔒 FORTRESS RANK ACTIVE`));
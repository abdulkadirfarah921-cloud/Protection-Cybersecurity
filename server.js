const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const DB_FILE = 'db.json';

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const data = { users: [], publishers: [], files: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return data;
  }
  return JSON.parse(fs.readFileSync(DB_FILE));
}
let db = readDB();

// ===== بيانات الادمن =====
const ADMIN_USER = "admin";
const ADMIN_PASS = "Fortress@2026_New"; // الباسورد هنا مباشر

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({ secret: crypto.randomBytes(64).toString('hex'), resave: false, saveUninitialized: false, cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 }}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/login');
}

app.get('/', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Fortress</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:40px;text-align:center} a{color:#0F0;margin:0 10px}</style></head><body><h1>🛡️ FORTRESS CYBERSECURITY SERVER</h1><p>السيرفر شغال 100% ✅</p><a href="/buy">رابط الدفع</a> | <a href="/login">دخول الادمن</a></body></html>`));

app.get('/buy', (req,res)=> res.sendFile(path.join(__dirname, 'buy.html')));
app.get('/terms', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Terms</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:40px;line-height:1.8}</style></head><body><h1>Terms of Service</h1><p>Digital product - No refunds.</p><a href="/">رجوع</a></body></html>`));
app.get('/privacy', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Privacy</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:40px;line-height:1.8}</style></head><body><h1>Privacy Policy</h1><p>We use Paddle for payments.</p><a href="/">رجوع</a></body></html>`));
app.get('/refund', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Refund</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:40px;line-height:1.8}</style></head><body><h1>Refund Policy</h1><p>Digital licenses are non-refundable.</p><a href="/">رجوع</a></body></html>`));

app.get('/login', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>LOGIN</title><style>body{background:#000;color:#0F0;font-family:Cairo;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}.box{background:#111;padding:40px;border-radius:16px;border:2px solid #0F0;width:350px;text-align:center}input{width:90%;padding:14px;margin:10px;background:#000;border:1px solid #0F0;color:#0F0;border-radius:8px}.btn{width:95%;padding:14px;background:#0F0;color:#000;border:none;border-radius:8px;font-weight:900;cursor:pointer}</style></head><body><div class="box"><h2>🛡️ FORTRESS ADMIN</h2><form method="POST" action="/login"><input name="username" placeholder="Username" value="admin"><input type="password" name="password" placeholder="Password"><button class="btn">دخول</button></form></div></body></html>`));

app.post('/login', (req,res)=>{
  const {username, password} = req.body;
  if(username === ADMIN_USER && password === ADMIN_PASS){ // مقارنة مباشرة
    req.session.authenticated = true; 
    res.redirect('/admin');
  } else res.redirect('/login');
});

app.get('/admin', requireAuth, (req,res)=>{
  res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Admin</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:20px}</style></head><body><h1>🛡️ دخلت اللوحة بنجاح</h1><p>اليوزر: ${ADMIN_USER}</p><p>الباس: ${ADMIN_PASS}</p><a href="/logout">خروج</a></body></html>`);
});

app.get('/logout', (req,res)=>{ req.session.destroy(); res.redirect('/login'); });
app.listen(PORT, ()=> console.log(`🔒 FORTRESS V5 ACTIVE ON ${PORT}`));
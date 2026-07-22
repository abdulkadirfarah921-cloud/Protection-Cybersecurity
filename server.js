const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== بيانات الدخول - غيرهم =====
const ADMIN_USER = "admin";
const ADMIN_PASS = "Fortress@2026"; // الباسورد الحقي
const SALT_ROUNDS = 12;

// متغيرات الحماية
const loginAttempts = new Map(); // لتتبع المحاولات
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 دقيقة حظر
const MAX_ATTEMPTS = 3;

app.use(helmet({ contentSecurityPolicy: false, hsts: { maxAge: 31536000 } }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: crypto.randomBytes(64).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, sameSite: 'strict', maxAge: 1000 * 60 * 60 * 2 }
}));

// Rate Limit عام
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// الحارس
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/login');
}

// دالة فحص الحظر
function isLocked(ip) {
  const data = loginAttempts.get(ip);
  if (!data) return false;
  if (data.attempts >= MAX_ATTEMPTS && Date.now() < data.lockUntil) {
    return true;
  }
  if (Date.now() > data.lockUntil) loginAttempts.delete(ip);
  return false;
}

// صفحة الدخول
app.get('/login', (req,res)=>{
  res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>LOGIN</title><style>body{background:#000;color:#fff;font-family:Cairo;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}.box{background:#111;padding:40px;border-radius:16px;border:2px solid #FF0044;width:350px;text-align:center}input{width:90%;padding:14px;margin:10px 0;background:#222;border:1px solid #333;color:#fff;border-radius:8px;font-size:16px}.btn{width:95%;padding:14px;background:#FF0044;color:#fff;border:none;border-radius:8px;font-weight:900;cursor:pointer;font-size:16px}.error{color:#FF0044}</style></head><body><div class="box"><h2>🛡️ FORTRESS X</h2><p>مستوى الحماية: MAX</p>${req.query.error ? '<p class="error">❌ خطأ في اليوزر او الباسورد</p>' : ''}${req.query.locked ? '<p class="error">⛔ تم حظرك 15 دقيقة بسبب كثرة المحاولات</p>' : ''}<form method="POST" action="/login"><input type="text" name="username" placeholder="Username" required autocomplete="off"><input type="password" name="password" placeholder="Password" required autocomplete="off"><button class="btn">دخول</button></form></div></body></html>`);
});

// تسجيل الدخول مع حماية ضد التخمين
app.post('/login', async (req,res)=>{
  const ip = req.ip;
  if(isLocked(ip)) return res.redirect('/login?locked=1');

  const {username, password} = req.body;
  const isValid = (username === ADMIN_USER) && (password === ADMIN_PASS);

  if(isValid){
    loginAttempts.delete(ip);
    req.session.authenticated = true;
    return res.redirect('/');
  } else {
    const data = loginAttempts.get(ip) || { attempts: 0 };
    data.attempts += 1;
    if(data.attempts >= MAX_ATTEMPTS) data.lockUntil = Date.now() + LOCKOUT_TIME;
    loginAttempts.set(ip, data);
    await new Promise(r => setTimeout(r, 2000)); // تأخير 2 ثانية ضد البوتات
    return res.redirect('/login?error=1');
  }
});

app.get('/logout', (req,res)=>{ req.session.destroy(); res.redirect('/login'); });

// كل الصفحات محمية
app.get('/', requireAuth, (req,res)=> res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', requireAuth, (req,res)=> res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/pricing', requireAuth, (req,res)=> res.send(`<h1 style="color:#fff;text-align:center">الاسعار 5$</h1><a href="/">رجوع</a>`));
app.get('/privacy', requireAuth, (req,res)=> res.send(`<h1 style="color:#fff;text-align:center">الخصوصية</h1><a href="/">رجوع</a>`));
app.get('/terms', requireAuth, (req,res)=> res.send(`<h1 style="color:#fff;text-align:center">الشروط</h1><a href="/">رجوع</a>`));

app.listen(PORT, ()=> console.log(`🔒 FORTRESS X ACTIVE ON ${PORT}`));
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, 'logs/security.log');

// ===== 1. بيانات الدخول الخاصة فيك انت بس =====
const ADMIN_USER = "shadowking"; // غير اليوزر هنا
const ADMIN_PASS_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"; // الباسورد = admin123

if (!fs.existsSync('logs')) fs.mkdirSync('logs');
function log(type, msg, ip){
  const line = `[${new Date().toISOString()}] [${type}] [${ip}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

app.use(helmet({contentSecurityPolicy: false}));
app.use(rateLimit({ windowMs: 60*1000, max: 60 }));
app.use(cors());
app.use(express.json({limit: '1mb'}));
app.use(express.urlencoded({extended: true}));

// ===== 2. نظام الجلسات Session =====
app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // خليها true لو الموقع https
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8 // 8 ساعات
  }
}));

// ===== 3. حارس البوابة - ميدخلش الداشبورد الا لو مسجل =====
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  } else {
    log('UNAUTHORIZED_ACCESS', `Tried to access ${req.url}`, req.ip);
    return res.redirect('/login');
  }
}

// ===== 4. فلتر الهجمات =====
const blockedIPs = new Set();
const attackPatterns = [/union.*select/i, /<script/i, /\.\//, /etc\/passwd/, /cmd\.exe/, /eval\(/i, /' or 1=1/i];
app.use((req, res, next) => {
  const ip = req.ip;
  if(blockedIPs.has(ip)) return res.status(403).send('IP Banned');
  const url = req.url + JSON.stringify(req.body);
  for(let pattern of attackPatterns){
    if(pattern.test(url)){
      log('ATTACK_BLOCKED', `Pattern: ${pattern}`, ip);
      blockedIPs.add(ip);
      return res.status(403).json({error: "Attack detected"});
    }
  }
  next();
});

// ===== 5. صفحات تسجيل الدخول =====
app.get('/login', (req,res)=>{
  res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Login - FORTRESS</title><style>body{background:#000;color:#fff;font-family:Cairo;display:flex;justify-content:center;align-items:center;height:100vh}.box{background:#111;padding:40px;border-radius:16px;border:1px solid #FF0044;width:350px} input{width:100%;padding:12px;margin:10px 0;background:#222;border:1px solid #333;color:#fff;border-radius:8px}.btn{width:100%;padding:12px;background:#FF0044;color:#fff;border:none;border-radius:8px;font-weight:900;cursor:pointer}</style></head><body><div class="box"><h2>🛡️ FORTRESS ACCESS</h2><form method="POST" action="/login"><input type="text" name="username" placeholder="Username" required><input type="password" name="password" placeholder="Password" required><button class="btn">دخول</button></form></div></body></html>`);
});

app.post('/login', async (req,res)=>{
  const {username, password} = req.body;
  const match = (username === ADMIN_USER) && await bcrypt.compare(password, ADMIN_PASS_HASH);

  if(match){
    req.session.authenticated = true;
    log('LOGIN_SUCCESS', `Admin logged in`, req.ip);
    res.redirect('/dashboard');
  } else {
    log('LOGIN_FAILED', `Wrong login attempt: ${username}`, req.ip);
    res.status(401).send('❌ Username or Password incorrect');
  }
});

app.get('/logout', (req,res)=>{
  req.session.destroy();
  res.redirect('/login');
});

// ===== 6. حماية الداشبورد =====
app.get('/dashboard', requireAuth, (req,res)=> res.sendFile(path.join(__dirname, 'dashboard.html')));

// ===== 7. باقي الصفحات العامة =====
app.get('/', (req,res)=> res.sendFile(path.join(__dirname, 'index.html')));
app.get('/pricing', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>الاسعار</title><style>body{background:#050505;color:#fff;font-family:Cairo;text-align:center;padding:50px}.btn{background:#0078F2;color:#fff;padding:15px 30px;border-radius:8px;text-decoration:none;font-weight:900}</style></head><body><h1>رسوم نشر المنتج: 5$</h1><a href="/" class="btn">العودة</a></body></html>`));
app.get('/privacy', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>الخصوصية</title><style>body{background:#050505;color:#fff;font-family:Cairo;padding:40px;line-height:2;max-width:800px;margin:auto}</style></head><body><h1>سياسة الخصوصية</h1><p>جميع المدفوعات تتم عبر Paddle.</p><a href="/">العودة</a></body></html>`));
app.get('/terms', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>الشروط</title><style>body{background:#050505;color:#fff;font-family:Cairo;padding:40px;line-height:2;max-width:800px;margin:auto}</style></head><body><h1>الشروط</h1><p>منصة بيع تراخيص رقمية.</p><a href="/">العودة</a></body></html>`));

// ===== 8. API الصحة =====
app.get('/api/health', requireAuth, (req,res)=>{ // خليتها لازم تسجيل دخول برضو
  res.json({cpu: os.cpus()[0].model, load: os.loadavg(), ram: {total: os.totalmem(), free: os.freem()}, uptime: os.uptime(), status: 'SECURE'});
});

app.listen(PORT, ()=> console.log(`🔒 FORTRESS ACTIVE ON PORT ${PORT}`));
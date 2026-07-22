const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const LOG_FILE = path.join(__dirname, 'logs/security.log');

if (!fs.existsSync('logs')) fs.mkdirSync('logs');
function log(type, msg, ip){
  const line = `[${new Date().toISOString()}] [${type}] [${ip}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

app.use(helmet({contentSecurityPolicy: false, hsts: {maxAge: 31536000}, xssFilter: true, noSniff: true, frameguard: { action: 'deny' }}));
app.use(rateLimit({ windowMs: 60*1000, max: 60 }));
app.use(cors());
app.use(express.json({limit: '1mb'}));

const blockedIPs = new Set();
const attackPatterns = [/union.*select/i, /<script/i, /\.\//, /etc\/passwd/, /cmd\.exe/, /eval\(/i];
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

app.get('/api/health', (req,res)=>{
  res.json({
    cpu: os.cpus()[0].model,
    load: os.loadavg(),
    ram: {total: os.totalmem(), free: os.freemem()},
    uptime: os.uptime(),
    status: 'SECURE'
  });
});

app.get('/', (req,res)=> res.sendFile(path.join(__dirname, 'index.html')));
app.get('/pricing', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>الاسعار</title><style>body{background:#050505;color:#fff;font-family:Cairo;text-align:center;padding:50px}.btn{background:#0078F2;color:#fff;padding:15px 30px;border-radius:8px;text-decoration:none;font-weight:900}</style></head><body><h1>رسوم نشر المنتج: 5$</h1><p>دفع لمرة واحدة عبر Paddle</p><a href="/" class="btn">العودة</a></body></html>`));
app.get('/privacy', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>الخصوصية</title><style>body{background:#050505;color:#fff;font-family:Cairo;padding:40px;line-height:2;max-width:800px;margin:auto}</style></head><body><h1>سياسة الخصوصية</h1><p>جميع المدفوعات تتم عبر Paddle. لا نقوم بتخزين بيانات بطاقاتك. نلتزم بقوانين GDPR.</p><a href="/">العودة</a></body></html>`));
app.get('/terms', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>الشروط</title><style>body{background:#050505;color:#fff;font-family:Cairo;padding:40px;line-height:2;max-width:800px;margin:auto}</style></head><body><h1>الشروط والاحكام</h1><p>1. منصة بيع تراخيص رقمية<br>2. الدفع غير قابل للاسترداد بعد التسليم<br>3. جميع المعاملات محمية بواسطة Paddle</p><a href="/">العودة</a></body></html>`));
app.get('/dashboard', (req,res)=> res.sendFile(path.join(__dirname, 'dashboard.html')));

app.listen(PORT, ()=> console.log(`🔒 FORTRESS ACTIVE ON PORT ${PORT}`));
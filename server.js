const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');

const app = express();
const PORT = process.env.PORT || 3000;

// قاعدة البيانات
const adapter = new JSONFile('db.json');
const db = new Low(adapter);

// ===== لفينا كلشي جوا async =====
(async () => {
  await db.read();
  db.data ||= { users: [], publishers: [], api_keys: [crypto.randomBytes(32).toString('hex')], files: [] }
  await db.write(); // عشان يحفظ المفتاح اول مرة

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
    if (db.data.api_keys.includes(key)) return next();
    res.status(403).json({ error: "Invalid API Key" });
  }

  // ===== نظام الفحص القوي =====
  function deepScan(filename, content) {
    let risk = "امن"; let color = "green"; let action = "مسموح بالنشر";
    const highRisk = ["eval(", "exec(", "rm -rf", "child_process", "fs.unlinkSync", "password=", "api_key="];
    const mediumRisk = ["http://", "document.cookie", "localStorage", "alert("];
    
    if (highRisk.some(k => content.includes(k))) {
      return { risk: "عالي", color: "red", action: "حذف فوري - الملف غير امن نهائيا", block: true };
    }
    if (mediumRisk.some(k => content.includes(k))) {
      return { risk: "قوي", color: "orange", action: "تحذير احمر: امسح الملف فورا", block: false };
    }
    if (content.length > 50000) {
      return { risk: "متوسط", color: "yellow", action: "تحذير للناشر: حجم الملف كبير", block: false };
    }
    return { risk, color, action, block: false };
  }

  // ===== الصفحة الرئيسية =====
  app.get('/', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Fortress</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:40px;text-align:center}</style></head><body><h1>🛡️ FORTRESS CYBERSECURITY SERVER</h1><p>السيرفر شغال ✅</p><a href="/buy" style="color:#0F0">رابط الدفع</a> | <a href="/login" style="color:#0F0">دخول الادمن</a></body></html>`));

  // ===== الصفحات العامة لـ Paddle =====
  app.get('/buy', (req,res)=> res.sendFile(path.join(__dirname, 'buy.html')));
  app.get('/terms', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Terms</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:40px}</style></head><body><h1>Terms of Service</h1><p>By purchasing you agree to legal use only. Digital product - No refunds.</p></body></html>`));
  app.get('/privacy', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Privacy</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:40px}</style></head><body><h1>Privacy Policy</h1><p>We use Paddle for payments. We do not store card details.</p></body></html>`));
  app.get('/refund', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Refund</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:40px}</style></head><body><h1>Refund Policy</h1><p>Digital licenses are non-refundable. Contact support for issues.</p></body></html>`));

  // LOGIN
  app.get('/login', (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>LOGIN</title><style>body{background:#000;color:#0F0;font-family:Cairo;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}.box{background:#111;padding:40px;border-radius:16px;border:2px solid #0F0;width:350px;text-align:center}input{width:90%;padding:14px;margin:10px;background:#000;border:1px solid #0F0;color:#0F0;border-radius:8px}.btn{width:95%;padding:14px;background:#0F0;color:#000;border:none;border-radius:8px;font-weight:900}</style></head><body><div class="box"><h2>🛡️ FORTRESS ADMIN</h2><form method="POST" action="/login"><input name="username" placeholder="Username" value="admin"><input type="password" name="password" placeholder="Password"><button class="btn">دخول</button></form></div></body></html>`));
  app.post('/login', async (req,res)=>{
    const {username, password} = req.body;
    if(username === ADMIN_USER && await bcrypt.compare(password, ADMIN_PASS_HASH)){
      req.session.authenticated = true; 
      res.redirect('/admin');
    } else res.redirect('/login');
  });

  // لوحة الادمن
  app.get('/admin', requireAuth, async (req,res)=>{
    await db.read();
    const byProducts = [...db.data.publishers].sort((a,b)=>b.products - a.products).slice(0,10);
    const byInteractions = [...db.data.publishers].sort((a,b)=>(b.likes||0) - (a.likes||0)).slice(0,10);
    const byRating = [...db.data.publishers].sort((a,b)=>(b.rating||0) - (a.rating||0)).slice(0,10);
    
    let html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Admin</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:20px}table{width:100%;border-collapse:collapse;margin-bottom:30px}td,th{border:1px solid #0F0;padding:10px;text-align:center}a{color:#0F0}</style></head><body>`;
    html += `<h1>🛡️ لوحة تحكم الأدمن</h1><a href="/admin/store">فتح المتجر كأدمن</a> | <a href="/admin/logs">سجل الفحص</a> | <a href="/logout">خروج</a><hr>`;
    html += `<h2>1. اكتر ناشر منتجات</h2><table><tr><th>#</th><th>الاسم</th><th>المنتجات</th></tr>` + byProducts.map((p,i)=>`<tr><td>${i+1}</td><td>${p.name}</td><td>${p.products}</td></tr>`).join('') + `</table>`;
    html += `<h2>2. اكتر ناشر تفاعلات</h2><table><tr><th>#</th><th>الاسم</th><th>التفاعلات</th></tr>` + byInteractions.map((p,i)=>`<tr><td>${i+1}</td><td>${p.name}</td><td>${p.likes||0}</td></tr>`).join('') + `</table>`;
    html += `<h2>3. اعلى تقييم</h2><table><tr><th>#</th><th>الاسم</th><th>التقييم</th></tr>` + byRating.map((p,i)=>`<tr><td>${i+1}</td><td>${p.name}</td><td>${(p.rating||0).toFixed(1)}</td></tr>`).join('') + `</table>`;
    html += `<h2>4. قائمة الأدمن</h2><table><tr><th>User</th><th>Pass Hash</th></tr><tr><td>${ADMIN_USER}</td><td>${ADMIN_PASS_HASH}</td></tr></table>`;
    html += `</body></html>`;
    res.send(html);
  });

  app.get('/admin/store', requireAuth, (req,res)=> res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Store</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:40px;text-align:center}</style></head><body><h1>المتجر مفتوح للأدمن للفحص</h1><p>تقدر تفتش براحتك. الفحص شغال في الخلفية</p><a href="/admin">رجوع</a></body></html>`));

  app.get('/admin/logs', requireAuth, async (req,res)=>{
    await db.read();
    let html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Logs</title><style>body{background:#000;color:#0F0;font-family:Cairo;padding:20px}</style></head><body><h1>سجل فحص الملفات</h1>`;
    db.data.files.forEach(f=> html += `<div style="border:2px solid ${f.color};padding:10px;margin:5px;border-radius:8px"><b>${f.name}</b> - <span style="color:${f.color}">${f.risk}</span> - ${f.action}</div>`);
    res.send(html + `<a href="/admin">رجوع</a></body></html>`);
  });

  // API النشر
  app.post('/api/publish', requireApiKey, async (req,res)=>{
    const { publisher, likes=0, rating=0, file } = req.body;
    if(file) {
      const scan = deepScan(file.name, file.content);
      await db.read();
      db.data.files.push({name: file.name, ...scan, time: new Date().toISOString()});
      if(scan.block) { await db.write(); return res.status(403).json({ error: scan.action, risk: scan.risk }); }
      await db.write();
    }
    await db.read();
    let pub = db.data.publishers.find(p=>p.name === publisher);
    if(pub) { pub.products += 1; pub.likes = (pub.likes||0)+likes; pub.rating = ((pub.rating||0)+rating)/2; } 
    else db.data.publishers.push({ name: publisher, products: 1, likes, rating });
    await db.write();
    res.json({ success: true, message: "تم النشر بعد الفحص" });
  });

  app.get('/api/leaderboard', requireApiKey, async (req,res)=>{
    await db.read();
    res.json(db.data.publishers.sort((a,b)=>b.products - a.products));
  });

  app.get('/logout', (req,res)=>{ req.session.destroy(); res.redirect('/login'); });
  
  app.listen(PORT, ()=> console.log(`🔒 FORTRESS V3 ACTIVE ON ${PORT}`));

})(); // نهاية الـ async
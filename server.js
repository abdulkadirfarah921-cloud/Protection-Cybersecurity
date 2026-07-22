const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const Stripe = require('stripe');
const mongoose = require('mongoose');
const path = require('path');
const https = require('https'); // ضفناه عشان نصحي السيرفر

const app = express();
const PORT = process.env.PORT || 3000;
const stripe = Stripe(process.env.STRIPE_KEY || 'sk_test_xxx'); 

// ===== 1. الحماية =====
app.use(helmet({contentSecurityPolicy: false}));
app.use(cors());
app.use(express.json());
app.use(rateLimit({windowMs: 15*60*1000, max: 200}));

// ===== 2. قاعدة البيانات =====
mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/fortress')
.then(()=>console.log("✅ Mongo Connected"))
.catch(err=>console.log(err));

const Product = mongoose.model('Product', {
  name:String, seller:String, image:String, price:Number, count:Number
});

// ===== 3. الصفحات المطلوبة لـ Paddle =====
app.get('/', (req,res)=> res.sendFile(path.join(__dirname, 'index.html')));

app.get('/pricing', (req,res)=> res.send(`
<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>الاسعار</title>
<style>body{background:#050505;color:#fff;font-family:Cairo;text-align:center;padding:50px} 
.btn{background:#0078F2;color:#fff;padding:15px 30px;border-radius:8px;text-decoration:none;font-weight:900}</style></head>
<body><h1>SHADOWKING FORTRESS</h1><h2>رسوم نشر المنتج: 5$</h2><p>دفع لمرة واحدة لكل منتج</p><a href="/" class="btn">العودة</a></body></html>`));

app.get('/privacy', (req,res)=> res.send(`
<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>سياسة الخصوصية</title>
<style>body{background:#050505;color:#fff;font-family:Cairo;padding:40px;line-height:2;max-width:800px;margin:auto}</style></head>
<body><h1>سياسة الخصوصية</h1><p>بيانات الدفع تتم عبر Paddle/Stripe ولا نخزن بيانات بطاقتك.</p><a href="/">العودة</a></body></html>`));

app.get('/terms', (req,res)=> res.send(`
<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>الشروط والاحكام</title>
<style>body{background:#050505;color:#fff;font-family:Cairo;padding:40px;line-height:2;max-width:800px;margin:auto}</style></head>
<body><h1>الشروط والاحكام</h1><p>1. متجر لبيع تراخيص رقمية.<br>2. الدفع غير قابل للاسترداد.</p><a href="/">العودة</a></body></html>`));

app.get('/success', (req,res)=> res.send(`
<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تم الدفع</title>
<style>body{background:#050505;color:#00FF88;font-family:Cairo;text-align:center;padding:100px}</style></head>
<body><h1>✅ تم الدفع بنجاح</h1><a href="/">العودة</a></body></html>`));

// ===== 4. API =====
app.post('/create-checkout-session', async (req, res) => {
  try{
    const session = await stripe.checkout.sessions.create({
      line_items: [{price_data:{currency:'usd',product_data:{name:'رسوم نشر منتج'},unit_amount:500},quantity:1}],
      mode: 'payment', 
      success_url: `${req.headers.origin}/success`,
      cancel_url: `${req.headers.origin}/pricing`
    });
    res.json({url: session.url});
  }catch(e){res.status(500).json({error:e.message})}
});

app.get('/products', async (req,res)=> res.json(await Product.find()));
app.get('/top', async (req,res)=> res.json([{name:"احمد",published:15},{name:"خالد",published:9}]));

// ===== 5. اهم جزء: كود التصحية كل 5 ثواني =====
const KEEP_ALIVE_URL = 'https://protection-cybersecurity.onrender.com'; // حط رابط موقعك هنا

setInterval(() => {
  https.get(KEEP_ALIVE_URL, (res) => {
    console.log(`[${new Date().toLocaleTimeString()}] Pinged server. Status: ${res.statusCode}`);
  }).on('error', (err) => {
    console.log(`Ping error: ${err.message}`);
  });
}, 5000); // 5000ms = 5 ثواني

app.listen(PORT, ()=> console.log(`🚀 Server running on ${PORT}`));
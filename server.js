const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const Stripe = require('stripe');
const mongoose = require('mongoose');

const app = express();
const stripe = Stripe(process.env.STRIPE_KEY); // حطه بالـ Env

// ===== الحماية =====
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({windowMs: 15*60*1000, max: 200}));

mongoose.connect(process.env.MONGO_URL); // من MongoDB Atlas

const Product = mongoose.model('Product', {name:String, seller:String, image:String, price:Number, count:Number});

// دفع امن
app.post('/create-checkout-session', async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    line_items: [{price_data:{currency:'usd',product_data:{name:'رسوم نشر'},unit_amount:500},quantity:1}],
    mode: 'payment', success_url: 'https://your-site.pages.dev/success'
  });
  res.json({url: session.url});
});

app.get('/products', async (req,res)=> res.json(await Product.find()));
app.get('/top', async (req,res)=> res.json([{name:"احمد",published:15},{name:"خالد",published:9}]));

app.listen(3000);
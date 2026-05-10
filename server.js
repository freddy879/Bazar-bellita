require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Caja } = require('./caja');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ================== DEBUG ==================
console.log("USER:", process.env.MONGO_USER);
console.log("DB:", process.env.MONGO_DB);

// ================== MONGO CONFIG ==================
const user = process.env.MONGO_USER;
const pass = encodeURIComponent(process.env.MONGO_PASS);
const db = process.env.MONGO_DB;

const URI = `mongodb+srv://${user}:${pass}@cluster0.8otlbi7.mongodb.net/${db}?retryWrites=true&w=majority`;

// ================== CONEXIÓN MONGO ==================
mongoose.set('strictQuery', false);

mongoose.connect(URI, {
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 20,
  socketTimeoutMS: 45000,
})
.then(() => console.log("✅ Mongo conectado rápido"))
.catch(err => console.log("❌ Error Mongo:", err));

// ================== MODELOS ==================
const Producto = mongoose.model('Producto', {
  nombre: String,
  codigo: String,
  precioVenta: Number,
  precioCompra: Number,
  stock: Number
});

const Venta = mongoose.models.Venta || mongoose.model('Venta', {
  cliente: String,
  cedula: String,
  correo: String,
  celular: String,
  productos: Array,
  total: Number,
  tipo: String,
  meses: Number,
  pago: Number,
  vuelto: Number,
  fecha: { type: Date, default: Date.now }
});

const Deuda = mongoose.models.Deuda || mongoose.model('Deuda', {
  cliente: String,
  cedula: String,
  celular: String,
  direccion: String,
  total: Number,
  pagado: { type: Number, default: 0 },
  productos: { type: Array, default: [] },
  pagos: [{ monto: Number, fecha: { type: Date, default: Date.now } }],
  fecha: { type: Date, default: Date.now }
});

const Cliente = mongoose.models.Cliente || mongoose.model('Cliente', {
  nombre: String,
  cedula: String,
  direccion: String,
  telefono: String,
  correo: String,
  deudaTotal: { type: Number, default: 0 },
  deudaActual: { type: Number, default: 0 },
  estado: { type: String, default: "normal" },
  fecha: { type: Date, default: Date.now }
});

// ================== HEALTH ==================
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    message: "Servidor activo",
    time: new Date()
  });
});

// ================== DEUDAS ==================
app.get('/deudas', async (req, res) => {
  res.json(await Deuda.find().sort({ fecha: -1 }));
});

app.post('/deudas', async (req, res) => {
  try {
    let nueva = new Deuda(req.body);
    await nueva.save();
    res.json(nueva);
  } catch (err) {
    res.status(500).json({ error: "Error al crear deuda" });
  }
});

app.put('/deudas/:id', async (req, res) => {
  try {
    const deuda = await Deuda.findById(req.params.id);
    if (!deuda) return res.status(404).json({ error: "No encontrada" });

    Object.assign(deuda, req.body);
    await deuda.save();

    res.json({ ok: true, deuda });

  } catch (err) {
    res.status(500).json({ error: "Error al editar deuda" });
  }
});

app.delete('/deudas/:id', async (req, res) => {
  await Deuda.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ================== CLIENTES ==================
app.post('/clientes', async (req, res) => {
  const cliente = new Cliente(req.body);
  await cliente.save();
  res.json({ ok: true, cliente });
});

app.get('/clientes', async (req, res) => {
  res.json(await Cliente.find().sort({ fecha: -1 }));
});

app.get('/clientes/:cedula', async (req, res) => {
  res.json(await Cliente.findOne({ cedula: req.params.cedula }));
});

// ================== PRODUCTOS ==================
app.get('/productos', async (req, res) => {
  res.json(await Producto.find());
});

app.post('/productos', async (req, res) => {
  await new Producto(req.body).save();
  res.json({ ok: true });
});

// ================== VENTAS ==================
app.post('/ventas', async (req, res) => {
  try {

    const venta = new Venta(req.body);
    await venta.save();

    // caja ingresos
    if (req.body.tipo === "efectivo") {
      let caja = await Caja.findOne({ activa: true });
      if (caja) {
        caja.ingresos += Number(req.body.total);
        await caja.save();
      }
    }

    // deuda
    if (req.body.tipo === "credito") {
      await new Deuda(req.body).save();
    }

    res.json({ ok: true, venta });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== CAJA ==================
app.post('/caja/abrir', async (req, res) => {
  let caja = await Caja.findOne({ activa: true });

  if (caja) {
    caja.activa = false;
    await caja.save();
  }

  await new Caja({
    apertura: req.body.monto,
    ingresos: 0,
    gastos: 0,
    activa: true
  }).save();

  res.json({ ok: true });
});

app.get('/caja', async (req, res) => {
  res.json(await Caja.findOne({ activa: true }));
});

// ================== SERVER ==================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 http://localhost:" + PORT);
});

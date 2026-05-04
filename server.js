require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ================== DEBUG ==================
console.log("USER:", process.env.MONGO_USER);
console.log("DB:", process.env.MONGO_DB);

// ================== MONGO ==================
const user = process.env.MONGO_USER;
const pass = encodeURIComponent(process.env.MONGO_PASS);
const db = process.env.MONGO_DB;

const URI = `mongodb+srv://${user}:${pass}@cluster0.8otlbi7.mongodb.net/${db}?retryWrites=true&w=majority`;

mongoose.connect(URI)
.then(() => console.log("✅ Mongo conectado"))
.catch(err => console.log("❌ Error Mongo:", err.message));

// ================== MODELOS ==================
const Producto = mongoose.model('Producto', {
  nombre: String,
  codigo: String,
  precioVenta: Number,
  precioCompra: Number,
  stock: Number
});

const Venta = mongoose.model('Venta', {
  cliente: String,
  cedula: String,
  productos: Array,
  total: Number,
  tipo: String,
  meses: Number,
  fecha: { type: Date, default: Date.now }
});

const Deuda = mongoose.model('Deuda', {
  cliente: String,
  cedula: String,
  direccion: String,
  total: Number,
  pagado: { type: Number, default: 0 },
  pagos: [
    {
      monto: Number,
      fecha: { type: Date, default: Date.now }
    }
  ],
  fecha: { type: Date, default: Date.now }
});

const Caja = mongoose.model('Caja', {
  fecha: { type: Date, default: Date.now },
  horaCierre: Date,
  apertura: Number,
  cierre: Number,
  ingresos: { type: Number, default: 0 },
  gastos: { type: Number, default: 0 },
  activa: { type: Boolean, default: false }
});

// ================== 👇 NUEVO: MODELO CLIENTES (ARREGLA TU ERROR) ==================
const Cliente = mongoose.model('Cliente', {
  nombre: String,
  cedula: String,
  direccion: String,
  telefono: String,
  fecha: { type: Date, default: Date.now }
});

// ================== CLIENTES ==================
app.post('/clientes', async (req, res) => {
  try {
    await new Cliente(req.body).save();
    res.json({ ok: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error al guardar cliente" });
  }
});

app.get('/clientes', async (req, res) => {
  res.json(await Cliente.find().sort({ fecha: -1 }));
});

// 🔥 buscar por cédula (VENTA)
app.get('/clientes/:cedula', async (req, res) => {
  const cliente = await Cliente.findOne({ cedula: req.params.cedula });
  res.json(cliente);
});

// ================== ELIMINAR CLIENTE ==================
app.delete('/clientes/:id', async (req, res) => {

  try {
    const cliente = await Cliente.findById(req.params.id);

    if (!cliente) {
      return res.json({ error: "Cliente no encontrado" });
    }

    await Cliente.findByIdAndDelete(req.params.id);

    res.json({ ok: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error interno" });
  }

});

// ================== PRODUCTOS ==================
app.get('/productos', async (req, res) => {
  res.json(await Producto.find());
});

app.post('/productos', async (req, res) => {
  await new Producto(req.body).save();
  res.json({ ok: true });
});

app.put('/productos/:id', async (req, res) => {
  await Producto.findByIdAndUpdate(req.params.id, req.body);
  res.json({ ok: true });
});

app.put('/productos/agregar/:id', async (req, res) => {
  const p = await Producto.findById(req.params.id);
  if (!p) return res.json({ error: "No existe" });

  p.stock += Number(req.body.cantidad);
  await p.save();

  res.json({ ok: true });
});

app.put('/productos/vender/:id', async (req, res) => {
  const p = await Producto.findById(req.params.id);
  if (!p) return res.json({ error: "No existe" });

  p.stock -= Number(req.body.cantidad);
  if (p.stock < 0) p.stock = 0;

  await p.save();

  res.json({ ok: true });
});

// ================== ELIMINAR PRODUCTO ==================
app.delete('/productos/:id', async (req, res) => {
  try {
    await Producto.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error interno" });
  }
});

// ================== VENTAS ==================
app.post('/ventas', async (req, res) => {
  await new Venta(req.body).save();

  if (req.body.tipo === "efectivo") {
    let caja = await Caja.findOne({ activa: true });

    if (caja) {
      caja.ingresos += Number(req.body.total || 0);
      await caja.save();
    }
  }

  res.json({ ok: true });
});

// ================== BORRAR HISTORIAL VENTAS ==================
app.delete('/ventas', async (req, res) => {
  await Venta.deleteMany({});
  res.json({ ok: true });
});

// ================== DEUDAS ==================
app.post('/deudas', async (req, res) => {
  await new Deuda({
    ...req.body,
    pagado: 0,
    pagos: []
  }).save();

  res.json({ ok: true });
});

app.get('/deudas', async (req, res) => {
  res.json(await Deuda.find().sort({ fecha: -1 }));
});

// ================== ELIMINAR DEUDA ==================
app.delete('/deudas/:id', async (req, res) => {
  await Deuda.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ================== ABONAR ==================
app.post('/deudas/pagar', async (req, res) => {
  const { id, monto } = req.body;

  let deuda = await Deuda.findById(id);
  if (!deuda) return res.json({ error: "Deuda no encontrada" });

  let pago = Number(monto);
  if (isNaN(pago) || pago <= 0) {
    return res.json({ error: "Monto inválido" });
  }

  let restante = deuda.total - deuda.pagado;

  if (pago > restante) {
    return res.json({ error: "No puedes pagar más de la deuda" });
  }

  deuda.pagado += pago;

  deuda.pagos.push({
    monto: pago,
    fecha: new Date()
  });

  await deuda.save();

  res.json({
    cliente: deuda.cliente,
    monto: pago,
    total: deuda.total,
    restante: deuda.total - deuda.pagado,
    pagos: deuda.pagos
  });
});

// ================== CAJA ==================
app.post('/caja/abrir', async (req, res) => {
  let monto = Number(req.body.monto);

  let abierta = await Caja.findOne({ activa: true });

  if (abierta) {
    abierta.activa = false;
    abierta.horaCierre = new Date();
    await abierta.save();
  }

  await new Caja({
    apertura: monto,
    ingresos: 0,
    gastos: 0,
    activa: true
  }).save();

  res.json({ ok: true });
});

app.get('/caja', async (req, res) => {
  let caja = await Caja.findOne({ activa: true });
  if (!caja) return res.json(null);

  res.json({
    apertura: caja.apertura,
    ingresos: caja.ingresos,
    gastos: caja.gastos,
    saldo: caja.apertura + caja.ingresos - caja.gastos
  });
});

app.post('/caja/gasto', async (req, res) => {
  let caja = await Caja.findOne({ activa: true });

  if (!caja) return res.json({ error: "Caja no abierta" });

  caja.gastos += Number(req.body.monto || 0);

  await caja.save();

  res.json({ ok: true });
});

app.post('/caja/cerrar', async (req, res) => {
  let caja = await Caja.findOne({ activa: true });
  if (!caja) return res.json({ error: "Caja no abierta" });

  let real = Number(req.body.montoReal);

  let esperado = caja.apertura + caja.ingresos - caja.gastos;
  let diferencia = real - esperado;

  caja.activa = false;
  caja.cierre = real;
  caja.horaCierre = new Date();

  await caja.save();

  res.json({
    apertura: caja.apertura,
    ingresos: caja.ingresos,
    gastos: caja.gastos,
    esperado,
    real,
    diferencia
  });
});

// ================== ANALISIS ==================
app.get('/analisis', async (req, res) => {
  const ventas = await Venta.find();

  let total = 0;
  ventas.forEach(v => total += Number(v.total || 0));

  res.json({
    totalGeneral: total,
    ventas
  });
});

// ================== SERVER ==================
// ================== SERVER ==================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 http://localhost:" + PORT);
});

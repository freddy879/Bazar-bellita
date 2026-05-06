require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express(); // 👈 PRIMERO CREAS app


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
  maxPoolSize: 20,        // 🔥 más conexiones
  socketTimeoutMS: 45000, // 🔥 evita cortes
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

const Venta = mongoose.model('Venta', {
  cliente: String,
  cedula: String,
  productos: Array,
  total: Number,
  tipo: String,
  meses: Number,
  fecha: { type: Date, default: Date.now }
});

// ================== DEUDAS ==================
const Deuda = mongoose.model('Deuda', {
  cliente: String,
  cedula: String,
  celular: String,
  direccion: String,
  total: Number,
  pagado: { type: Number, default: 0 },

  productos: { type: Array, default: [] },

  pagos: [
    {
      monto: Number,
      fecha: { type: Date, default: Date.now }
    }
  ],

  fecha: { type: Date, default: Date.now }
});


app.get('/deudas', async (req, res) => {
  res.json(await Deuda.find().sort({ fecha: -1 }));
});

app.delete('/deudas/:id', async (req, res) => {
  await Deuda.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
// ================== CAJA ==================
app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Servidor activo",
    time: new Date()
  });
});

const Caja = mongoose.model('Caja', {
  fecha: { type: Date, default: Date.now },
  horaCierre: Date,
  apertura: Number,
  cierre: Number,
  ingresos: { type: Number, default: 0 },
  gastos: { type: Number, default: 0 },
  activa: { type: Boolean, default: false },

  movimientos: [
    {
      tipo: String,
      monto: Number,
      motivo: String,
      fecha: { type: Date, default: Date.now }
    }
  ],

  dejado: { type: Number, default: 0 }
});

// ================== EDITAR DEUDA ==================
app.put('/deudas/editar', async (req, res) => {
  try {
    const { id, cedula, celular } = req.body;

    let deuda = await Deuda.findById(id);
    if (!deuda) return res.json({ error: "No encontrada" });

    deuda.cedula = cedula;
    deuda.celular = celular;

    await deuda.save();

    res.json({ ok: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error al editar" });
  }
});

// ================== CLIENTES ==================
const Cliente = mongoose.model('Cliente', {
  nombre: String,
  cedula: String,
  direccion: String,
  telefono: String,
  fecha: { type: Date, default: Date.now }
});

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

app.get('/clientes/:cedula', async (req, res) => {
  const cliente = await Cliente.findOne({ cedula: req.params.cedula });
  res.json(cliente);
});

app.delete('/clientes/:id', async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.params.id);
    if (!cliente) return res.json({ error: "Cliente no encontrado" });

    await Cliente.findByIdAndDelete(req.params.id);
    res.json({ ok: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error interno" });
  }
});

// ================= EDITAR CLIENTE =================
app.put('/clientes/editar', async (req, res) => {
  try {
    const { id, nombre, cedula, telefono } = req.body;

    let cliente = await Cliente.findById(id);
    if (!cliente) return res.json({ error: "No encontrado" });

    cliente.nombre = nombre;
    cliente.cedula = cedula;
    cliente.telefono = telefono;

    await cliente.save();

    res.json({ ok: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error al editar cliente" });
  }
});

// ================== PRODUCTOS ==================
app.get('/productos', async (req, res) => {
  try {
    res.json(await Producto.find());
  } catch (err) {
    console.log("Error productos:", err.message);
    res.json([]);
  }
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

  // 🔥 GUARDAR VENTA
  await new Venta(req.body).save();

  // ================= EFECTIVO =================
  if (req.body.tipo === "efectivo") {

    let caja = await Caja.findOne({ activa: true });

    if (caja) {
      caja.ingresos += Number(req.body.total || 0);

      if (!caja.movimientos) caja.movimientos = [];
      caja.movimientos.push({
        tipo: "ingreso",
        monto: req.body.total,
        motivo: "Venta"
      });

      await caja.save();
    }
  }

  // ================= CREDITO =================
  if (req.body.tipo === "credito") {

    await new Deuda({
      cliente: req.body.cliente,
      cedula: req.body.cedula || "SIN CÉDULA",
      celular: req.body.celular || "", // 🔥 FIX
      direccion: "",
      total: req.body.total,
      pagado: 0,
      productos: req.body.productos || [],
      pagos: []
    }).save();

  }

  res.json({ ok: true });
});

//-------Deuda-----------
app.post('/deudas', async (req, res) => {
  try {

  let nueva = new Deuda({
  cliente: req.body.cliente || "",
  cedula: req.body.cedula || "-",
  celular: req.body.celular || "",
  direccion: req.body.direccion || "",

  total: Number(req.body.total || 0),
  pagado: 0,

  productos: req.body.productos || [],
  pagos: [],
  fecha: new Date()
});

await nueva.save();

res.json(nueva);;

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error al crear deuda" });
  }
});
// ================== ABONAR ==================
app.post('/deudas/pagar', async (req, res) => {

  let deuda = await Deuda.findById(req.body.id);
  if (!deuda) return res.json({ error: "Deuda no encontrada" });

  let monto = Number(req.body.monto);
  if (!monto || monto <= 0) return res.json({ error: "Monto inválido" });

  let restante = deuda.total - deuda.pagado;

  if (monto > restante) return res.json({ error: "No puedes pagar más de la deuda" });

  deuda.pagado += monto;

  deuda.pagos.push({
    monto,
    fecha: new Date()
  });

  await deuda.save();

  let caja = await Caja.findOne({ activa: true });

  if (caja) {
    caja.ingresos += monto;

    if (!caja.movimientos) caja.movimientos = [];
    caja.movimientos.push({
      tipo: "ingreso",
      monto,
      motivo: "Abono deuda"
    });

    await caja.save();
  }

  res.json({
    cliente: deuda.cliente,
    celular: deuda.celular || "",
    monto,
    total: deuda.total,
    restante: deuda.total - deuda.pagado,
    pagos: deuda.pagos || [],
    productos: deuda.productos || []
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
    activa: true,
    movimientos: [
      {
        tipo: "inicio",
        monto,
        motivo: "Apertura de caja"
      }
    ]
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
    saldo: caja.apertura + caja.ingresos - caja.gastos,
    movimientos: caja.movimientos || [],
    dejado: caja.dejado || 0
  });
});

app.post('/caja/gasto', async (req, res) => {
  let caja = await Caja.findOne({ activa: true });

  if (!caja) return res.json({ error: "Caja no abierta" });

  let monto = Number(req.body.monto || 0);
  let motivo = req.body.motivo || "Sin motivo";

  caja.gastos += monto;

  if (!caja.movimientos) caja.movimientos = [];

  caja.movimientos.push({
    tipo: "gasto",
    monto,
    motivo
  });

  await caja.save();

  res.json({ ok: true });
});

// ================== CIERRE CAJA ==================
app.post('/caja/cerrar', async (req, res) => {

  let caja = await Caja.findOne({ activa: true });
  if (!caja) return res.json({ error: "Caja no abierta" });

  let real = Number(req.body.montoReal);
  let dejar = Number(req.body.dejar || 0);

  let esperado = caja.apertura + caja.ingresos - caja.gastos;
  let diferencia = real - esperado;

  caja.activa = false;
  caja.cierre = real;
  caja.horaCierre = new Date();
  caja.dejado = dejar;

  if (!caja.movimientos) caja.movimientos = [];

  caja.movimientos.push({
    tipo: "cierre",
    monto: real,
    motivo: `Cierre de caja | Dejado: $${dejar}`
  });

  await caja.save();

  if (dejar > 0) {
    await new Caja({
      apertura: dejar,
      ingresos: 0,
      gastos: 0,
      activa: true
    }).save();
  }

  res.json({
    apertura: caja.apertura,
    ingresos: caja.ingresos,
    gastos: caja.gastos,
    esperado,
    real,
    diferencia,
    dejar,
    movimientos: caja.movimientos || []
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

app.delete('/ventas/fecha', async (req, res) => {

  let fecha = req.body.fecha;

  let inicio = new Date(fecha);
  let fin = new Date(fecha);
  fin.setDate(fin.getDate() + 1);

  await Venta.deleteMany({
    fecha: {
      $gte: inicio,
      $lt: fin
    }
  });

  res.json({ ok: true });
});


// ================== SERVER ==================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 http://localhost:" + PORT);
});

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Caja } = require('./caja');

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
exports.Deuda = Deuda;


app.get('/deudas', async (req, res) => {
  res.json(await Deuda.find().sort({ fecha: -1 }));
});


// ================== ELIMINAR DEUDA ==================
app.delete('/deudas/:id', async (req, res) => {

  try {

    await Deuda.findByIdAndDelete(req.params.id);

    res.json({ ok: true });

  } catch(err){

    console.log(err);
    res.status(500).json({ error: "Error al eliminar" });

  }

});


// ================== CAJA ==================
app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Servidor activo",
    time: new Date()
  });
});

// ================== EDITAR DEUDA ==================
app.put('/deudas/:id', async (req, res) => {

  try {
    console.log(req.body);
    
    const deuda = await Deuda.findById(req.params.id);

    if(!deuda){
      return res.status(404).json({
        error: "Deuda no encontrada"
      });
    }
    if(req.body.cliente !== undefined){
    deuda.cliente = req.body.cliente;
    }

   if(req.body.cedula !== undefined){
   deuda.cedula = req.body.cedula;
   }

   if(req.body.celular !== undefined){
   deuda.celular = req.body.celular;
   }

   if(req.body.direccion !== undefined){
   deuda.direccion = req.body.direccion;
   }

   if(req.body.total !== undefined){
  deuda.total = Number(req.body.total);
  }

 
    await deuda.save();

    res.json({
      ok: true,
      mensaje: "Deuda editada correctamente",
      deuda
    });

  } catch(err){

    console.log(err);

    res.status(500).json({
      error: "Error al editar deuda"
    });

  }

});


 // ================== CLIENTES ==================
const Cliente = mongoose.model('Cliente', {

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


// ================== CREAR CLIENTE ==================
app.post('/clientes', async (req, res) => {
  try {

    const cliente = new Cliente(req.body);
    await cliente.save();

    res.json({ ok: true, cliente });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error al guardar cliente" });
  }
});


// ================== LISTAR CLIENTES ==================
app.get('/clientes', async (req, res) => {
  try {
    const clientes = await Cliente.find().sort({ fecha: -1 });
    res.json(clientes);
  } catch (err) {
    console.log(err);
    res.status(500).json([]);
  }
});


// ================== BUSCAR CLIENTE POR CÉDULA ==================
app.get('/clientes/:cedula', async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ cedula: req.params.cedula });
    res.json(cliente || null);
  } catch (err) {
    console.log(err);
    res.status(500).json(null);
  }
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


// ================== 🔥 SINCRONIZAR DEUDA (IMPORTANTE) ==================
// 👉 LLÁMALO DESDE /deudas o /ventas cuando creas deuda

app.post('/clientes/sumar-deuda', async (req, res) => {

  try {

    const { cedula, total } = req.body;

    const cliente = await Cliente.findOne({ cedula });

    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    cliente.deudaTotal += Number(total);
    cliente.deudaActual += Number(total);
    cliente.estado = "deudor";

    await cliente.save();

    res.json({ ok: true, cliente });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error al actualizar deuda" });
  }
});


// ================== 🔥 ABONO A DEUDA ==================
// 👉 LLÁMALO cuando paguen deuda

app.post('/clientes/abonar', async (req, res) => {

  try {

    const { cedula, monto } = req.body;

    const cliente = await Cliente.findOne({ cedula });

    if (!cliente) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    cliente.deudaActual -= Number(monto);

    if (cliente.deudaActual <= 0) {
      cliente.deudaActual = 0;
      cliente.estado = "normal";
    }

    await cliente.save();

    res.json({ ok: true, cliente });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Error al abonar deuda" });
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
     celular: req.body.celular || "",
     direccion: req.body.direccion || "",
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

  // 🔥 NUEVO: FILTRAR SOLO GASTOS
  let gastosLista = caja.movimientos.filter(m => m.tipo === "gasto");

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
    gastosLista // 👈 🔥 AQUÍ ESTÁ LA CLAVE
  });
});

// ================== ANALISIS ==================
app.get('/analisis', async (req, res) => {

  const ventas = await Venta.find();

  let totalGeneral = 0;
  let productos = {};

  ventas.forEach(v => {

    let total = Number(v.total || 0);
    totalGeneral += total;

    if (v.productos && Array.isArray(v.productos)) {

      v.productos.forEach(p => {

        let nombre = p.nombre;
        let cantidad = Number(p.cantidad || 1);
        let precio = Number(p.precio || 0);
        let costo = Number(p.costo || 0);

        let ganancia = (precio - costo) * cantidad;

        if (!productos[nombre]) {
          productos[nombre] = {
            nombre,
            vendidos: 0,
            ganancia: 0
          };
        }

        productos[nombre].vendidos += cantidad;
        productos[nombre].ganancia += ganancia;
      });
    }
  });

  // 📊 convertir a array
  let lista = Object.values(productos);

  // 🔥 más vendidos
  let masVendidos = [...lista]
    .sort((a, b) => b.vendidos - a.vendidos)
    .slice(0, 5);

  // 📉 menos vendidos
  let menosVendidos = [...lista]
    .sort((a, b) => a.vendidos - b.vendidos)
    .slice(0, 5);

  // 💰 más ganancia
  let masGanancia = [...lista]
    .sort((a, b) => b.ganancia - a.ganancia)
    .slice(0, 5);

  // 💸 menos ganancia
  let menosGanancia = [...lista]
    .sort((a, b) => a.ganancia - b.ganancia)
    .slice(0, 5);

  // 🧠 IA de recomendaciones
  let recomendaciones = [];

  if (masGanancia.length > 0) {
    recomendaciones.push(`🔥 Enfócate en vender más: ${masGanancia[0].nombre}`);
  }

  if (menosGanancia.length > 0) {
    recomendaciones.push(`⚠️ Evita o mejora margen de: ${menosGanancia[0].nombre}`);
  }

  if (menosVendidos.length > 0) {
    recomendaciones.push(`📦 Revisa stock o marketing de: ${menosVendidos[0].nombre}`);
  }

  if (totalGeneral < 1000) {
    recomendaciones.push("🚨 Ventas bajas, necesitas promociones urgentes");
  } else {
    recomendaciones.push("📊 Negocio estable, sigue optimizando productos top");
  }

  res.json({
    totalGeneral,

    masVendidos,
    menosVendidos,

    masGanancia,
    menosGanancia,

    ia: {
      recomendaciones
    }
  });

});
// ================== SERVER ==================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 http://localhost:" + PORT);
});

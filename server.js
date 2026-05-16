require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ================== DEBUG ==================
console.log("USER:", process.env.MONGO_USER);
console.log("DB:",   process.env.MONGO_DB);

// ================== MONGO ==================
const user = process.env.MONGO_USER;
const pass = encodeURIComponent(process.env.MONGO_PASS);
const db   = process.env.MONGO_DB;

const URI = `mongodb+srv://${user}:${pass}@cluster0.8otlbi7.mongodb.net/${db}?retryWrites=true&w=majority`;

mongoose.set('strictQuery', false);
mongoose.connect(URI, {
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 20,
  socketTimeoutMS: 45000,
})
.then(() => console.log("✅ Mongo conectado"))
.catch(err => console.log("❌ Error Mongo:", err));

// ================== MODELOS ==================

const Producto = mongoose.model('Producto', {
  nombre:      String,
  codigo:      String,
  precioVenta: Number,
  precioCompra:Number,
  stock:       Number
});

const Venta = mongoose.model('Venta', {
  cliente:  String,
  cedula:   String,
  celular:  String,
  correo:   String,
  productos: Array,
  subtotal:  Number,
  descuentoPct:   Number,
  descuentoMonto: Number,
  total:    Number,
  tipo:     String,
  meses:    Number,
  tasaInteres:  Number,
  montoInteres: Number,
  pago:     Number,
  vuelto:   Number,
  banco:    String,
  cuenta:   String,
  comprobante: String,
  fecha: { type: Date, default: Date.now }
});

const Deuda = mongoose.model('Deuda', {
  cliente:   String,
  cedula:    String,
  celular:   String,
  direccion: String,
  correo:    String,
  total:     Number,
  pagado:    { type: Number, default: 0 },
  productos: { type: Array,  default: [] },
  pagos: [{
    monto: Number,
    tipoPago: { type: String, default: "efectivo" },
    banco: String,
    comprobante: String,
    remitente: String,
    fecha: { type: Date, default: Date.now }
  }],
  fecha: { type: Date, default: Date.now }
});

const Cliente = mongoose.model('Cliente', {
  nombre:    String,
  cedula:    String,
  direccion: String,
  telefono:  String,
  correo:    String,
  deudaTotal:  { type: Number, default: 0 },
  deudaActual: { type: Number, default: 0 },
  estado:      { type: String, default: "normal" },
  fecha: { type: Date, default: Date.now }
});

const CajaSchema = new mongoose.Schema({
  apertura:     { type: Number, default: 0 },
  ingresos:     { type: Number, default: 0 },
  gastos:       { type: Number, default: 0 },
  activa:       { type: Boolean, default: false },
  cierre:       { type: Number, default: 0 },
  dejado:       { type: Number, default: 0 },
  horaApertura: { type: Date, default: Date.now },
  horaCierre:   { type: Date },
  movimientos: [{
    tipo:        String,
    monto:       Number,
    motivo:      String,
    banco:       String,
    cuenta:      String,
    comprobante: String,
    remitente:   String,
    fecha:       { type: Date, default: Date.now }
  }]
});
const Caja = mongoose.model('Caja', CajaSchema);

// ================== HEALTH ==================
app.get('/health', (req, res) => {
  res.json({ ok: true, message: "Servidor activo", time: new Date() });
});

// ================== PRODUCTOS ==================
app.get('/productos', async (req, res) => {
  try { res.json(await Producto.find()); }
  catch (err) { console.error(err); res.json([]); }
});

app.post('/productos', async (req, res) => {
  try {
    await new Producto(req.body).save();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al crear producto" }); }
});

app.put('/productos/:id', async (req, res) => {
  try {
    await Producto.findByIdAndUpdate(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al editar producto" }); }
});

app.put('/productos/agregar/:id', async (req, res) => {
  try {
    const p = await Producto.findById(req.params.id);
    if (!p) return res.json({ error: "No existe" });
    p.stock += Number(req.body.cantidad);
    await p.save();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al agregar stock" }); }
});

app.put('/productos/vender/:id', async (req, res) => {
  try {
    const p = await Producto.findById(req.params.id);
    if (!p) return res.json({ error: "No existe" });
    p.stock -= Number(req.body.cantidad);
    if (p.stock < 0) p.stock = 0;
    await p.save();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al vender" }); }
});

app.delete('/productos/:id', async (req, res) => {
  try {
    await Producto.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al eliminar" }); }
});

// ================== CLIENTES ==================
app.post('/clientes', async (req, res) => {
  try {
    const cliente = new Cliente(req.body);
    await cliente.save();
    res.json({ ok: true, cliente });
  } catch (err) { res.status(500).json({ error: "Error al guardar cliente" }); }
});

app.get('/clientes', async (req, res) => {
  try { res.json(await Cliente.find().sort({ fecha: -1 })); }
  catch (err) { res.status(500).json([]); }
});

app.post('/clientes/sumar-deuda', async (req, res) => {
  try {
    const { cedula, total } = req.body;
    const cliente = await Cliente.findOne({ cedula });
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
    cliente.deudaTotal  += Number(total);
    cliente.deudaActual += Number(total);
    cliente.estado = "deudor";
    await cliente.save();
    res.json({ ok: true, cliente });
  } catch (err) { res.status(500).json({ error: "Error al actualizar deuda" }); }
});

app.post('/clientes/abonar', async (req, res) => {
  try {
    const { cedula, monto } = req.body;
    const cliente = await Cliente.findOne({ cedula });
    if (!cliente) return res.status(404).json({ error: "Cliente no encontrado" });
    cliente.deudaActual -= Number(monto);
    if (cliente.deudaActual <= 0) { cliente.deudaActual = 0; cliente.estado = "normal"; }
    await cliente.save();
    res.json({ ok: true, cliente });
  } catch (err) { res.status(500).json({ error: "Error al abonar" }); }
});

app.put('/clientes/editar', async (req, res) => {
  try {
    const { id, nombre, cedula, telefono } = req.body;
    const cliente = await Cliente.findById(id);
    if (!cliente) return res.json({ error: "No encontrado" });
    cliente.nombre   = nombre;
    cliente.cedula   = cedula;
    cliente.telefono = telefono;
    await cliente.save();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al editar cliente" }); }
});

app.get('/clientes/:cedula', async (req, res) => {
  try {
    const cliente = await Cliente.findOne({ cedula: req.params.cedula });
    res.json(cliente || null);
  } catch (err) { res.status(500).json(null); }
});

app.delete('/clientes/:id', async (req, res) => {
  try {
    await Cliente.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al eliminar cliente" }); }
});

// ================== VENTAS ==================
app.post('/ventas', async (req, res) => {
  try {
    await new Venta(req.body).save();

    const caja = await Caja.findOne({ activa: true });

    if (req.body.tipo === "efectivo" && caja) {
      caja.ingresos += Number(req.body.total || 0);
      caja.movimientos.push({
        tipo: "ingreso", monto: req.body.total, motivo: "Venta efectivo"
      });
      await caja.save();
    }

    if (req.body.tipo === "credito") {
      await new Deuda({
        cliente:  req.body.cliente,
        cedula:   req.body.cedula   || "SIN CÉDULA",
        celular:  req.body.celular  || "",
        correo:   req.body.correo   || "",
        direccion:req.body.direccion|| "",
        total:    req.body.total,
        pagado:   0,
        productos:req.body.productos || [],
        pagos:    []
      }).save();
    }

    if (req.body.tipo === "transferencia" && caja) {
      caja.ingresos += Number(req.body.total || 0);
      caja.movimientos.push({
        tipo:        "transferencia",
        monto:       Number(req.body.total || 0),
        motivo:      `Transferencia venta — ${req.body.banco || ""}`,
        banco:       req.body.banco       || "",
        cuenta:      req.body.cuenta      || "",
        comprobante: req.body.comprobante || "",
        remitente:   req.body.cliente     || ""
      });
      await caja.save();
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Error /ventas:", err);
    res.status(500).json({ error: "Error al guardar venta" });
  }
});

app.delete('/ventas/dia', async (req, res) => {
  try {
    const { fecha } = req.body;
    if (!fecha) return res.status(400).json({ error: "Falta fecha" });
    const inicio = new Date(fecha + "T00:00:00.000Z");
    const fin    = new Date(fecha + "T23:59:59.999Z");
    const resultado = await Venta.deleteMany({ fecha: { $gte: inicio, $lte: fin } });
    res.json({ ok: true, msg: `${resultado.deletedCount} venta(s) eliminadas`, deleted: resultado.deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al borrar día" });
  }
});

// ================== BORRAR PRODUCTO DE UNA VENTA ==================
app.delete('/ventas/:id/producto', async (req, res) => {
  try {
    const venta = await Venta.findById(req.params.id);
    if (!venta) return res.status(404).json({ error: "Venta no encontrada" });

    const indice = Number(req.body.indice);

    if (isNaN(indice) || indice < 0 || indice >= venta.productos.length) {
      return res.status(400).json({ error: "Índice de producto inválido" });
    }

    const nombreProducto = venta.productos[indice]?.nombre || "producto";

    // Quitar el producto del array
    venta.productos.splice(indice, 1);

    // Recalcular el total
    venta.total = venta.productos.reduce((sum, p) => {
      return sum + (Number(p.precio || 0) * Number(p.cantidad || 1));
    }, 0);

    await venta.save();

    res.json({ ok: true, msg: `"${nombreProducto}" eliminado correctamente` });

  } catch (err) {
    console.error("Error al borrar producto:", err);
    res.status(500).json({ error: "Error al borrar producto" });
  }
});

// ================== DEUDAS ==================
app.get('/deudas', async (req, res) => {
  res.json(await Deuda.find().sort({ fecha: -1 }));
});

app.post('/deudas', async (req, res) => {
  try {
    const nueva = new Deuda({
      cliente:  req.body.cliente   || "",
      cedula:   req.body.cedula    || "-",
      celular:  req.body.celular   || "",
      direccion:req.body.direccion || "",
      correo:   req.body.correo    || "",
      total:    Number(req.body.total || 0),
      pagado:   0,
      productos:req.body.productos || [],
      pagos:    [],
      fecha:    new Date()
    });
    await nueva.save();
    res.json(nueva);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear deuda" });
  }
});

app.post('/deudas/pagar', async (req, res) => {
  try {
    const deuda = await Deuda.findById(req.body.id);
    if (!deuda) return res.json({ error: "Deuda no encontrada" });

    const monto = Number(req.body.monto);
    if (!monto || monto <= 0) return res.json({ error: "Monto inválido" });

    const restante = deuda.total - deuda.pagado;
    if (monto > restante) return res.json({ error: "No puedes pagar más de la deuda" });

    deuda.pagado += monto;
    deuda.pagos.push({ monto, fecha: new Date() });
    await deuda.save();

    const caja = await Caja.findOne({ activa: true });
    if (caja) {
      const metodoPago  = req.body.metodoPago  || "efectivo";
      const banco       = req.body.banco       || "";
      const comprobante = req.body.comprobante || "";

      if (metodoPago === "transferencia") {
        caja.ingresos += monto;
        caja.movimientos.push({
          tipo:        "transferencia",
          monto,
          motivo:      `Abono deuda — ${deuda.cliente}`,
          banco,
          comprobante,
          remitente:   deuda.cliente || ""
        });
      } else {
        caja.ingresos += monto;
        caja.movimientos.push({
          tipo:   "ingreso",
          monto,
          motivo: `Abono deuda efectivo — ${deuda.cliente}`
        });
      }

      await caja.save();
    }

    res.json({
      cliente:  deuda.cliente,
      cedula:   deuda.cedula  || "-",
      celular:  deuda.celular || "",
      monto,
      total:    deuda.total,
      restante: deuda.total - deuda.pagado,
      pagado:   deuda.pagado,
      pagos:    deuda.pagos    || [],
      productos:deuda.productos || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al abonar" });
  }
});

app.put('/deudas/:id', async (req, res) => {
  try {
    const deuda = await Deuda.findById(req.params.id);
    if (!deuda) return res.status(404).json({ error: "Deuda no encontrada" });

    if (req.body.cliente   !== undefined) deuda.cliente   = req.body.cliente;
    if (req.body.cedula    !== undefined) deuda.cedula    = req.body.cedula;
    if (req.body.celular   !== undefined) deuda.celular   = req.body.celular;
    if (req.body.direccion !== undefined) deuda.direccion = req.body.direccion;
    if (req.body.total     !== undefined) deuda.total     = Number(req.body.total);
    if (req.body.productos !== undefined) deuda.productos = req.body.productos;
    if (req.body.pagado    !== undefined) deuda.pagado    = Number(req.body.pagado);
    if (req.body.pagos     !== undefined) deuda.pagos     = req.body.pagos;

    console.log("🔄 Actualizando deuda:", deuda._id);
    console.log("   Productos:", deuda.productos);
    console.log("   Total:", deuda.total);
    console.log("   Pagado:", deuda.pagado);

    await deuda.save();
    res.json({ ok: true, deuda });
  } catch (err) {
    console.error("❌ Error PUT /deudas/:id", err);
    res.status(500).json({ error: "Error al editar deuda" });
  }
});

app.delete('/deudas/:id', async (req, res) => {
  try {
    await Deuda.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al eliminar deuda" }); }
});

// ================== CAJA ==================
app.post('/caja/abrir', async (req, res) => {
  try {
    const monto = Number(req.body.monto);
    if (!monto || monto <= 0) return res.json({ error: "Monto inválido" });

    const abierta = await Caja.findOne({ activa: true });
    if (abierta) {
      abierta.activa     = false;
      abierta.horaCierre = new Date();
      await abierta.save();
    }

    await new Caja({
      apertura:     monto,
      ingresos:     0,
      gastos:       0,
      activa:       true,
      horaApertura: new Date(),
      movimientos: [{ tipo: "inicio", monto, motivo: "Apertura de caja" }]
    }).save();

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al abrir caja" });
  }
});

app.get('/caja', async (req, res) => {
  try {
    const caja = await Caja.findOne({ activa: true });
    if (!caja) return res.json({ apertura: 0, ingresos: 0, gastos: 0, transferencias: 0, saldo: 0 });

    let transferencias = 0;
    let gastosLista = [];
    let transferenciasList = [];

    (caja.movimientos || []).forEach(m => {
      if (m.tipo === "transferencia") {
        transferencias += m.monto;
        transferenciasList.push(m);
      }
      if (m.tipo === "gasto") {
        gastosLista.push(m);
      }
    });

    res.json({
      apertura:          caja.apertura,
      ingresos:          caja.ingresos,
      transferencias,
      gastos:            caja.gastos,
      saldo:             caja.apertura + caja.ingresos - caja.gastos,
      horaApertura:      caja.horaApertura,
      gastosLista,
      transferenciasList,
      movimientos:       caja.movimientos || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener caja" });
  }
});

app.post('/caja/gasto', async (req, res) => {
  try {
    const caja = await Caja.findOne({ activa: true });
    if (!caja) return res.json({ error: "Caja no abierta" });

    const monto  = Number(req.body.monto  || 0);
    const motivo = req.body.motivo || "Sin motivo";
    if (!monto || monto <= 0) return res.json({ error: "Monto inválido" });

    caja.gastos += monto;
    caja.movimientos.push({ tipo: "gasto", monto, motivo });
    await caja.save();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al registrar gasto" }); }
});

app.post('/caja/transferencia', async (req, res) => {
  try {
    const caja = await Caja.findOne({ activa: true });
    if (!caja) return res.json({ error: "Caja no abierta" });

    const monto = Number(req.body.monto || 0);
    if (!monto || monto <= 0) return res.json({ error: "Monto inválido" });

    caja.ingresos += monto;
    caja.movimientos.push({
      tipo:        "transferencia",
      monto,
      motivo:      `Transferencia ${req.body.banco || ""}`,
      banco:       req.body.banco       || "",
      cuenta:      req.body.cuenta      || "",
      comprobante: req.body.comprobante || "",
      remitente:   req.body.remitente   || ""
    });
    await caja.save();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: "Error al registrar transferencia" }); }
});

// ================== CIERRE CAJA ==================
app.post('/caja/cerrar', async (req, res) => {
  try {
    const caja = await Caja.findOne({ activa: true });
    if (!caja) return res.json({ error: "Caja no abierta" });

    const real  = Number(req.body.montoReal);
    const dejar = Number(req.body.dejar || 0);

    const esperado   = caja.apertura + caja.ingresos - caja.gastos;
    const diferencia = real - esperado;

    let transferencias = 0;
    const gastosLista        = [];
    const transferenciasList = [];

    (caja.movimientos || []).forEach(m => {
      if (m.tipo === "gasto")         gastosLista.push(m);
      if (m.tipo === "transferencia") { transferenciasList.push(m); transferencias += m.monto; }
    });

    caja.activa     = false;
    caja.cierre     = real;
    caja.horaCierre = new Date();
    caja.dejado     = dejar;
    caja.movimientos.push({
      tipo: "cierre", monto: real,
      motivo: `Cierre de caja | Dejado: $${dejar}`
    });
    await caja.save();

    if (dejar > 0) {
      await new Caja({
        apertura:     dejar,
        ingresos:     0,
        gastos:       0,
        activa:       true,
        horaApertura: new Date(),
        movimientos: [{ tipo: "inicio", monto: dejar, motivo: "Apertura automática" }]
      }).save();
    }

    res.json({
      apertura:         caja.apertura,
      ingresos:         caja.ingresos,
      transferencias,
      gastos:           caja.gastos,
      esperado,
      real,
      diferencia,
      dejar,
      fechaApertura:    caja.horaApertura,
      fechaCierre:      caja.horaCierre,
      gastosLista,
      transferenciasList
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cerrar caja" });
  }
});

app.get('/caja/historial', async (req, res) => {
  try {
    const cajas = await Caja.find({ activa: false }).sort({ horaCierre: -1 }).limit(50);

    const historial = cajas.map(c => {
      let transferencias = 0;
      const gastosLista        = [];
      const transferenciasList = [];

      (c.movimientos || []).forEach(m => {
        if (m.tipo === "gasto")         gastosLista.push(m);
        if (m.tipo === "transferencia") { transferenciasList.push(m); transferencias += m.monto; }
      });

      return {
        fechaApertura:    c.horaApertura,
        fechaCierre:      c.horaCierre,
        apertura:         c.apertura,
        ingresos:         c.ingresos,
        transferencias,
        gastos:           c.gastos,
        real:             c.cierre,
        diferencia:       c.cierre - (c.apertura + c.ingresos - c.gastos),
        dejar:            c.dejado || 0,
        gastosLista,
        transferenciasList
      };
    });

    res.json(historial);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// ================== ANÁLISIS / DASHBOARD ==================
app.get('/analisis', async (req, res) => {
  try {
    const ventas = await Venta.find();

    let totalGeneral = 0;
    let efectivo     = 0;
    let credito      = 0;
    let transferencia = 0;

    const productos = {};
    const porDia    = {};
    const porMes    = {};

    ventas.forEach(v => {
      const total = Number(v.total || 0);
      totalGeneral += total;

      if (v.tipo === "efectivo")      efectivo++;
      if (v.tipo === "credito")       credito++;
      if (v.tipo === "transferencia") transferencia++;

      const fecha = new Date(v.fecha);
      const dia   = fecha.toISOString().split("T")[0];
      const mes   = fecha.toISOString().slice(0, 7);

      porDia[dia] = (porDia[dia] || 0) + total;
      porMes[mes] = (porMes[mes] || 0) + total;

      if (Array.isArray(v.productos)) {
        v.productos.forEach(p => {
          const nombre   = p.nombre  || "Sin nombre";
          const cantidad = Number(p.cantidad || 1);
          const precio   = Number(p.precio   || 0);
          const costo    = Number(p.costo    || 0);
          const ganancia = (precio - costo) * cantidad;

          if (!productos[nombre]) {
            productos[nombre] = { nombre, vendidos: 0, ganancia: 0 };
          }
          productos[nombre].vendidos  += cantidad;
          productos[nombre].ganancia  += ganancia;
        });
      }
    });

    const lista = Object.values(productos);

    const masVendidos   = [...lista].sort((a,b) => b.vendidos  - a.vendidos ).slice(0, 5);
    const menosVendidos = [...lista].sort((a,b) => a.vendidos  - b.vendidos ).slice(0, 5);
    const masGanancia   = [...lista].sort((a,b) => b.ganancia  - a.ganancia ).slice(0, 5);
    const menosGanancia = [...lista].sort((a,b) => a.ganancia  - b.ganancia ).slice(0, 5);

    const clientesUnicos = new Set(ventas.map(v => v.cedula || v.cliente)).size;

    res.json({
      ventas,
      totalGeneral,
      efectivo,
      credito,
      transferencia,
      clientes: clientesUnicos,
      porDia,
      porMes,
      masVendidos,
      menosVendidos,
      masGanancia,
      menosGanancia
    });
  } catch (err) {
    console.error("Error /analisis:", err);
    res.status(500).json({ error: "Error al obtener análisis" });
  }
});

// ================== SERVER ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 http://localhost:" + PORT);
});

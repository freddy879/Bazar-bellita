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

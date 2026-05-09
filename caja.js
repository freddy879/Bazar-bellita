const mongoose = require('mongoose');

const CajaSchema = new mongoose.Schema({
  apertura: Number,
  ingresos: Number,
  gastos: Number,
  activa: Boolean,
  dejado: Number,

  movimientos: [
    {
      tipo: String,
      monto: Number,
      motivo: String
    }
  ],

  horaCierre: Date
});

const Caja = mongoose.model('Caja', CajaSchema);

module.exports = { Caja };

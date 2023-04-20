const mongoose = require("mongoose");

const inscriptionSchema = new mongoose.Schema(
  {
    id: { type: String },
    inscribed: { type: Boolean },
    sent: { type: Boolean },
    feeRate: { type: Number },
    utxoTxid: { type: String },
    encryptedPassKey: {
      type: String,
      immutable: true,
    },
    inscriptionDetails: {
      type: Object,
    },
    fileNames: {
      type: Array,
    },
    walletDetails: {
      type: Object,
    },
    cost: {
      type: Object,
    },
    inscription: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Incription", inscriptionSchema);

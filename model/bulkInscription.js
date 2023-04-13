const mongoose = require("mongoose");

const bulkInscription = new mongoose.Schema(
  {
    id: { type: String },
    inscribed: { type: Boolean },
    sent: { type: Boolean },
    feeRate: { type: Number },
    utxoTxid: { type: String },
    encryptedPassKey: {
      type: String,
      required: true,
      immutable: true,
    },
    inscriptionDetails: {
      type: Object,
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

module.exports = mongoose.model("BulkInscription", bulkInscription);

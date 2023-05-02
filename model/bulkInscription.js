const mongoose = require("mongoose");

const bulkInscription = new mongoose.Schema(
  {
    id: { type: String },
    inscribed: { type: Boolean },
    sent: { type: Boolean },
    feeRate: { type: Number },
    utxoTxid: { type: String },
    reciever: { type: String },
    encryptedPassKey: {
      type: String,
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
    receiever: {
      type: String,
    },
    stage: {
      type: String,
    },
    inscription: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BulkInscription", bulkInscription);

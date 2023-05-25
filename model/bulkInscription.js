const mongoose = require("mongoose");

const bulkInscription = new mongoose.Schema(
  {
    id: { type: String },
    inscribed: { type: Boolean },
    sent: { type: Boolean },
    feeRate: { type: Number },
    utxoTxid: { type: String },
    collectionId: {type: String},
    collectionPayment: {type: Boolean, default: false},
    inscriptionDetails: {
      type: Object,
    },
    walletDetails: {
      type: Object,
    },
    cost: {
      type: Object,
    },
    fileNames: {
      type: Array,
    },
    receiver: {
      type: String,
    },
    stage: {
      type: String,
    },
    inscription: { type: Array },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BulkInscription", bulkInscription);

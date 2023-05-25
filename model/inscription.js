const mongoose = require("mongoose");

const inscriptionSchema = new mongoose.Schema(
  {
    id: { type: String },
    inscribed: { type: Boolean },
    sent: { type: Boolean },
    feeRate: { type: Number },
    utxoTxid: { type: String },
    inscriptionType: { type: String },
    collectionId: {type: String},
    collectionPayment: {type: Boolean, default: false},
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

module.exports = mongoose.model("Incription", inscriptionSchema);

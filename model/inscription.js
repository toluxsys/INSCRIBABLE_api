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
    selected: {type: mongoose.Schema.Types.ObjectId, ref: "SelectedItem"},
    collectionPayment: {type: String, default: "waiting"},
    offSet: {type: Number},
    utxo: { type: String },
    sat: {type: mongoose.Schema.Types.ObjectId, ref: "Sats"},
    spendTxid: { type: String },
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

module.exports = mongoose.model("Inscription", inscriptionSchema);

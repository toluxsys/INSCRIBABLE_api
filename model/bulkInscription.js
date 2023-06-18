const mongoose = require("mongoose");

const bulkInscription = new mongoose.Schema(
  {
    id: { type: String },
    flag: { type: String },
    inscribed: { type: Boolean },
    sent: { type: Boolean },
    feeRate: { type: Number },
    utxoTxid: { type: String },
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

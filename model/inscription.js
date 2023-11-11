const mongoose = require("mongoose");

const inscriptionSchema = new mongoose.Schema(
  {
    id: { type: String },
    flag: { type: String },
    inscribed: { type: Boolean },
    sent: { type: Boolean },
    feeRate: { type: Number },
    utxoTxid: { type: String },
    inscriptionType: { type: String },
    collectionId: {type: String},
    selected: {type: mongoose.Schema.Types.ObjectId, ref: "SelectedItem"},
    collectionPayment: {type: String, default: "waiting"},
    sat: {type: String},
    spendTxid: { type: String },
    inscriptionDetails: {
      type: Object,
    },
    s3: {
      type: Boolean,
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
    addedToQueue: {
      type: Boolean
    },
    mintCount: {
      type: Number
    },
    stage: {
      type: String,
    },
    inscription: { type: Array },
    usePoints: {type: Boolean, default: false},
    error: {
      type: Boolean,
      default: false
    },
    errorMessage:{
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Inscription", inscriptionSchema);

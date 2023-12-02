const mongoose = require('mongoose');

const bulkInscription = new mongoose.Schema(
  {
    id: { type: String },
    flag: { type: String },
    inscribed: { type: Boolean },
    sent: { type: Boolean },
    feeRate: { type: Number },
    utxoTxid: { type: String },
<<<<<<< HEAD
    collectionId: {type: String},
    selected: {type: mongoose.Schema.Types.ObjectId, ref: "SelectedItem"},
    collectionPayment: {type: String, default: "waiting"},
    mintStage: {type: mongoose.Schema.Types.ObjectId, ref: "MintDetails"},
    sat: {type: mongoose.Schema.Types.ObjectId, ref: "Sats"},
=======
    collectionId: { type: String },
    selected: { type: mongoose.Schema.Types.ObjectId, ref: 'SelectedItem' },
    collectionPayment: { type: String, default: 'waiting' },
    mintStage: { type: mongoose.Schema.Types.ObjectId, ref: 'MintDetails' },
    sat: { type: mongoose.Schema.Types.ObjectId, ref: 'Sats' },
>>>>>>> 6e9e071db1eb6d6a931ad6e6cd1774d1a2d7f429
    spendTxid: { type: String },
    inscriptionDetails: {
      type: Object,
    },
    s3: {
      type: Boolean,
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
    addedToQueue: {
      type: Boolean,
    },
    mintCount: {
      type: Number,
    },
    inscription: { type: Array },
    error: {
      type: Boolean,
      default: false,
    },
    usePoints: { type: Boolean, default: false },
    errorMessage: {
      type: String,
      default: '',
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('BulkInscription', bulkInscription);

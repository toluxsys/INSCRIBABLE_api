const mongoose = require("mongoose");

const bulkInscription = new mongoose.Schema(
  {
    id: String,
    inscribed: Boolean,
    sent: Boolean,
    feeRate: Number,
    encryptedPassKey: {
      type: String,
      required: true,
      immutable: true,
    },
    inscriptionDetails: {
      largestFile: Number,
      totalAmount: Number,
      receciverDetails: Array,
      payAddress: String,
      payAddressId: Number,
      cid: String,
    },
    walletDetails: {
      keyPhrase: String,
      walletName: String,
      creationBlock: Number,
    },
    cost: {
      type: Object,
    },
    inscription: { type: Array },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BulkInscription", bulkInscription);

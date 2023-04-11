const mongoose = require("mongoose");

const inscriptionSchema = new mongoose.Schema(
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
      imageSizeIn: Number,
      imageSizeOut: Number,
      fileName: String,
      comPercentage: Number,
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
      serviceCharge: Number,
      inscriptionCost: Number,
      total: Number,
    },
    inscription: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Incription", inscriptionSchema);

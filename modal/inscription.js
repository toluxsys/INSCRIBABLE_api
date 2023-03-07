const mongoose = require("mongoose");

const inscriptionSchema = new mongoose.Schema({
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
    recieverAddress: String,
    payAddress: String,
    payAddressId: Number,
  },
  cost: {
    serviceCharge: Number,
    inscriptionCost: Number,
    total: Number,
  },
  inscription: Object,
  createdAt: { type: Date, default: () => Date.now(), immutable: true },
  updatedAt: { type: Date, default: () => Date.now() },
});

module.exports = mongoose.model("Incription", inscriptionSchema);

const mongoose = require('mongoose');

const paymentLink = new mongoose.Schema(
  {
    id: { type: String },
    sent: { type: Boolean },
    amount: { type: Number },
    inscriptions: { type: Array },
    receiver: { type: String },
    payAddress: { type: String },
    payAddressId: { type: Number },
    inscriptionId: { type: String },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PayLink', paymentLink);

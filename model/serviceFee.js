const mongoose = require("mongoose");

const serviceFee = new mongoose.Schema(
  {
    collectionId: {
      type: String,
    },
    serviceFee: {
      type: Number,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("collectionFee", serviceFee);
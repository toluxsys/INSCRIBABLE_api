const mongoose = require("mongoose");

const btcPrice = new mongoose.Schema(
  {
    value: {
      type: Number
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("BtcPrice", btcPrice);
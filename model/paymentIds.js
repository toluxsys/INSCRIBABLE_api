const mongoose = require("mongoose");

const paymentIds = new mongoose.Schema(
  {
    id: {
      type: String,
    },
    status: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PayIds", paymentIds);

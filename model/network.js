const mongoose = require("mongoose");

const network = new mongoose.Schema(
  {
    networkName: {
      type: String,
    },
    status: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Network", network);

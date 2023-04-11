const mongoose = require("mongoose");

const inscriptionIds = new mongoose.Schema(
  {
    id: {
      type: String,
    },
    type: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ids", inscriptionIds);

const mongoose = require("mongoose");

const collection = new mongoose.Schema(
  {
    id: {
      type: String,
    },
    status: {
      type: String,
    },
    collectionDetails: {
      type: Object,
    },
    cids: {
      type: Object,
    },
    walletDetails: {
      type: Object,
    },
    cost: {
      type: Object,
    },
    inscription: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Collection", collection);

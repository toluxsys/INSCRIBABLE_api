const mongoose = require("mongoose");

const collection = new mongoose.Schema(
  {
    id: {
      type: String,
    },
    mintComplete: {
      type: Boolean,
      default: false,
    },
    collectionDetails: {
      collectionName: String,
      collectionAmount: Number,
      collectionDescription: Number,
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

module.exports = mongoose.model("Collection", collection);

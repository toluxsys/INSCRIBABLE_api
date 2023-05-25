const mongoose = require("mongoose");

const collection = new mongoose.Schema(
  {
    id: {
      type: String,
    },
    status: {
      type: String,
    },
    name: {
      type: String,
    },
    price: {
      type: Number,
    },
    banner: {
      type: String,
    },
    featuredImage: {
      type: String,
    },
    collectionDetails: {
      type: Object,
    },
    collectionAddress: {
      type: String,
    },
    description: {
      type: String,
    },
    category: {
      type: String,
    },
    itemCid: {
      type: String
    },
    featuredCid: {
      type: String
    },
    largestFile: {
      type: Number,
    },
    walletDetails: {
      type: Object,
    },
    cost: {
      type: Object,
    },
    inscriptions: { type: Array },
    minted: { type: Array },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Collection", collection);

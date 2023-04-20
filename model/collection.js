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
    description: {
      type: String,
    },
    category: {
      type: String,
    },
    cids: {
      type: Array,
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
    inscription: { type: Object },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Collection", collection);

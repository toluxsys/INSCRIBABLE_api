const mongoose = require("mongoose");

const mintDetails = new mongoose.Schema(
  {
    collectionId: {
      type: String,
    },
    name: {
        type: String
    },
    mintLimit: {
        type: Number
    },
    price: {
        type: Number
    },
    duration:{
        type: Number
    },
    addresses: {
      type: Array,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MintDetails", mintDetails);
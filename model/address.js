const mongoose = require("mongoose");

const address = new mongoose.Schema(
  {
    collectionId: {
        type: String
    },
    address: {
      type: String,
    },
    mintStage: { type: mongoose.Schema.Types.ObjectId, ref: "MintDetails"},
    mintCount: {type: Number},
    pendingOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Inscription"}]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Address", address);
const mongoose = require("mongoose");

const claim = new mongoose.Schema(
  {
    claimId: {
        type: String
    },
    claimCode: {
        type: Array
    },
    usedClaimCode: {
        type: Array
    },
    description: {
        type: String
    },
    info: {
        type: Array
    },
    claimPoint: {
        type: Number
    },
    status: {
        type: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Claim", claim);
const mongoose = require("mongoose");

const userReward = new mongoose.Schema(
  {
    address: {
        type: String
    },
    totalPoints: {
        type: Number,
        default: 0
    },
    claimCode: {
      type: Array
    },
    checkInCount: {
      type: Number,
      default: 0
    },
    lastCheckIn: {
      type: Date
    },
    taskHistory: {
      type: Array
    },
    claimHistory: {
      type:Array
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserReward", userReward);

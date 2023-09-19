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
    taskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task"}]
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserReward", userReward);

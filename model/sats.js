const mongoose = require("mongoose");

const sats = new mongoose.Schema(
  {
    start: {
            type: Number,
    },
    end: {
        type: Number,
    },
    output: { 
        type: String,
    },
    size: {
        type: Number
    },
    startOffset: {
        type: Number
    },
    endOffset: {
        type: Number
    },
    year: {
        type: String,
    },
    rarity: {
        type: String,
    },
    specialAttribute: {
        type: String,
    },
    count: {
        type: Number,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sats", sats);
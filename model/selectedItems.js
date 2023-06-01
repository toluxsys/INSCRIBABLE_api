const mongoose = require("mongoose");

const selectedItems = new mongoose.Schema(
  {
    collectionId: {
      type: String,
    },
    items: {
      type: Array,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SelectedItems", selectedItems);
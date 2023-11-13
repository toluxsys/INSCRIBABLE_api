const mongoose = require('mongoose');

const selectedItems = new mongoose.Schema(
  {
    collectionId: {
      type: String,
    },
    items: {
      type: Array,
    },
    address: {
      type: String,
    },
    orderId: {
      type: String,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('SelectedItems', selectedItems);

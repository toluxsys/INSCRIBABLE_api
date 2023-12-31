const mongoose = require('mongoose');

const collection = new mongoose.Schema(
  {
    id: {
      type: String,
    },
    alias: {
      type: String,
    },
    flag: {
      type: String,
    },
    status: {
      type: String,
    },
    name: {
      type: String,
    },
    fileType: {
      type: String,
    },
    price: {
      type: Number,
    },
    userSelect: {
      type: String,
    },
    specialSat: {
      type: String,
    },
    startMint: {
      type: Boolean,
      default: false,
    },
    paused: {
      type: Boolean,
      default: false,
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
      type: String,
    },
    featuredCid: {
      type: String,
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
    startAt: {
      type: Date,
    },
    mintCount: {
      type: Number,
      default: 0,
    },
    ended: {
      type: Boolean,
      default: false,
    },
    template: {
      type: Number,
    },
    keys: {
      type: Object,
    },
    mintStage: { type: mongoose.Schema.Types.ObjectId, ref: 'MintDetails' },
    inscriptions: { type: Array },
    selected: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SelectedItem' }],
    mintDetails: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MintDetails' }],
    minted: { type: Array },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Collection', collection);

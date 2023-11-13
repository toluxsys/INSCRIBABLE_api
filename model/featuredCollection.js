const mongoose = require('mongoose');

const featuredCollections = new mongoose.Schema(
  {
    ids: {
      type: Array,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('FeaturedCollections', featuredCollections);

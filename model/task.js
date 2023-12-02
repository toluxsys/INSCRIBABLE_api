const mongoose = require('mongoose');

const task = new mongoose.Schema(
  {
    taskId: {
      type: String,
    },
    taskName: {
      type: String,
    },
    taskPoints: {
      type: Number,
    },
    description: {
      type: String,
    },
    info: {
      type: [],
    },
    status: {
      type: String,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Task', task);

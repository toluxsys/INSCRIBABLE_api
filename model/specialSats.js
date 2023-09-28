const mongoose = require("mongoose");

const specialSat = new mongoose.Schema(
  {
   satType:{
    type: String
   },
   price: {
    type: Number
   }
  },
  { timestamps: true }
);

module.exports = mongoose.model("SpecialSat", specialSat);
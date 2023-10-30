const express = require("express");
const controller = require("../controllers/uniInscriptionController");
const router = express.Router();
const fs = require("fs");
const basicAuth = require('express-basic-auth')
const dotenv = require("dotenv").config();

router.use(express.urlencoded({ extended: false }));
router.use(express.json());

router.use(basicAuth({
  authorizer: (username, password, cb) => {
    const userMatches = basicAuth.safeCompare(username, process.env.API_USERNAME)
    const passwordMatches = basicAuth.safeCompare(password, process.env.API_PASSWORD)
    if (userMatches & passwordMatches)
      return cb(null, true)
    else
      return cb(null, false)
  },
  authorizeAsync: true,
}))

router.post("/inscribe", controller.inscribeItem);
router.post("/checkPayment", controller.verifyPayment);
router.post("/address_orders", controller.getAllAddressOrder)
router.post("/getOrder", controller.getOrder);
router.post ("/getUserOrder", controller.getReceiverOrder)

module.exports = router;
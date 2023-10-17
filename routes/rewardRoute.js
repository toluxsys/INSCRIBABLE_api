const express = require("express");
const controller = require("../controllers/reward");
const path = require("path");
const basicAuth = require('express-basic-auth')
const router = express.Router();
router.use(express.urlencoded({ extended: true }));
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

router.post("/addTask", controller.addTask);
router.post("/addReward", controller.addClaim);
router.post("/performTask", controller.performTask);
router.post("/claimCheckinPoints", controller.claimCheckinPoints);
router.post("/redeemPoints", controller.redeemPoints);
router.post("/redeemClaimCode", controller.redeemClaimCode);
router.post("/removeTask", controller.removeTask);
router.post("/removeReward", controller.removeClaim);
router.post("/userReward", controller.getUserReward);
router.get("/getAllReward", controller.getClaims);
router.get("/getTask", controller.getTasks);

module.exports = router;

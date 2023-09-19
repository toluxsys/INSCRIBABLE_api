const express = require("express");
const controller = require("../controllers/reward");
const path = require("path");
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
router.post("/addClaim", controller.addClaim);
router.post("/performTask", controller.performTask);
router.post("/redeemPoints", controller.redeem);
router.post("/claim", controller.claim);
router.post("/removeTask", controller.removeTask);
router.post("/removeClaim", controller.removeClaim);
router.post("/userReward", controller.getUserReward);
router.get("/getClaims", controller.getClaims);
router.get("/getTask", controller.getTasks);

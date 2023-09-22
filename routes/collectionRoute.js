const express = require("express");
const controller = require("../controllers/collection");
const path = require("path");
const router = express.Router();
const fileUpload = require("express-fileupload");
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

router.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: path.join(process.cwd(), `tmp`),
    createParentPath: true,
  })
);

router.post("/add", controller.addCollection);
router.post("/addMintAddress", controller.addMintAddress);
router.post("/upload", controller.addCollectionItems);
router.post("/seleteItem", controller.selectItem);
router.post("/undoSelection/:inscriptionId", controller.undoSelection);
router.post("/getImages", controller.getImages);
router.post("/sendUtxo", controller.sendUtxo1);
router.post("/inscribe", controller.inscribe);
router.post("/getInscriptions", controller.getCollectionInscription);
router.post("/inscribedImages", controller.getInscribedImages);
router.post("/getCollection", controller.getCollection);
router.post("/updateMintStage", controller.updateMintStage);
router.post("/calc", controller.calc);
router.post("/sat/calc", controller.calSat);
router.post("/addFees", controller.addCollectionServiceFee);
router.post("/updateFees", controller.updateServiceFee);
router.post("/collectionFee", controller.addCollectionServiceFee);
router.post("/approve", controller.approveCollection);
router.post("/startMint", controller.startMint);
router.post("/stopMint", controller.stopMint);
router.post("/pauseMint", controller.pause);
router.post("/resumeMint", controller.unpause);
router.post("/sat/mintOnSat", controller.mintOnSat);
router.post("/sat/inscribeCount", controller.inscribeCount);
router.post("/sat/getAddress", controller.getAddresses);
router.post("/sat/updateDetails", controller.updateInscriptionDetails);
router.post("/sat/getPendingOrder", controller.getPendingOrders);
router.post("/addMintDetails", controller.addMintDetails);
router.get("/getCollections", controller.getCollections);
router.get("/getMintDetails/:collectionId", controller.getMintDetails);
router.post("/checkWhitelist", controller.checkWhitelist);
router.post("/addFeatured", controller.addFeaturedCollection);
router.post("/removeFeatured", controller.removeFeaturedCollection);
router.get("/getFeatured", controller.getFeaturedCollections);
router.get("/sats", controller.getAvailableSat);


module.exports = router;


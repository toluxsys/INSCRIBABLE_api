const express = require("express");
const controller = require("../controllers/collection");
const path = require("path");
const router = express.Router();
const basicAuth = require('express-basic-auth')
const dotenv = require("dotenv").config();
const { addressFileUpload, collectionFileUpload } = require("../middleware/fileUpload")
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

const collectionUploadFields = [
  { name: "banner", maxCount: 1 }, 
  { name: "featuredImage", maxCount: 1 },
];

// const fileStorage = multer.diskStorage({
//   destination: async function (req, file, cb) {
//     const directory = process.cwd()+`/src/address/${req.body.collectionId}`;
//     if (!fs.existsSync(directory)) {
//       fs.mkdirSync(directory, { recursive: true });
//     }
//     cb(null, directory);
//   },
//   filename: async function (req, file, cb) {
//     let _name = `addr-`+req.body.collectionId+`-`+req.body.name;
//     let fileName = _name + file.mimetype;
//     const filename = Date.now().toString()+"-"+fileName;
//     cb(null, filename);
//   },
// });

// const fileUpload = multer({
//   storage: fileStorage,
//   limits: { fileSize: 60 * 1024 * 1024 }, // 60MB
//   fileFilter: (req, file, cb) => {
//         if (file.mimetype == "text/plain") {
//             console.log(file.buffer)
//             cb(null, true);
//         } else {
//             cb(null, false);
//             const err = new Error('Only .txt file format allowed!')
//             err.name = 'ExtensionError'
//             return cb(err);
//         }
//     },
// }).array("address", 1);

router.post("/add", collectionFileUpload.fields(collectionUploadFields), controller.addCollection);
router.post("/addMintAddress",addressFileUpload, controller.addMintAddress);
router.post("/upload", controller.addCollectionItems);
router.post("/seleteItem", controller.selectItem);
router.post("/undoSelection/:inscriptionId", controller.undoSelection);
router.post("/getImages", controller.getImages);
router.post("/inscribe", controller.inscribe1);
router.post("/getInscriptions", controller.getCollectionInscription);
router.post("/inscribedImages", controller.getInscribedImages);
router.post("/getCollection", controller.getCollection);
router.post("/updateMintStage", controller.updateMintStage);
router.post("/calc", controller.calc);
router.post("/addFees", controller.addCollectionServiceFee);
router.post("/updateFees", controller.updateServiceFee);
router.post("/collectionFee", controller.addCollectionServiceFee);
router.post("/approve", controller.approveCollection);
router.post("/startMint", controller.startMint);
router.post("/stopMint", controller.stopMint);
router.post("/pauseMint", controller.pause);
router.post("/resumeMint", controller.unpause);
router.post("/sat/inscribeCount", controller.inscribeCount);
router.post("/sat/getAddress", controller.getAddresses);
router.post("/sat/getPendingOrder", controller.getPendingOrders);
router.post("/addMintDetails", controller.addMintDetails);
router.get("/getCollections", controller.getCollections);
router.get("/getMintDetails/:collectionId", controller.getMintDetails);
router.post("/checkWhitelist", controller.checkWhitelist);
router.post("/addFeatured", controller.addFeaturedCollection);
router.post("/removeFeatured", controller.removeFeaturedCollection);
router.get("/getFeatured", controller.getFeaturedCollections);
router.get("/sats", controller.getAvailableSat);
router.post("/updateSatCost", controller.updateSatCost);
router.get("/getSatCost", controller.getSatCost);


module.exports = router;


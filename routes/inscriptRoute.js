const express = require("express");
const controller = require("../controllers/inscriptionController");
const path = require("path");
const router = express.Router();
//const fileUpload = require("express-fileupload");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const basicAuth = require('express-basic-auth')
const dotenv = require("dotenv").config();
const multer = require("multer");

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

// router.use(
//   fileUpload({
//     useTempFiles: true,
//     tempFileDir: path.join(process.cwd(), `tmp`),
//     createParentPath: true,
//   })
// );

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const directory = process.cwd()+`/src/img/uncompressed/`;
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    cb(null, directory);
  },
  filename: async function (req, file, cb) {
    // remove space from filename and replace with underscore
    const filename = Date.now().toString()+"-"+file.originalname.replace(/\s/g, "_");
    cb(null, filename);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB
  // fileFilter: (req, file, cb) => {
  //       if (file.mimetype == "audio/vnd.wav" || file.mimetype == "audio/mp3") {
  //           console.log(file.buffer)
  //           cb(null, true);
  //       } else {
  //           cb(null, false);
  //           const err = new Error('Only .wav and .mp3 format allowed!')
  //           err.name = 'ExtensionError'
  //           return cb(err);
  //       }
  //   },
}).array("unCompImage", 20);

router.post("/upload", upload ,controller.upload);
router.post("/upload/multiple", upload, controller.uploadMultiple);
router.post("/inscribe", controller.inscribe);
router.post("/sendInscription", controller.sendInscription);
router.post("/inscription/calc", controller.inscriptionCalc);
router.post("/bulkInscription/calc", controller.bulkInscriptionCalc);
router.post("/checkPayment", controller.checkPayments);
router.post("/addNetwork", controller.addNetwork);
router.post("/changeNetwork", controller.toogleNetwork);
router.post("/checkStage", controller.getStage);
router.post("/getConversion", controller.getConversion);
router.post("/orderDetails", controller.getOrderDetails);
router.post("/getInscriptions", controller.getInscriptions);
router.post("/addSats", controller.addSats);
router.post("/addSats", controller.addSats);
router.post("/brc20", controller.brc20);
router.post("/text", controller.inscribeText);
router.post("/satNames", controller.satNames);
router.post("/brc1155", controller.brc1155);
router.get("/getRecFee", controller.getRecFee);
router.get("/getNetwork", controller.getNetwork);

module.exports = router;

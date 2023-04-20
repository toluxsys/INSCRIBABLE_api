const express = require("express");
const controller = require("../controllers/inscriptionController");
const path = require("path");
const router = express.Router();
const fileUpload = require("express-fileupload");
router.use(express.urlencoded({ extended: false }));
router.use(express.json());

router.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: path.join(process.cwd(), `tmp`),
    createParentPath: true,
  })
);

router.post("/upload", controller.upload);
router.post("/upload/multiple", controller.uploadMultiple);
router.post("/send/utxo", controller.sendUtxo);
router.post("/inscribe", controller.inscribe);
router.post("/sendInscription", controller.sendInscription);
router.post("/inscription/calc", controller.inscriptionCalc);
router.post("/checkPayment", controller.checkPayment);
router.post("/checkUtxo", controller.checkUtxo);
router.get("/getRecFee", controller.getRecFee);

module.exports = router;

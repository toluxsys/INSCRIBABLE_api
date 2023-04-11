const express = require("express");
const controller = require("../controllers/inscriptionController");
const router = express.Router();
router.use(express.urlencoded({ extended: false }));
router.use(express.json());

router.post("/upload", controller.upload);
router.post("/upload/multiple", controller.uploadMultiple);
router.post("/send/utxo", controller.sendUtxo);
router.post("/inscribe", controller.inscribe);
router.post("/sendInscription", controller.sendInscription);
router.post("/inscription/calc", controller.inscriptionCalc);

module.exports = router;

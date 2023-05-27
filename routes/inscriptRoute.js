const express = require("express");
const controller = require("../controllers/inscriptionController");
const path = require("path");
const router = express.Router();
const fileUpload = require("express-fileupload");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
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
router.post("/send/utxo", controller.sendUtxo1);
router.post("/inscribe", controller.inscribe);
router.post("/sendInscription", controller.sendInscription);
router.post("/inscription/calc", controller.inscriptionCalc);
router.post("/bulkInscription/calc", controller.bulkInscriptionCalc);
router.post("/checkPayment", controller.checkPayment);
router.post("/checkUtxo", controller.checkUtxo);
router.post("/addNetwork", controller.addNetwork);
router.post("/changeNetwork", controller.toogleNetwork);
router.post("/createPaymentLink", controller.createPaymentLink);
router.post("/collectAddress", controller.collectAddress);
router.post("/completePay", controller.completePayment);
router.post("/completePayment", controller.completePayment);
router.post("/checkStage", controller.getStage);
router.post("/getConversion", controller.getConversion);
router.post("/getPayLinkDetails", controller.getPayLinkDetails);
router.post("/orderDetails", controller.getOrderDetails);
router.post("/getInscriptions", controller.getInscriptions);
router.post("/brc20", controller.brc20);
router.post("/text", controller.inscribeText);
router.post("/satNames", controller.satNames);
router.post("/brc1155", controller.brc1155);
router.get("/getRecFee", controller.getRecFee);
router.get("/getNetwork", controller.getNetwork);

module.exports = router;

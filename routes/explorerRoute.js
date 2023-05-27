const express = require("express");
const controller = require("../controllers/explorer");
const path = require("path");
const router = express.Router();
router.use(express.urlencoded({ extended: true }));
router.use(express.json());

router.get("/getContent/:inscription_id", controller.getInscriptionContent);
router.get("/preview_inscription/:inscription_id", controller.previewInscriptionContent);
router.get("/feed", controller.getInscriptionFeed);
router.get("/inscription/id/:inscription_id", controller.getInscriptionById);
router.get("/inscription/address/:address", controller.getInscriptionByAddress);

module.exports = router;

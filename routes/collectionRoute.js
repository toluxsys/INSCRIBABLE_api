const express = require("express");
const controller = require("../controllers/collection");
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

router.post("/add", controller.addCollection);
router.post("/upload", controller.addCollectionItems);
router.post("/seleteItem", controller.seleteItem);
router.post("/getImages", controller.getImages);
router.post("/sendUtxo", controller.sendUtxo);
router.post("/inscribe", controller.inscribe);
router.post("/getInscriptions", controller.getCollectionInscription);
router.post("/inscribedImages", controller.getInscribedImages);
router.post("/getCollection", controller.getCollection);
router.get("/getCollections", controller.getCollections);


module.exports = router;

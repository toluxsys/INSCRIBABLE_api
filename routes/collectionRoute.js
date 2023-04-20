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
router.post("/mint", controller.mint);

module.exports = router;

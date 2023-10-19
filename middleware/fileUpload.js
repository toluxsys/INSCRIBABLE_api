const multer = require("multer");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const addressFileStorage = multer.diskStorage({
    destination: async function (req, file, cb) {
      const directory = process.cwd()+`/src/address/${req.body.collectionId}`;
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
      cb(null, directory);
    },
    filename: async function (req, file, cb) {
      let _name = `addr-`+req.body.collectionId+`-`+req.body.name;
      let fileName = _name + file.mimetype;
      const filename = Date.now().toString()+"-"+fileName;
      cb(null, filename);
    },
});
  
const addressFileUpload = multer({
storage: addressFileStorage,
limits: { fileSize: 60 * 1024 * 1024 }, // 60MB
fileFilter: (req, file, cb) => {
        if (file.mimetype == "text/plain") {
            console.log(file.buffer)
            cb(null, true);
        } else {
            cb(null, false);
            const err = new Error('Only .txt file format allowed!')
            err.name = 'ExtensionError'
            return cb(err);
        }
    },
}).array("address", 1);

const collectionStorage = multer.diskStorage({
destination: async function (req, file, cb) {
    let id = uuidv4()
    const directory = process.cwd()+`/src/img/${id}`;
    if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
    }
    cb(null, directory);
},
filename: async function (req, file, cb) {
    const filename = file.originalname;
    cb(null, filename);
},
});
  
const collectionFileUpload = multer({
    storage: collectionStorage,
    limits: { fileSize: 60 * 1024 * 1024 }, // 60MB
})

module.exports = { addressFileUpload, collectionFileUpload }
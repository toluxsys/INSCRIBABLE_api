const multer = require('multer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const addressFileStorage = multer.diskStorage({
  async destination(req, file, cb) {
    const directory = `${process.cwd()}/src/address/${req.body.collectionId}`;
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    cb(null, directory);
  },
  async filename(req, file, cb) {
    const name = `addr-${req.body.collectionId}-${req.body.name}.txt`;
    const filename = name;
    cb(null, filename);
  },
});

const addressFileUpload = multer({
  storage: addressFileStorage,
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(null, false);
      const err = new Error('Only .txt file format allowed!');
      err.name = 'ExtensionError';
      return cb(err);
    }
  },
}).array('address', 1);

const collectionStorage = multer.diskStorage({
  async destination(req, file, cb) {
    const directory = `${process.cwd()}/src/img/`;
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    cb(null, directory);
  },
  async filename(req, file, cb) {
    const id = uuidv4();
    const filename = `${id}-${file.originalname}`;
    cb(null, filename);
  },
});

const collectionFileUpload = multer({
  storage: collectionStorage,
  limits: { fileSize: 60 * 1024 * 1024 }, // 60MB
});

module.exports = { addressFileUpload, collectionFileUpload };

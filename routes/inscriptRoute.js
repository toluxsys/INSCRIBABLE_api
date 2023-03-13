const express = require("express");
const fileUpload = require("express-fileupload");
const { unlinkSync } = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const Inscription = require("../model/inscription");
const { compressImage } = require("../controllers/compressImage");
const { createHDWallet } = require("../controllers/createWallet");
const {
  sendBitcoin,
  getRecomendedFee,
  getWalletBalance,
} = require("../controllers/sendBitcoin");
const {
  inscribe,
  sendInscription,
  inscriptionPaymentAddress,
} = require("../controllers/ordController");

const router = express.Router();

router.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: path.join(process.cwd(), `tmp`),
    createParentPath: true,
    limits: { fileSize: 2 * 1024 * 1024 },
  })
);

router.use(express.urlencoded({ extended: false }));
router.use(express.json());

router.route(`/upload`).post(async (req, res) => {
  try {
    const file = req.files.unCompImage;
    const feeRate = parseInt(req.body.feeRate);
    const networkName = req.body.networkName;
    const details = await init(file, feeRate, networkName);
    res.status(200).json({
      message: "image compresed",
      compImage: details.compImage,
      cost: details.inscriptionCost,
      paymentAddress: details.paymentAddress,
      passKey: details.passKey,
      inscriptionId: details.inscriptionId,
    });
  } catch (e) {
    console.log(e);
    if (
      e.message === "Cannot read properties of undefined (reading 'compImage')"
    ) {
      return res.status(400).json({ message: "bad request" });
    }
    return res.status(500).json({ message: e.message });
  }
});

router.route(`/send/utxo`).post(async (req, res) => {
  try {
    const inscriptionId = req.body.id;
    const passKey = req.body.passKey;
    const network = req.body.networkName;
    const verified = await verify(inscriptionId, passKey);

    if (verified === false) {
      return res.status(400).json({ message: "Invalid Pass Key" });
    }

    const inscription = await Inscription.where("id").equals(inscriptionId);
    const instance = inscription[0];

    const payAddressId = instance.inscriptionDetails.payAddressId;
    const payAddress = instance.inscriptionDetails.payAddress;
    const addressFromId = (await createHDWallet(network, payAddressId)).address;

    const balance = await getWalletBalance(payAddress, network);

    if (addressFromId !== payAddress) {
      return res.status(400).json({ message: "Invalid address from ID" });
    }

    if (balance < instance.cost.total * 1e8) {
      return res.status(400).json({
        message: `Inscription cost not paid. Required to pay: ${
          instance.cost.total
        }, available: ${balance / 1e8}`,
      });
    }

    //@note recieverAddress should be gotten from bitcoinD's api
    let recieverAddress;
    if (network === "mainnet") {
      recieverAddress = process.env.MAINNET_SERVICE_CHARGE_ADDRESS;
    } else {
      recieverAddress = "mneYWPrWzvQqepM6us5nZhhXxAoUHaXo7M";
    }

    //const recieverAddress = await inscriptionPaymentAddress();
    const txDetails = await sendBitcoin(
      payAddressId,
      recieverAddress,
      network,
      instance.cost.inscriptionCost * 1e8
    );
    //unlinkSync(inscription.)
    instance.inscriptionDetails.recieverAddress = recieverAddress;
    await instance.save();

    return res.status(200).json({
      message: "inscription Created",
      details: txDetails,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: e.message });
  }
});

router.route(`/create`).post(async (req, res) => {
  try {
    const inscriptionId = req.body.id;
    const passKey = req.body.passKey;
    const network = req.body.networkName;
    const verified = await verify(inscriptionId, passKey);

    if (!verified) {
      return res.status(400).json({ message: "Invalid Pass Key" });
    }

    const inscription = await Inscription.where("id").equals(inscriptionId);
    const instance = inscription[0];
    const recieverAddress = instance.recieverAddress;

    const balance = await getWalletBalance(recieverAddress, network);

    if (balance < instance.cost.inscriptionCost * 1e8) {
      return res.status(400).json({
        message: `utxo not sent. Required to pay: ${
          instance.cost.inscriptionCost
        }, available: ${balance / 1e8}`,
      });
    }

    const newInscription = await inscribe(
      instance.feeRate,
      instance.inscriptionDetails.fileName
    );
    //unlinkSync(inscription.)
    instance.inscribed = true;
    await instance.save();

    return res.status(200).json({
      message: "inscription Created",
      details: newInscription,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: e.message });
  }
});

router.route(`/send/inscription`).post(async (req, res) => {
  try {
    const id = req.body.id;
    const passKey = req.body.passKey;
    const address = req.body.address;
    const verified = await verify(id, passKey);
    if (!verified) {
      return res.status(400).json({ message: `Invalid Pass Key` });
    }
    const inscription = await Inscription.where("id").equals(id);
    const instance = inscription[0];
    const inscriptionId = instance.inscription.inscriptionId;
    const txId = await sendInscription(address, inscriptionId);
    instance.sent = true;
    await instance.save();

    return res.status(200).json({
      message: "inscription sent",
      txId: txId,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: e.message });
  }
});

router.route(`/getRecFee`).get(async (req, res) => {
  try {
    const recomendedFee = await getRecomendedFee();
    return res.status(200).json({
      message: "ok",
      fees: recomendedFee,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: e.message });
  }
});

router.route(`/inscription/calc`).post(async (req, res) => {
  try {
    const file = req.files.unCompImage;
    const feeRate = parseInt(req.body.feeRate);
    const details = await getInscriptionCost(file, feeRate);

    return res.status(200).json({
      message: "ok",
      details,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: e.message });
  }
});

const init = async (file, feeRate, networkName) => {
  try {
    const id = await import("nanoid");
    const nanoid = id.customAlphabet(process.env.NANO_ID_SEED);
    const passKey = nanoid(32);
    const enKey = await bcrypt.hash(passKey, 10);
    const inscriptionId = uuidv4();
    const count = await Inscription.find({}, { _id: 0 });

    const fileName = new Date().getTime().toString() + path.extname(file.name);
    const savePath = path.join(
      process.cwd(),
      "src",
      "img",
      "uncompressed",
      fileName
    );
    await file.mv(savePath);
    const compImage = await compressImage(fileName);
    const inscriptionCost = inscriptionPrice(feeRate, compImage.sizeOut * 1e3);

    const payDetails = await createHDWallet(networkName, count.length);
    let paymentAddress = await payDetails.address;

    const inscription = new Inscription({
      id: inscriptionId,
      inscribed: false,
      feeRate: feeRate,
      encryptedPassKey: enKey,

      inscriptionDetails: {
        imageSizeIn: compImage.sizeIn,
        imageSizeOut: compImage.sizeOut,
        fileName: fileName,
        comPercentage: compImage.comPercentage,
        payAddress: paymentAddress,
        payAddressId: count.length,
      },
      cost: inscriptionCost,
      feeRate: feeRate,
    });

    await inscription.save();
    return {
      compImage,
      inscriptionCost,
      paymentAddress,
      passKey,
      inscriptionId,
    };
  } catch (e) {
    console.log(e);
  }
};

const verify = async (inscriptionId, passKey) => {
  const inscription = await Inscription.where("id").equals(inscriptionId);
  return await bcrypt.compare(passKey, inscription[0].encryptedPassKey);
};

const inscriptionPrice = (feeRate, fileSize) => {
  const serviceCharge = parseInt(process.env.SERVICE_CHARGE) / 1e8;
  const sats = feeRate * fileSize;
  const inscriptionCost = (sats + 1e4 + 6e2) / 1e8; // 1e5 is the amount of sats each ordinal has and 6e2 is the dust Limit
  const total = serviceCharge + inscriptionCost;
  return { serviceCharge, inscriptionCost, total };
};

const getInscriptionCost = async (file, feeRate) => {
  try {
    const fileName = new Date().getTime().toString() + path.extname(file.name);
    const savePath = path.join(
      process.cwd(),
      "src",
      "img",
      "uncompressed",
      fileName
    );
    await file.mv(savePath);
    const compImage = await compressImage(fileName);
    const unCompInscriptionCost = inscriptionPrice(
      feeRate,
      compImage.sizeIn * 1e3
    );
    const compInscriptionCost = inscriptionPrice(
      feeRate,
      compImage.sizeOut * 1e3
    );

    const sizeIn = compImage.sizeIn;
    const sizeOut = compImage.sizeOut;
    const compPercentage = compImage.comPercentage;
    unlinkSync(compImage.outPath);
    return {
      compImage: {
        sizeIn,
        sizeOut,
        compPercentage,
      },
      unCompressed: unCompInscriptionCost.inscriptionCost,
      compressed: compInscriptionCost.inscriptionCost,
    };
  } catch (e) {
    console.log(e);
  }
};

module.exports = router;

const { unlinkSync, rmSync, existsSync, mkdirSync } = require("fs");
const axios = require("axios");
const path = require("path");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv").config();
const Inscription = require("../model/inscription");
const Ids = require("../model/ids");
const BulkInscription = require("../model/bulkInscription");
const {
  compressImage,
  compressAndSave,
  compressAndSaveBulk,
} = require("../helpers/compressImage");
const {
  createHDWallet,
  addWalletToOrd,
  utxoDetails,
} = require("../helpers/createWallet");
const {
  getRecomendedFee,
  getWalletBalance,
} = require("../helpers/sendBitcoin");

const {
  sendBitcoin,
  createLegacyAddress,
  createTaprootAddress,
} = require("../helpers/sendBitcoin2");
const { getType } = require("../helpers/getType");
const { cwd } = require("process");

module.exports.upload = async (req, res) => {
  try {
    const file = req.files.unCompImage;
    const feeRate = parseInt(req.body.feeRate);
    const networkName = req.body.networkName;
    const optimize = req.body.optimize;
    const details = await init(file, feeRate, networkName, optimize);
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
    return res.status(400).json({ message: e.message });
  }
};

module.exports.uploadMultiple = async (req, res) => {
  try {
    const files = req.files.unCompImage;
    const feeRate = parseInt(req.body.feeRate);
    const networkName = req.body.networkName;
    const optimize = req.body.optimize;
    const details = await initBulk(files, feeRate, networkName, optimize);
    return res.status(200).json({
      message: "image compresed",
      cost: details.totalCost,
      paymentAddress: details.paymentAddress,
      passKey: details.passKey,
      inscriptionId: details.inscriptionId,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: e.message });
  }
};

module.exports.sendUtxo = async (req, res) => {
  try {
    const inscriptionId = req.body.id;
    const passKey = req.body.passKey;
    const network = req.body.networkName;
    const inscriptionType = getType(inscriptionId);

    let verified;
    let inscription;
    let instance;
    let addrCount;
    let details;
    let amount;
    let payAddress;
    let addressFromId;
    let payAddressId;
    let balance;
    let txDetails;
    let ids;

    if (inscriptionType === "single") {
      verified = await verify(inscriptionId, passKey, inscriptionType);
      if (verified === false) {
        return res.status(400).json({ message: "Invalid Pass Key" });
      }
      inscription = await Inscription.where("id").equals(inscriptionId);
      instance = inscription[0];
      addrCount = 1;
      amount = instance.cost.inscriptionCost;
      payAddressId = instance.inscriptionDetails.payAddressId;
      payAddress = instance.inscriptionDetails.payAddress;
      addressFromId = (await createLegacyAddress(network, payAddressId))
        .p2pkh_addr;
      ids = await Ids.where("id").equals(instance._id);
      startTime = ids.startTime;
      if (addressFromId !== payAddress) {
        return res.status(400).json({ message: "Invalid address from ID" });
      }
    } else if (inscriptionType === "bulk") {
      verified = await verify(inscriptionId, passKey, type);
      if (verified === false) {
        return res.status(400).json({ message: "Invalid Pass Key" });
      }
      inscription = await BulkInscription.where("id").equals(inscriptionId);
      instance = inscription[0];
      addrCount = instance.inscriptionDetails.totalAmount;
      amount = instance.cost.costPerInscription.inscriptionCost;
      payAddressId = instance.inscriptionDetails.payAddressId;
      payAddress = instance.inscriptionDetails.payAddress;
      addressFromId = (await createLegacyAddress(network, payAddressId))
        .p2pkh_addr;
      ids = await Ids.where("id").equals(instance._id);
      startTime = ids.startTime;
      if (addressFromId !== payAddress) {
        return res.status(400).json({ message: "Invalid address from ID" });
      }
    }

    balance = await getWalletBalance(payAddress, network);
    if (balance < instance.cost.total * 1e8) {
      return res.status(400).json({
        message: `inscription cost not received. Available: ${
          balance / 1e8
        }, Required: ${instance.cost.total}`,
      });
    }

    details = await utxoDetails(inscriptionId, addrCount, amount, network);
    txDetails = await sendBitcoin(network, payAddressId, details);
    const txHash = await axios.post(
      process.env.ORD_API_URL + `/ord/broadcastTransaction`,
      { txHex: txDetails.rawTx, networkName: network }
    );
    if (txHash.data.message !== "ok") {
      return res.status(500).json({
        message: txHash.data.message,
      });
    }
    instance.inscriptionDetails.receciverDetails = details;
    ids.status = `utxo sent`;
    await instance.save();
    return res.status(200).json({
      message: "ok",
      userResponse: {
        details: txDetails,
        txId: txHash.data.userResponse.data,
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: e.message });
  }
};

module.exports.inscribe = async (req, res) => {
  try {
    const inscriptionId = req.body.id;
    const passKey = req.body.passKey;
    const receciverAddress = req.body.address;
    const type = getType(inscriptionId);
    let verified;
    let inscription;
    let instance;
    let newInscription;
    let imageName;
    let ids;

    const result = await axios.post(
      process.env.ORD_API_URL + `/ord/wallet/balance`,
      { walletName: inscriptionId }
    );
    const balance = result.data.userResponse.data;

    if (type === "single") {
      verified = await verify(inscriptionId, passKey, type);
      if (!verified) {
        return res.status(400).json({ message: "Invalid Pass Key" });
      }
      inscription = await Inscription.where("id").equals(inscriptionId);
      instance = inscription[0];
      imageName = instance.inscriptionDetails.fileName;
      ids = await Ids.where("id").equals(instance._id);

      if (balance < instance.cost.inscriptionCost * 1e8) {
        return res.status(400).json({
          status: false,
          message: `not enough cardinal utxo for inscription. Available: ${balance}`,
        });
      }
    } else if (type === "bulk") {
      verified = await verify(inscriptionId, passKey, type);
      if (!verified) {
        return res.status(400).json({ message: "Invalid Pass Key" });
      }
      inscription = await BulkInscription.where("id").equals(inscriptionId);
      instance = inscription[0];
      ids = await Ids.where("id").equals(instance._id);
      if (balance < instance.cost.cardinal * 1e8) {
        return res.status(400).json({
          status: false,
          message: `not enough cardinal utxo for inscription. Available: ${balance}`,
        });
      }
    }

    newInscription = await axios.post(
      process.env.ORD_API_URL + `/ord/create/inscribe`,
      {
        feeRate: instance.feeRate,
        receiverAddress: receciverAddress,
        cid: instance.inscriptionDetails.cid,
        inscriptionId: inscriptionId,
        type: type,
        imageName: imageName,
      }
    );
    if (newInscription.data.message !== "ok") {
      return res.status(400).json({ message: newInscription.data.message });
    }
    instance.inscription = newInscription.data.userResponse.data;
    ids.status = `inscription complete`;
    await ids.save();
    if (receciverAddress === undefined || receciverAddress === null) {
      instance.inscribed = true;
      await instance.save();
      return;
    } else {
      instance.sent = true;
      instance.inscribed = true;
      await instance.save();
      return;
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: e.message });
  }
};

module.exports.sendInscription = async (req, res) => {
  try {
    const id = req.body.inscriptionId;
    const passKey = req.body.passKey;
    const inscriptions = req.body.inscriptions; // inscriptions in an array of objects containing the inscription id to be sent and the receiver address;
    const verified = await verify(id, passKey);
    if (!verified) {
      return res.status(400).json({ message: `Invalid Pass Key` });
    }
    const result = await axios.post(
      process.env.process.env.ORD_API_URL + `/ord/sendInscription`,
      { inscriptions: inscriptions, inscriptionId: id }
    );

    if (result.data.message !== `ok`) {
      return res.status(400).json({ message: result.data.message });
    }

    return res.status(200).json({
      message: "inscription sent",
      txId: result.data.userResponse.data,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: e.message });
  }
};

module.exports.getRecFee = async (req, res) => {
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
};

module.exports.inscriptionCalc = async (req, res) => {
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
};

module.exports.checkPayment = async (req, res) => {
  try {
    const { networkName, inscriptionId } = req.body;
    const type = getType(inscriptionId);
    let inscription;
    let balance;

    if (type === `single`) {
      inscription = await Inscription.findOne({ id: inscriptionId });
      balance = await getWalletBalance(
        inscription.inscriptionDetails.payAddress,
        networkName
      );
    } else if (type === `bulk`) {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
      balance = await getWalletBalance(
        inscription.inscriptionDetails.payAddress,
        networkName
      );
    }

    if (balance < inscription.cost.total * 1e8) {
      return res.status(400).json({
        status: false,
        message: `inscription cost not received. Available: ${
          balance / 1e8
        }, Required: ${inscription.cost.total}`,
      });
    } else {
      return res
        .status(200)
        .json({ status: true, message: `ok`, userResponse: true });
    }
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.checkUtxo = async (req, res) => {
  try {
    const { inscriptionId } = req.body;
    const type = getType(inscriptionId);
    let inscription;
    let balance;

    if (type === `single`) {
      inscription = await Inscription.findOne({ id: inscriptionId });
      const result = await axios.post(
        process.env.ORD_API_URL + `/ord/wallet/balance`,
        { walletName: inscriptionId }
      );
      balance = result.data.userResponse.data;
      if (balance < inscription.cost.inscriptionCost * 1e8) {
        return res.status(400).json({
          status: false,
          message: `not enough cardinal utxo for inscription. Available: ${balance}`,
        });
      } else {
        return res
          .status(200)
          .json({ status: true, message: `ok`, userResponse: true });
      }
    } else if (type === `bulk`) {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
      const result = await axios.post(
        process.env.ORD_API_URL + `/ord/wallet/balance`,
        { walletName: inscriptionId }
      );
      balance = result.data.userResponse.data;
      if (balance < inscription.cost.cardinal * 1e8) {
        return res.status(400).json({
          status: false,
          message: `not enough cardinal utxo for inscription. Available: ${balance}`,
        });
      } else {
        return res
          .status(200)
          .json({ status: true, message: `ok`, userResponse: true });
      }
    }
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

const init = async (file, feeRate, networkName, optimize) => {
  try {
    const id = await import("nanoid");
    const nanoid = id.customAlphabet(process.env.NANO_ID_SEED);
    const passKey = nanoid(32);
    const enKey = await bcrypt.hash(passKey, 10);
    const inscriptionId = `s${uuidv4()}`;
    const count = await Ids.find({}, { _id: 0 });

    const fileName = new Date().getTime().toString() + path.extname(file.name);
    const savePath = path.join(
      process.cwd(),
      "src",
      "img",
      "uncompressed",
      fileName
    );
    await file.mv(savePath);

    if (optimize === `true`) {
      const compImage = await compressAndSave(fileName, true);
      const inscriptionCost = inscriptionPrice(
        feeRate,
        compImage.sizeOut * 1e3
      );

      const payDetails = await createLegacyAddress(networkName, count.length);
      let paymentAddress = payDetails.p2pkh_addr;

      const walletKey = await addWalletToOrd(inscriptionId);
      const blockHeight = await axios.post(
        process.env.ORD_API_URL + `/ord/getLatestBlock`
      );
      if (blockHeight.data.message !== `ok`) {
        return res.status(500).json({ message: blockHeight.data.message });
      }
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
          cid: compImage.cid,
        },
        walletDetails: {
          keyPhrase: walletKey,
          walletName: inscriptionId,
          creationBlock: blockHeight.data.userResponse.data,
        },
        cost: inscriptionCost,
        feeRate: feeRate,
      });

      const savedInscription = await inscription.save();
      const ids = new Ids({
        id: savedInscription._id,
        type: "single",
        startTime: Date.now(),
        status: `sending utxo`,
      });
      await ids.save();

      return {
        compImage,
        inscriptionCost,
        paymentAddress,
        passKey,
        inscriptionId,
      };
    } else if (optimize === `false`) {
      const image = await compressAndSave(fileName, false);
      const inscriptionCost = inscriptionPrice(feeRate, file.size * 1e3);

      const payDetails = await createLegacyAddress(networkName, count.length);
      let paymentAddress = payDetails.p2pkh_addr;

      const walletKey = await addWalletToOrd(inscriptionId);
      const blockHeight = await axios.post(
        process.env.ORD_API_URL + `/ord/getLatestBlock`
      );
      if (blockHeight.data.message !== `ok`) {
        return res.status(500).json({ message: blockHeight.data.message });
      }
      const inscription = new Inscription({
        id: inscriptionId,
        inscribed: false,
        feeRate: feeRate,
        encryptedPassKey: enKey,

        inscriptionDetails: {
          imageSizeIn: file.size,
          fileName: fileName,
          payAddress: paymentAddress,
          payAddressId: count.length,
          cid: image.cid,
        },
        walletDetails: {
          keyPhrase: walletKey,
          walletName: inscriptionId,
          creationBlock: blockHeight.data.userResponse.data,
        },
        cost: inscriptionCost,
        feeRate: feeRate,
      });

      const savedInscription = await inscription.save();
      const ids = new Ids({
        id: savedInscription._id,
        type: "single",
        startTime: Date.now(),
        status: `sending utxo`,
      });
      await ids.save();

      return {
        image,
        inscriptionCost,
        paymentAddress,
        passKey,
        inscriptionId,
      };
    }
  } catch (e) {
    console.log(e);
  }
};

const initBulk = async (files, feeRate, networkName, optimize) => {
  try {
    const id = await import("nanoid");
    const nanoid = id.customAlphabet(process.env.NANO_ID_SEED);
    const passKey = nanoid(32);
    const enKey = await bcrypt.hash(passKey, 10);
    const inscriptionId = `b${uuidv4()}`;
    const count = await Ids.find({}, { _id: 0 });
    const serviceCharge = parseInt(process.env.SERVICE_CHARGE) / 1e8;
    let optimized;

    if (optimize === `true`) {
      optimized = true;
    } else {
      optimized = false;
    }

    if (!existsSync(process.cwd() + `/src/bulk/${inscriptionId}`)) {
      mkdirSync(
        process.cwd() + `./src/bulk/${inscriptionId}`,
        { recursive: true },
        (err) => {
          console.log(err);
        }
      );
    }

    files.forEach(async (file, index) => {
      ext = path.extname(file.name);
      const fileName = `${index + 1}` + path.extname(file.name);
      const savePath = path.join(
        process.cwd(),
        "src",
        "bulk",
        `${inscriptionId}`,
        fileName
      );
      await file.mv(savePath);
    });

    const data = await compressAndSaveBulk(inscriptionId, optimized);
    const costPerInscription = inscriptionPrice(feeRate, data.largestFile);
    const totalCost = costPerInscription.total * files.length;
    const cardinals = costPerInscription.inscriptionCost * files.length;
    const payDetails = await createLegacyAddress(networkName, count.length);
    let paymentAddress = payDetails.p2pkh_addr;

    const walletKey = await addWalletToOrd(inscriptionId);
    const blockHeight = await axios.post(
      process.env.ORD_API_URL + `/ord/getLatestBlock`
    );

    const bulkInscription = new BulkInscription({
      id: inscriptionId,
      inscribed: false,
      feeRate: feeRate,
      encryptedPassKey: enKey,

      inscriptionDetails: {
        largestFile: data.largestFile,
        totalAmount: files.length,
        payAddress: paymentAddress,
        payAddressId: count.length,
        cid: data.cid,
      },
      cost: {
        serviceCharge: serviceCharge * files.length,
        costPerInscription: costPerInscription,
        total: totalCost,
        cardinal: cardinals,
      },
      walletDetails: {
        keyPhrase: walletKey,
        walletName: inscriptionId,
        creationBlock: blockHeight.data.userResponse.data,
      },
    });

    const savedInscription = await bulkInscription.save();

    const ids = new Ids({
      id: savedInscription._id,
      type: "bulk",
      startTime: Date.now(),
      status: `sending utxo(s)`,
    });
    await ids.save();

    return {
      data: data,
      costPerInscription: costPerInscription.total,
      totalCost: totalCost,
      paymentAddress: paymentAddress,
      passKey: passKey,
      inscriptionId: inscriptionId,
    };
  } catch (e) {
    console.log(e);
  }
};

const verify = async (inscriptionId, passKey, type) => {
  let inscription;
  if (type === `single`) {
    inscription = await Inscription.where("id").equals(inscriptionId);
    return await bcrypt.compare(passKey, inscription[0].encryptedPassKey);
  } else if (type === `bulk`) {
    inscription = await BulkInscription.where("id").equals(inscriptionId);
    return await bcrypt.compare(passKey, inscription[0].encryptedPassKey);
  }
};

const inscriptionPrice = (feeRate, fileSize) => {
  const serviceCharge = parseInt(process.env.SERVICE_CHARGE) / 1e8;
  const sats = feeRate * fileSize;
  const inscriptionCost = (sats + 1e4 + 800) / 1e8; // 1e4 is the amount of sats each ordinal has and 6e2 is the dust Limit
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

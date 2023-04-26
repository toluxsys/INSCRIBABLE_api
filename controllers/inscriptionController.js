const { unlinkSync, rmSync, existsSync, mkdirSync } = require("fs");
const axios = require("axios");
const path = require("path");
const bcrypt = require("bcrypt");
const Decimal = require("decimal.js");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv").config();
const Inscription = require("../model/inscription");
const Network = require("../model/network");
const Ids = require("../model/ids");
const BulkInscription = require("../model/bulkInscription");
const {
  compressImage,
  compressAndSave,
  compressAndSaveBulk,
  compressBulk,
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
      status: true,
      message: "ok",
      userResponse: {
        compImage: details.compImage,
        cost: details.inscriptionCost,
        paymentAddress: details.paymentAddress,
        passKey: details.passKey,
        inscriptionId: details.inscriptionId,
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(400).json({ status: false, message: e.message });
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
      status: true,
      message: "ok",
      userResponse: {
        inscriptionCost: details.cardinals,
        postage: 550,
        serviceCharge: details.serviceCharge,
        sizeFee: details.sizeFee,
        total: details.totalCost,
        paymentAddress: details.paymentAddress,
        passKey: details.passKey,
        inscriptionId: details.inscriptionId,
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.sendUtxo = async (req, res) => {
  try {
    const inscriptionId = req.body.id;
    const network = req.body.networkName;
    const inscriptionType = getType(inscriptionId);

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
    let txId;

    if (inscriptionType === "single") {
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
        return res
          .status(200)
          .json({ status: false, message: "Invalid address from ID" });
      }
    } else if (inscriptionType === "bulk") {
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
        return res
          .status(200)
          .json({ status: false, message: "Invalid address from ID" });
      }
    }

    balance = await getWalletBalance(payAddress, network);
    if (balance < instance.cost.total) {
      return res.status(200).json({
        status: false,
        message: `inscription cost not received. Available: ${balance}, Required: ${instance.cost.total}`,
      });
    }

    details = await utxoDetails(inscriptionId, addrCount, amount, network);
    txDetails = await sendBitcoin(network, payAddressId, details);

    const txHash = await axios.post(
      process.env.ORD_API_URL + `/ord/broadcastTransaction`,
      { txHex: txDetails.rawTx, networkName: network }
    );

    if (txHash.data.message !== "ok") {
      return res.status(200).json({
        status: false,
        message: txHash.data.message,
      });
    }
    txId = txHash.data.userResponse.data;
    instance.inscriptionDetails.receciverDetails = details;
    instance.stage = "stage 2";
    ids.status = `utxo sent`;
    await instance.save();
    return res.status(200).json({
      status: true,
      message: "ok",
      userResponse: {
        details: txDetails,
        txId: txId,
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.inscribe = async (req, res) => {
  try {
    const inscriptionId = req.body.id;
    const receciverAddress = req.body.address;
    const networkName = req.body.networkName;
    const type = getType(inscriptionId);
    let inscription;
    let instance;
    let newInscription;
    let imageName;
    let ids;

    const result = await axios.post(
      process.env.ORD_API_URL + `/ord/wallet/balance`,
      { walletName: inscriptionId, networkName: networkName }
    );
    const balance = result.data.userResponse.data;

    if (type === "single") {
      inscription = await Inscription.where("id").equals(inscriptionId);
      instance = inscription[0];
      imageName = instance.inscriptionDetails.fileName;
      ids = await Ids.where("id").equals(instance._id);
      const cost = Math.floor(instance.cost.inscriptionCost * 1e8);
      if (balance < cost) {
        return res.status(200).json({
          status: false,
          message: `not enough cardinal utxo for inscription. Available: ${balance}`,
        });
      }
    } else if (type === "bulk") {
      inscription = await BulkInscription.where("id").equals(inscriptionId);
      let cost = Math.floor(instance.cost.cardinal * 1e8);
      instance = inscription[0];
      ids = await Ids.where("id").equals(instance._id);
      if (balance < cost) {
        return res.status(200).json({
          status: false,
          message: `not enough cardinal utxo for inscription. Available: ${balance}`,
        });
      }
    }

    newInscription = await axios.post(
      process.env.ORD_API_URL + `/ord/inscribe`,
      {
        feeRate: instance.feeRate,
        receiverAddress: receciverAddress,
        cid: instance.inscriptionDetails.cid,
        inscriptionId: inscriptionId,
        type: type,
        imageName: imageName,
        networkName: networkName,
      }
    );
    if (newInscription.data.message !== "ok") {
      return res
        .status(200)
        .json({ status: false, message: newInscription.data.message });
    }
    instance.inscription = newInscription.data.userResponse.data;
    if (receciverAddress === undefined || receciverAddress === null) {
      instance.inscribed = true;
      instance.stage = "stage 3";
      await instance.save();
      return;
    } else {
      instance.sent = true;
      instance.inscribed = true;
      instance.stage = "stage 3";
      await instance.save();
      return res.status(200).json({
        status: true,
        message: `ok`,
        userResponse: newInscription.data.userResponse.data,
      });
    }
  } catch (e) {
    console.log(e);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.sendInscription = async (req, res) => {
  try {
    const id = req.body.inscriptionId;
    const inscriptions = req.body.inscriptions; // inscriptions in an array of objects containing the inscription id to be sent and the receiver address;
    const networkName = req.body.networkName;
    const result = await axios.post(
      process.env.process.env.ORD_API_URL + `/ord/sendInscription`,
      {
        inscriptions: inscriptions,
        inscriptionId: id,
        networkName: networkName,
      }
    );

    if (result.data.message !== `ok`) {
      return res
        .status(200)
        .json({ status: false, message: result.data.message });
    }

    return res.status(200).json({
      status: true,
      message: "inscription sent",
      txId: result.data.userResponse.data,
    });
  } catch (e) {
    console.log(e);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.getRecFee = async (req, res) => {
  try {
    const recomendedFee = await getRecomendedFee();
    return res.status(200).json({
      status: true,
      message: "ok",
      fees: recomendedFee,
    });
  } catch (e) {
    console.log(e);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.inscriptionCalc = async (req, res) => {
  try {
    const file = req.files.unCompImage;
    const feeRate = parseInt(req.body.feeRate);
    const optimize = req.body.optimize;
    const details = await getInscriptionCost(file, feeRate, optimize);

    return res.status(200).json({
      status: true,
      message: "ok",
      details,
    });
  } catch (e) {
    console.log(e);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.bulkInscriptionCalc = async (req, res) => {
  try {
    const files = req.files.unCompImage;
    const feeRate = parseInt(req.body.feeRate);
    const optimize = req.body.optimize;
    const details = await getBulkInscriptionCost(files, feeRate, optimize);

    return res.status(200).json({
      status: true,
      message: "ok",
      userResponse: details,
    });
  } catch (e) {
    console.log(e);
    return res.status(400).json({ status: false, message: e.message });
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

    const cost = Math.floor(inscription.cost.total * 1e8);

    if (Math.floor(balance) < cost) {
      return res.status(200).json({
        status: false,
        message: `inscription cost not received. Available: ${balance}, Required: ${inscription.cost.total}`,
      });
    } else {
      return res
        .status(200)
        .json({ status: true, message: `ok`, userResponse: true });
    }
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.checkUtxo = async (req, res) => {
  try {
    const { inscriptionId, networkName } = req.body;
    const type = getType(inscriptionId);
    let inscription;
    let balance;

    if (type === `single`) {
      inscription = await Inscription.findOne({ id: inscriptionId });
      const result = await axios.post(
        process.env.ORD_API_URL + `/ord/wallet/balance`,
        { walletName: inscriptionId, networkName: networkName }
      );
      balance = result.data.userResponse.data;
      if (balance < inscription.cost.inscriptionCost) {
        return res.status(200).json({
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
        { walletName: inscriptionId, networkName: networkName }
      );
      balance = result.data.userResponse.data;
      if (balance < inscription.cost.cardinal) {
        return res.status(200).json({
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
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.getNetwork = async (req, res) => {
  try {
    let stat;
    const networks = await Network.where("status").equals(`active`);
    const active = networks[0];

    return res
      .status(200)
      .json({ status: true, message: "ok", userResponse: active.networkName });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.toogleNetwork = async (req, res) => {
  try {
    const { networkName } = req.body;

    await Network.findOneAndUpdate(
      { status: `active` },
      { status: `inactive` },
      { new: true }
    );

    await Network.findOneAndUpdate(
      { networkName: networkName },
      { status: "active" },
      { new: true }
    );
    return res.status(200).json({
      status: true,
      message: "ok",
      userResponse: `${networkName} active`,
    });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.addNetwork = async (req, res) => {
  try {
    const { networkName, status } = req.body;
    const network = new Network({
      networkName: networkName,
      status: status,
    });
    network.save();

    return res.status(200).json({
      status: true,
      message: "ok",
      userResponse: `${networkName} added`,
    });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.getStage = async (req, res) => {
  try {
    const { inscriptionId } = req.body;
    const type = getType(inscriptionId);
    let inscription;
    if (type === "single") {
      inscription = await Inscription.findOne({ id: inscriptionId });
    } else if (type === "bulk") {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
    }

    if (inscription.stage === "stage 1")
      return res.status(200).json({
        status: true,
        message: "File uploaded, waiting for payment",
        userResponse: inscription.stage,
      });
    if (inscription.stage === "stage 2")
      return res.status(200).json({
        status: true,
        message: "inscription UTXO(s) transaction awaiting confirmation",
        userResponse: inscription.stage,
      });
    if (inscription.stage === "stage 3")
      return res.status(200).json({
        status: true,
        message: "inscription complete",
        userResponse: inscription.stage,
      });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
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
      const inscriptionCost = inscriptionPrice(feeRate, compImage.sizeOut);

      const payDetails = await createLegacyAddress(networkName, count.length);
      let paymentAddress = payDetails.p2pkh_addr;

      const walletKey = await addWalletToOrd(inscriptionId, networkName);
      const blockHeight = await axios.post(
        process.env.ORD_API_URL + `/ord/getLatestBlock`
      );
      if (blockHeight.data.message !== `ok`) {
        return res.status(200).json({ message: blockHeight.data.message });
      }
      const inscription = new Inscription({
        id: inscriptionId,
        inscribed: false,
        feeRate: feeRate,
        encryptedPassKey: enKey,

        inscriptionDetails: {
          imageSizeIn: compImage.sizeIn / 1e3,
          imageSizeOut: compImage.sizeOut / 1e3,
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
        stage: "stage 1",
      });

      const savedInscription = await inscription.save();
      const ids = new Ids({
        id: savedInscription._id,
        type: "single",
        startTime: Date.now(),
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
      const compImage = await compressAndSave(fileName, false);
      const inscriptionCost = inscriptionPrice(feeRate, file.size);

      const payDetails = await createLegacyAddress(networkName, count.length);
      let paymentAddress = payDetails.p2pkh_addr;

      const walletKey = await addWalletToOrd(inscriptionId, networkName);
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
          cid: compImage.cid,
        },
        walletDetails: {
          keyPhrase: walletKey,
          walletName: inscriptionId,
          creationBlock: blockHeight.data.userResponse.data,
        },
        cost: inscriptionCost,
        feeRate: feeRate,
        stage: "stage 1",
      });

      const savedInscription = await inscription.save();
      const ids = new Ids({
        id: savedInscription._id,
        type: "single",
        startTime: Date.now(),
      });
      await ids.save();

      return {
        compImage,
        inscriptionCost,
        paymentAddress,
        passKey,
        inscriptionId,
      };
    }
  } catch (e) {
    console.log(e.message);
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
    const serviceCharge = parseInt(process.env.SERVICE_CHARGE) * files.length;
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
    const cardinals = costPerInscription.inscriptionCost;
    const sizeFee = costPerInscription.sizeFee * files.length;
    const payDetails = await createLegacyAddress(networkName, count.length);
    let paymentAddress = payDetails.p2pkh_addr;

    const walletKey = await addWalletToOrd(inscriptionId, networkName);
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
        costPerInscription: costPerInscription,
        total: totalCost,
        cardinal: cardinals * files.length,
      },
      walletDetails: {
        keyPhrase: walletKey,
        walletName: inscriptionId,
        creationBlock: blockHeight.data.userResponse.data,
      },
      stage: "stage 1",
    });

    const savedInscription = await bulkInscription.save();

    const ids = new Ids({
      id: savedInscription._id,
      type: "bulk",
      startTime: Date.now(),
    });
    await ids.save();

    return {
      data: data,
      cardinals: cardinals * files.length,
      totalCost: totalCost,
      sizeFee: sizeFee,
      serviceCharge: serviceCharge,
      paymentAddress: paymentAddress,
      passKey: passKey,
      inscriptionId: inscriptionId,
    };
  } catch (e) {
    console.log(e);
  }
};

const inscriptionPrice = (feeRate, fileSize) => {
  const serviceCharge = parseInt(process.env.SERVICE_CHARGE);
  const sats = Math.ceil((fileSize / 4) * feeRate);
  const cost = sats + 1e3 + 550;
  const sizeFee = cost.toString().substring(0, cost.toString().length - 1);
  const total = serviceCharge + cost + parseInt(sizeFee);
  return {
    serviceCharge,
    inscriptionCost: cost,
    sizeFee: parseInt(sizeFee),
    postageFee: 550,
    total: total,
  };
};

const getInscriptionCost = async (file, feeRate, optimize) => {
  try {
    let inscriptionCost;
    let compImage;
    let sizeIn;
    let sizeOut;
    let compPercentage;
    const fileName = new Date().getTime().toString() + path.extname(file.name);
    const savePath = path.join(
      process.cwd(),
      "src",
      "img",
      "uncompressed",
      fileName
    );
    await file.mv(savePath);
    if (optimize === "true") {
      compImage = await compressImage(fileName);
      inscriptionCost = inscriptionPrice(feeRate, compImage.sizeOut);
      sizeIn = file.size / 1e3;
      sizeOut = compImage.sizeOut / 1e3;
      compPercentage = compImage.comPercentage;
      unlinkSync(compImage.outPath);
      return {
        compImage: {
          sizeIn,
          sizeOut,
          compPercentage,
        },
        inscriptionCost: inscriptionCost,
      };
    } else if (optimize === "false") {
      inscriptionCost = inscriptionPrice(feeRate, file.size);
      unlinkSync(savePath);
      return {
        compImage: {
          sizeOut: file.size / 1e3,
        },
        inscriptionCost: inscriptionCost,
      };
    }
  } catch (e) {
    console.log(e);
  }
};

const getBulkInscriptionCost = async (files, feeRate, optimize) => {
  try {
    let id = uuidv4();
    if (!existsSync(process.cwd() + `/src/bulk/${id}`)) {
      mkdirSync(
        process.cwd() + `./src/bulk/${id}`,
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
        `${id}`,
        fileName
      );
      await file.mv(savePath);
    });
    const data = await compressBulk(id, optimize);

    const inscriptionCost = inscriptionPrice(feeRate, data.largestFile);
    const total = inscriptionCost.total * files.length;

    return { fileSize: data.largestFile / 1e3, total: total };
  } catch (e) {
    console.log(e.message);
  }
};

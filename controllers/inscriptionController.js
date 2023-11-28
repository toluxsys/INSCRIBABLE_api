/* eslint-disable prettier/prettier */
const { existsSync } = require('fs');
const axios = require('axios');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv').config();
const Inscription = require('../model/inscription');
const Network = require('../model/network');
const BulkInscription = require('../model/bulkInscription');
const SpecialSat = require('../model/specialSats');
const UserReward = require('../model/userReward');
const Task = require('../model/task');
const { checkPayment } = require('../helpers/inscriptionHelper.js');
const { inscribe } = require('../helpers/inscriptionHelper');
const {
  compressImage,
  compressAndSave,
  compressAndSaveS3,
  compressAndSaveBulkS3,
  compressAndSaveBulk,
  compressBulk,
  saveFile,
  saveFileS3,
} = require('../helpers/imageHelper');
const { addWalletToOrd, verifyAddress } = require('../helpers/walletHelper');
const { getRecomendedFee } = require('../helpers/sendBitcoin');
const { getType } = require('../helpers/getType');
const { btcToUsd, usdToSat } = require('../helpers/btcToUsd');

const imageMimetype = [`image/png`, `image/gif`, `image/jpeg`, `image/webp`];

const writeFile = (path, data) => {
  try {
    if (!existsSync(`${process.cwd()}/build/files/`)) {
      fs.mkdirSync(
        `${process.cwd()}/build/files/`,
        { recursive: true },
        (err) => {
          console.log(err);
        },
      );
    }

    fs.writeFileSync(path, data, (err) => {
      console.log(err.message);
    });
  } catch (e) {
    console.log(e.message);
  }
};

module.exports.inscribeText = async (req, res) => {
  try {
    const { textBody, feeRate, receiveAddress, networkName, oldSats, usePoints } = req.body;
    let hasReward;
    const task = await Task.findOne({ taskName: 'inscribe' });
    const inscriptionPoint = task.taskPoints;
    const inscriptionId = `s${uuidv4()}`;
    let ORD_API_URL;
    const fileName = `${inscriptionId}_${new Date().getTime().toString()}.txt`;
    let walletKey = '';
    let paymentAddress;
    const s3 = false;
    if (verifyAddress(receiveAddress, networkName) === false)
      return res
        .status(200)
        .json({ status: false, message: 'Invalid address' });
   
    const userReward = await UserReward.findOne({ address: receiveAddress });
    if (!userReward) {
      hasReward = false;
    } else if (usePoints !== undefined && usePoints === 'true') {
      if (userReward.totalPoints < inscriptionPoint) {
        hasReward = false;
      } else {
        hasReward = true;
      }
    } else {
      hasReward = false;
    }

    if (networkName === 'mainnet')
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === 'testnet')
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    const path = `./build/files/${fileName}`;

    writeFile(path, textBody);
    let fileDetail;
    let inscriptionCost;

    if (oldSats !== 'random') {
      fileDetail = await saveFile(fileName);
      inscriptionCost = await inscriptionPrice(
        feeRate,
        fileDetail.size,
        oldSats,
        hasReward
      );
      const url = `${process.env.ORD_SAT_API_URL}/ord/create/getMultipleReceiveAddr`;
      const data = {
        collectionName: 'oldSatsWallet',
        addrCount: 1,
        networkName,
      };
      const result = await axios.post(url, data);
      if (result.data.message !== 'ok') {
        return res
          .status(200)
          .json({ status: false, message: result.data.message });
      }
      paymentAddress = result.data.userResponse.data[0];
    } else {
      fileDetail = await saveFile(fileName);
      inscriptionCost = await inscriptionPrice(
        feeRate,
        fileDetail.size,
        oldSats,
        hasReward
      );
      walletKey = await addWalletToOrd(inscriptionId, networkName);
      const url = `${ORD_API_URL}/ord/create/getMultipleReceiveAddr`;
      const data = {
        collectionName: inscriptionId,
        addrCount: 1,
        networkName,
      };
      const result = await axios.post(url, data);
      if (result.data.message !== 'ok') {
        return res
          .status(200)
          .json({ status: false, message: result.data.message });
      }
      paymentAddress = result.data.userResponse.data[0];
    }
    const inscription = new Inscription({
      id: inscriptionId,
      flag: networkName,
      inscribed: false,
      feeRate,
      receiver: receiveAddress,
      inscriptionType: 'text',
      sat: oldSats,
      usePoints: hasReward,
      s3,

      inscriptionDetails: {
        fileName,
        payAddress: paymentAddress,
        cid: fileDetail.cid,
      },
      walletDetails: {
        keyPhrase: walletKey,
        walletName: inscriptionId,
      },
      cost: inscriptionCost,
      stage: 'stage 1',
    });

    await inscription.save();

    res.status(200).json({
      status: true,
      message: 'ok',
      userResponse: {
        cost: inscriptionCost,
        paymentAddress,
        inscriptionId,
      },
    });
  } catch (e) {
    console.log(e.message);
    if (e.request)
      return res.status(200).json({ status: false, message: e.message });
    if (e.response)
      return res.status(200).json({ status: false, message: e.response.data });
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.brc20 = async (req, res) => {
  try {
    const {
      tick,
      maxSupply,
      limit,
      method,
      amount,
      feeRate,
      receiveAddress,
      networkName,
      oldSats,
      usePoints
    } = req.body;
    let hasReward
    const task = await Task.findOne({ taskName: 'inscribe' });
    const inscriptionPoint = task.taskPoints;
    const inscriptionId = `s${uuidv4()}`;
    let ORD_API_URL;
    const fileName = `${inscriptionId}_${new Date().getTime().toString()}.txt`;
    let walletKey = '';
    let paymentAddress;
    const s3 = false;
    if (verifyAddress(receiveAddress, networkName) === false)
      return res
        .status(200)
        .json({ status: false, message: 'Invalid address' });

    const userReward = await UserReward.findOne({ address: receiveAddress });
    if (!userReward) {
      hasReward = false;
    } else if (usePoints !== undefined && usePoints === 'true') {
      if (userReward.totalPoints < inscriptionPoint) {
        hasReward = false;
      } else {
        hasReward = true;
      }
    } else {
      hasReward = false;
    }
    if (networkName === 'mainnet')
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === 'testnet')
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;
    let data;
    const s_path = `./build/files/${fileName}`;

    if (method === 'deploy') {
      data = {
        p: 'brc-20',
        op: 'deploy',
        tick,
        max: maxSupply,
        lim: limit,
      };
    }

    if (method === 'mint') {
      data = {
        p: 'brc-20',
        op: 'mint',
        tick,
        amt: amount,
      };
    }
    const s_data = JSON.stringify(data).toString();
    writeFile(s_path, s_data);
    let fileDetail;
    let inscriptionCost;
    if (oldSats !== 'random') {
      fileDetail = await saveFile(fileName);
      inscriptionCost = await inscriptionPrice(
        feeRate,
        fileDetail.size,
        oldSats,
        hasReward
      );

      const url = `${process.env.ORD_SAT_API_URL}/ord/create/getMultipleReceiveAddr`;
      const data = {
        collectionName: 'oldSatsWallet',
        addrCount: 1,
        networkName,
      };
      const result = await axios.post(url, data);
      if (result.data.message !== 'ok') {
        return res
          .status(200)
          .json({ status: false, message: result.data.message });
      }
      paymentAddress = result.data.userResponse.data[0];
    } else {
      fileDetail = await saveFile(fileName);
      inscriptionCost = await inscriptionPrice(
        feeRate,
        fileDetail.size,
        oldSats,
        hasReward
      );
      walletKey = await addWalletToOrd(inscriptionId, networkName);
      const url = `${ORD_API_URL}/ord/create/getMultipleReceiveAddr`;
      const data = {
        collectionName: inscriptionId,
        addrCount: 1,
        networkName,
      };
      const result = await axios.post(url, data);
      if (result.data.message !== 'ok') {
        return res
          .status(200)
          .json({ status: false, message: result.data.message });
      }
      paymentAddress = result.data.userResponse.data[0];
    }
    const inscription = new Inscription({
      id: inscriptionId,
      flag: networkName,
      inscribed: false,
      feeRate,
      receiver: receiveAddress,
      inscriptionType: 'brc20',
      sat: oldSats,
      usePoints: hasReward,
      s3,

      inscriptionDetails: {
        fileName,
        payAddress: paymentAddress,
        cid: fileDetail.cid,
      },
      walletDetails: {
        keyPhrase: walletKey,
        walletName: inscriptionId,
      },
      cost: inscriptionCost,
      stage: 'stage 1',
    });

    await inscription.save();

    res.status(200).json({
      status: true,
      message: 'ok',
      userResponse: {
        cost: inscriptionCost,
        paymentAddress,
        inscriptionId,
      },
    });
  } catch (e) {
    console.log(e.message);
    if (e.request)
      return res.status(200).json({ status: false, message: e.message });
    if (e.response)
      return res.status(200).json({ status: false, message: e.response.data });
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.satNames = async (req, res) => {
  try {
    const { name, feeRate, receiveAddress, networkName, oldSats, usePoints } = req.body;
    let hasReward
    const task = await Task.findOne({ taskName: 'inscribe' });
    const inscriptionPoint = task.taskPoints;
    const inscriptionId = `s${uuidv4()}`;
    let ORD_API_URL;
    const fileName = `${inscriptionId}_${new Date().getTime().toString()}.txt`;
    let walletKey = '';
    let paymentAddress;
    const s3 = false;
    if (verifyAddress(receiveAddress, networkName) === false)
      return res
        .status(200)
        .json({ status: false, message: 'Invalid address' });
    const userReward = await UserReward.findOne({ address: receiveAddress });
    if (!userReward) {
      hasReward = false;
    } else if (usePoints !== undefined && usePoints === 'true') {
      if (userReward.totalPoints < inscriptionPoint) {
        hasReward = false;
      } else {
        hasReward = true;
      }
    } else {
      hasReward = false;
    }
    if (networkName === 'mainnet')
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === 'testnet')
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;
    const s_path = `./build/files/${fileName}`;

    if (name.split('').includes('.')) {
      return res.status(200).json({
        status: false,
        message: `${name} your name can not contain "."`,
      });
    }
    // let verifyName = await verifySats(name + ".sats");
    // if(!verifyName) return res.status(200).json({status: false, message: `${name} already exists`});

    const data = {
      p: 'sns',
      op: 'reg',
      name: `${name}.sats`,
    };

    const s_data = JSON.stringify(data).toString();
    writeFile(s_path, s_data);
    let fileDetail;
    let inscriptionCost;

    if (oldSats !== 'random') {
      fileDetail = await saveFile(fileName);
      inscriptionCost = await inscriptionPrice(
        feeRate,
        fileDetail.size,
        oldSats,
        hasReward
      );
      const url = `${process.env.ORD_SAT_API_URL}/ord/create/getMultipleReceiveAddr`;
      const data = {
        collectionName: 'oldSatsWallet',
        addrCount: 1,
        networkName,
      };
      const result = await axios.post(url, data);
      if (result.data.message !== 'ok') {
        return res
          .status(200)
          .json({ status: false, message: result.data.message });
      }
      paymentAddress = result.data.userResponse.data[0];
    } else {
      fileDetail = await saveFile(fileName);
      inscriptionCost = await inscriptionPrice(
        feeRate,
        fileDetail.size,
        oldSats,
        hasReward
      );
      walletKey = await addWalletToOrd(inscriptionId, networkName);
      const url = `${ORD_API_URL}/ord/create/getMultipleReceiveAddr`;
      const data = {
        collectionName: inscriptionId,
        addrCount: 1,
        networkName,
      };
      const result = await axios.post(url, data);
      if (result.data.message !== 'ok') {
        return res
          .status(200)
          .json({ status: false, message: result.data.message });
      }
      paymentAddress = result.data.userResponse.data[0];
    }
    const inscription = new Inscription({
      id: inscriptionId,
      flag: networkName,
      inscribed: false,
      feeRate,
      receiver: receiveAddress,
      inscriptionType: 'sns',
      sat: oldSats,
      usePoints: hasReward,
      s3,

      inscriptionDetails: {
        fileName,
        payAddress: paymentAddress,
        cid: fileDetail.cid,
      },
      walletDetails: {
        keyPhrase: walletKey,
        walletName: inscriptionId,
      },
      cost: inscriptionCost,
      stage: 'stage 1',
    });

    await inscription.save();

    res.status(200).json({
      status: true,
      message: 'ok',
      userResponse: {
        cost: inscriptionCost,
        paymentAddress,
        inscriptionId,
      },
    });
  } catch (e) {
    console.log(e);
    if (e.request)
      return res.status(200).json({ status: false, message: e.message });
    if (e.response)
      return res.status(200).json({ status: false, message: e.response.data });
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.upload = async (req, res) => {
  try {
    const file = req.files;
    const feeRate = parseInt(req.body.feeRate);
    const { networkName } = req.body;
    const { optimize } = req.body;
    const { receiveAddress } = req.body;
    const { oldSats } = req.body;
    const { usePoints } = req.body;
    let hasReward;

    // TODO: Remove hard coded vale and return from ENV or DB
    const task = await Task.findOne({ taskName: 'inscribe' });
    const inscriptionPoint = task.taskPoints;
    if (verifyAddress(receiveAddress, networkName) === false)
      return res
        .status(200)
        .json({ status: false, message: 'Invalid address' });
    const userReward = await UserReward.findOne({ address: receiveAddress });
    if (!userReward) {
      hasReward = false;
    } else if (usePoints !== undefined && usePoints === 'true') {
      if (userReward.totalPoints < inscriptionPoint) {
        hasReward = false;
      } else {
        hasReward = true;
      }
    } else {
      hasReward = false;
    }

    const details = await init(
      file,
      feeRate,
      networkName,
      optimize,
      receiveAddress,
      oldSats,
      hasReward,
    );
    if (details.reqError)
      return res.status(200).json({ status: false, message: details.reqError });
    if (details.resError)
      return res.status(200).json({ status: false, message: details.resError });

    return res.status(200).json({
      status: true,
      message: 'ok',
      userResponse: {
        compImage: details.compImage,
        cost: details.inscriptionCost,
        paymentAddress: details.paymentAddress,
        inscriptionId: details.inscriptionId,
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.uploadMultiple = async (req, res) => {
  try {
    const { files } = req;
    const feeRate = parseInt(req.body.feeRate);
    const { networkName } = req.body;
    const { optimize } = req.body;
    const { receiveAddress } = req.body;
    const { usePoints } = req.body;
    let hasReward;
    // TODO: Remove hard coded vale and return from ENV or DB
    const task = await Task.findOne({ taskName: 'inscribe' });
    const inscriptionPoint = task.taskPoints;
    if (verifyAddress(receiveAddress, networkName) === false)
      return res
        .status(200)
        .json({ status: false, message: 'Invalid address' });
    const userReward = await UserReward.findOne({ address: receiveAddress });
    if (!userReward) {
      hasReward = false;
    } else if (usePoints !== undefined && usePoints === 'true') {
      if (userReward.totalPoints < inscriptionPoint) {
        hasReward = false;
      } else {
        hasReward = true;
      }
    } else {
      hasReward = false;
    }
    if (files.length >= 20)
      return res
        .status(200)
        .json({ status: false, message: `file Upload Above Limit` });
    files.forEach((file) => {
      if (!imageMimetype.includes(file.mimetype) && optimize === `true`) {
        return res.status(200).json({
          status: false,
          message: `cannot optimaize ${file.mimetype}`,
        });
      }
    });
    const details = await initBulk(
      files,
      feeRate,
      networkName,
      optimize,
      receiveAddress,
      hasReward,
    );
    if (details.reqError)
      return res.status(200).json({ status: false, message: details.reqError });
    if (details.resError)
      return res.status(200).json({ status: false, message: details.resError });
    return res.status(200).json({
      status: true,
      message: 'ok',
      userResponse: {
        compImage: {
          compPercentage: '',
          sizeIn: '',
          sizeOut: '',
          cid: details.data.cid,
        },
        cost: {
          inscriptionCost: details.cardinals,
          postage: `550 X ${files.length}`,
          serviceCharge: details.serviceCharge,
          sizeFee: details.sizeFee,
          total: details.totalCost,
        },
        paymentAddress: details.paymentAddress,
        inscriptionId: details.inscriptionId,
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.inscribe1 = async (req, res) => {
  try {
    req.setTimeout(20000);
    const { id, networkName } = req.body;
    const result = await inscribe({
      inscriptionId: id,
      networkName,
    });
    if (result.status === false) {
      return res.status(200).json({
        status: result.status,
        message: result.message,
        userResponse: [],
      });
    }
    return res.status(200).json({
      status: result.status,
      message: result.message,
      userResponse: result.ids,
    });
  } catch (e) {
    console.log(e.message);
    if (e.request)
      return res.status(200).json({ status: false, message: e.message });
    if (e.response)
      return res.status(200).json({ status: false, message: e.response.data });
    console.log(e.response);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.sendInscription = async (req, res) => {
  try {
    const id = req.body.inscriptionId;
    const { inscriptions } = req.body; // inscriptions in an array of objects containing the inscription id to be sent and the receiver address;
    const { networkName } = req.body;
    const { feeRate } = req.body;
    let ORD_API_URL;

    if (networkName === 'mainnet')
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === 'testnet')
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    const result = await axios.post(`${ORD_API_URL}/ord/sendInscription`, {
      inscriptions,
      inscriptionId: id,
      networkName,
      feeRate,
    });

    if (result.data.message !== `ok`) {
      return res
        .status(200)
        .json({ status: false, message: result.data.message });
    }

    return res.status(200).json({
      status: true,
      message: 'inscription sent',
      txId: result.data.userResponse.data,
    });
  } catch (e) {
    console.log(e.message);
    if (e.request)
      return res.status(200).json({ status: false, message: e.message });
    if (e.response)
      return res.status(200).json({ status: false, message: e.response.data });
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getRecFee = async (req, res) => {
  try {
    const recomendedFee = await getRecomendedFee();
    return res.status(200).json({
      status: true,
      message: 'ok',
      fees: recomendedFee,
    });
  } catch (e) {
    console.log(e);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.inscriptionCalc = async (req, res) => {
  try {
    const file = req.files;
    const feeRate = parseInt(req.body.feeRate);
    const { optimize } = req.body;
    const { oldSats } = req.body;
    const { usePoints } = req.body;
    const { networkName } = req.body;
    const { receiveAddress } = req.body;
    let hasReward;
    // TOTO: Remove hard coded vale and return from ENV or DB
    const task = await Task.findOne({ taskName: 'inscribe' });
    const inscriptionPoint = task.taskPoints;
    if (verifyAddress(receiveAddress, networkName) === false)
      return res
        .status(200)
        .json({ status: false, message: 'Invalid address' });
    const userReward = await UserReward.findOne({ address: receiveAddress });
    if (!userReward) {
      hasReward = false;
    } else if (usePoints !== undefined && usePoints === 'true') {
      if (userReward.totalPoints < inscriptionPoint) {
        hasReward = false;
      } else {
        hasReward = true;
      }
    } else {
      hasReward = false;
    }
    const details = await getInscriptionCost(
      file,
      feeRate,
      optimize,
      oldSats,
      hasReward,
    );
    if (typeof details === `string`) {
      return res.status(200).json({ status: false, message: details });
    }
    return res.status(200).json({
      status: true,
      message: 'ok',
      details,
    });
  } catch (e) {
    console.log(e);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.bulkInscriptionCalc = async (req, res) => {
  try {
    const { files } = req;
    const feeRate = parseInt(req.body.feeRate);
    const { optimize } = req.body;
    const { receiveAddress } = req.body;
    const { networkName } = req.body;

    const { usePoints } = req.body;
    let hasReward;
    // TOTO: Remove hard coded vale and return from ENV or DB
    const task = await Task.findOne({ taskName: 'inscribe' });
    const inscriptionPoint = task.taskPoints * files.length;
    if (verifyAddress(receiveAddress, networkName) === false)
      return res
        .status(200)
        .json({ status: false, message: 'Invalid address' });
    const userReward = await UserReward.findOne({ address: receiveAddress });
    if (!userReward) {
      hasReward = false;
    } else if (usePoints !== undefined && usePoints === 'true') {
      if (userReward.totalPoints < inscriptionPoint) {
        hasReward = false;
      } else {
        hasReward = true;
      }
    } else {
      hasReward = false;
    }

    if (files.length >= 10)
      return res
        .status(200)
        .json({ status: false, message: `file Upload Above Limit` });
    // files.forEach((file) => {
    //   if (!imageMimetype.includes(file.mimetype) && optimize === `true`) return res.status(200).json({status:false, message: `cannot optimaize ${file.mimetype}`});
    // })
    const data = await getBulkInscriptionCost(
      files,
      feeRate,
      optimize,
      hasReward,
    );

    const details = {
      compImage: { compPercentage: '', sizeIn: '', sizeOut: '' },
      inscriptionCost: {
        inscriptionCost: data.costPerInscription.inscriptionCost * files.length,
        postageFee: `${data.costPerInscription.postageFee} X ${files.length}`,
        serviceCharge: data.costPerInscription.serviceCharge * files.length,
        sizeFee: data.costPerInscription.sizeFee * files.length,
        total: data.costPerInscription.total * files.length,
      },
    };
    return res.status(200).json({
      details,
      status: true,
      message: 'ok',
    });
  } catch (e) {
    console.log(e);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.checkPayments = async (req, res) => {
  try {
    const { inscriptionId, networkName } = req.body;
    const result = await checkPayment({ inscriptionId, networkName });
    if (result.status === true) {
      return res.status(200).json({
        status: true,
        message: result.message,
        userResponse: { ids: result.data.ids, txid: result.data.txid },
      });
    }
    if (!result.key)
      return res.status(200).json({
        status: false,
        message: result.message,
        userResponse: { ids: [], txid: result.data.txid },
      });
    return res.status(200).json({
      status: false,
      message: result.message,
      key: result.key,
      userResponse: { ids: [], txid: result.data.txid },
    });
  } catch (e) {
    console.log(e);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getNetwork = async (req, res) => {
  try {
    const networks = await Network.where('status').equals(`active`);
    const active = networks[0];
    return res
      .status(200)
      .json({ status: true, message: 'ok', userResponse: active.networkName });
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
      { new: true },
    );

    await Network.findOneAndUpdate(
      { networkName },
      { status: 'active' },
      { new: true },
    );
    return res.status(200).json({
      status: true,
      message: 'ok',
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
      networkName,
      status,
    });
    network.save();

    return res.status(200).json({
      status: true,
      message: 'ok',
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
    if (type === 'single') {
      inscription = await Inscription.findOne({ id: inscriptionId });
    } else if (type === 'bulk') {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
    } else {
      return {
        message: 'invalid Id',
        data: {
          ids: [],
          txid: '',
        },
        status: false,
        key: 'Invalid_id',
      };
    }

    if (inscription.stage === 'stage 1') {
      if (inscription.collectionId) {
        return res.status(200).json({
          status: true,
          type: 'collection',
          message: 'ok',
          userResponse: {
            stage: 1,
            endpoint: 'inscript',
            route: 'checkPayment',
            address: inscription.receiver,
            collectionId: inscription.collectionId,
          },
        });
      }
      return res.status(200).json({
        status: true,
        message: 'ok',
        userResponse: {
          stage: 1,
          endpoint: 'inscript',
          route: 'checkPayment',
          address: inscription.receiver,
        },
      });
    }

    if (inscription.stage === 'stage 2') {
      if (inscription.collectionId) {
        return res.status(200).json({
          status: true,
          message: 'ok',
          type: 'collection',
          userResponse: {
            stage: 2,
            endpoint: 'collection',
            route: 'inscribe',
            address: inscription.receiver,
            collectionId: inscription.collectionId,
          },
        });
      }
      return res.status(200).json({
        status: true,
        message: 'ok',
        userResponse: {
          stage: 2,
          endpoint: 'inscript',
          route: 'inscribe',
          address: inscription.receiver,
        },
      });
    }

    if (inscription.stage === 'stage 3') {
      if (inscription.collectionId) {
        return res.status(200).json({
          status: true,
          type: 'collection',
          message: 'ok',
          userResponse: {
            stage: 3,
            endpoint: 'collection',
            route: 'getInscriptions',
            address: inscription.receiver,
            collectionId: inscription.collectionId,
          },
        });
      }
      return res.status(200).json({
        status: true,
        message: 'ok',
        userResponse: {
          stage: 3,
          endpoint: 'inscript',
          route: 'getInscriptions',
          address: inscription.receiver,
        },
      });
    }
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.getInscriptions = async (req, res) => {
  try {
    const { inscriptionId } = req.body;
    const type = getType(inscriptionId);
    let inscription;
    if (type === 'single') {
      inscription = await Inscription.findOne({ id: inscriptionId });
    } else if (type === 'bulk') {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
    } else {
      return {
        message: 'invalid Id',
        data: {
          ids: [],
          txid: '',
        },
        status: false,
        key: 'Invalid_id',
      };
    }
    const allInscriptions = inscription.inscription;
    return res
      .status(200)
      .json({ status: true, message: `ok`, userResponse: allInscriptions });
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.getConversion = async (req, res) => {
  try {
    const { btcAmount, satAmount } = req.body;
    const satToBtc = parseFloat((satAmount / 1e8).toFixed(8));
    let conversion = 0;
    if (btcAmount !== undefined) conversion = await btcToUsd(btcAmount);
    if (satAmount !== undefined) conversion = await btcToUsd(satToBtc);

    return res
      .status(200)
      .json({ status: true, message: 'ok', userResponse: conversion });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.getOrderDetails = async (req, res) => {
  try {
    const { inscriptionId } = req.body;
    const type = getType(inscriptionId);
    let inscription;
    let data;
    if (type === 'single') {
      inscription = await Inscription.findOne({ id: inscriptionId });
      data = {
        cost: inscription.cost,
        inscriptionId,
        paymentAddress: inscription.inscriptionDetails.payAddress,
        receiverAddress: inscription.receiver,
        stage: inscription.stage,
      };
    } else if (type === 'bulk') {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
      const { totalAmount } = inscription.inscriptionDetails;
      const { costPerInscription } = inscription.cost;
      const costDetails = {
        serviceCharge: costPerInscription.serviceCharge * totalAmount,
        inscriptionCost: costPerInscription.inscriptionCost * totalAmount,
        sizeFee: costPerInscription.sizeFee * totalAmount,
        postageFee: costPerInscription.postageFee,
        total: costPerInscription.total * totalAmount,
      };
      data = {
        cost: costDetails,
        inscriptionId,
        paymentAddress: inscription.inscriptionDetails.payAddress,
        receiverAddress: inscription.receiver,
        stage: inscription.stage,
      };
    } else {
      return {
        message: 'invalid Id',
        data: {
          ids: [],
        },
        status: false,
        key: 'Invalid_id',
      };
    }

    return res
      .status(200)
      .json({ status: true, message: 'ok', userResponse: data });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

const init = async (
  file,
  feeRate,
  networkName,
  optimize,
  receiveAddress,
  satType,
  usePoints,
) => {
  try {
    const inscriptionId = `s${uuidv4()}`;
    let ORD_API_URL;
    let inscriptionCost;
    let paymentAddress;
    let walletKey = '';
    let _usePoints;

    if (usePoints === 'true') {
      _usePoints = true;
    } else {
      _usePoints = false;
    }

    if (networkName === 'mainnet')
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === 'testnet')
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    let optData;
    if (optimize === `true`) {
      optData = true;
    } else {
      optData = false;
    }

    const fileName = file[0].filename;
    const compImage = await compressAndSave(file, optData);
    if (satType !== 'random') {
      inscriptionCost = await inscriptionPrice(
        feeRate,
        compImage.sizeOut,
        satType,
        _usePoints,
      );
      const url = `${process.env.ORD_SAT_API_URL}/ord/create/getMultipleReceiveAddr`;
      const data = {
        collectionName: 'oldSatsWallet',
        addrCount: 1,
        networkName,
      };
      const result = await axios.post(url, data);
      if (result.data.message !== 'ok') {
        return {
          compImage: [],
          inscriptionCost: '',
          paymentAddress: '',
          inscriptionId: '',
        };
      }
      paymentAddress = result.data.userResponse.data[0];
    } else {
      inscriptionCost = await inscriptionPrice(
        feeRate,
        compImage.sizeOut,
        satType,
        _usePoints,
      );
      walletKey = await addWalletToOrd(inscriptionId, networkName);
      const url = `${ORD_API_URL}/ord/create/getMultipleReceiveAddr`;
      const data = {
        collectionName: inscriptionId,
        addrCount: 1,
        networkName,
      };
      const result = await axios.post(url, data);
      if (result.data.message !== 'ok') {
        return {
          compImage: [],
          inscriptionCost: '',
          paymentAddress: '',
          inscriptionId: '',
        };
      }
      paymentAddress = result.data.userResponse.data[0];
    }

    const inscription = new Inscription({
      id: inscriptionId,
      flag: networkName,
      inscribed: false,
      feeRate,
      sat: satType,
      s3: false,
      usePoints: _usePoints,

      inscriptionDetails: {
        imageSizeIn: file[0].size / 1e3,
        imageSizeOut: compImage.sizeOut / 1e3,
        fileName,
        comPercentage: compImage.comPercentage,
        payAddress: paymentAddress,
        cid: compImage.cid,
      },
      walletDetails: {
        keyPhrase: walletKey,
        walletName: inscriptionId,
      },
      cost: inscriptionCost,
      receiver: receiveAddress,
      stage: 'stage 1',
    });

    await inscription.save();

    return {
      compImage,
      inscriptionCost,
      paymentAddress,
      inscriptionId,
    };
  } catch (e) {
    console.log(e);
    if (e.request) return { reqError: e.message };
    if (e.response) return { resError: e.response.data };
  }
};

const initBulk = async (
  file,
  feeRate,
  networkName,
  optimize,
  receiveAddress,
  usePoints,
) => {
  try {
    const inscriptionId = `b${uuidv4()}`;
    const serviceCharge = parseInt(process.env.SERVICE_CHARGE) * file.length;
    let optimized;

    let ORD_API_URL;

    if (networkName === 'mainnet')
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === 'testnet')
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    if (optimize === `true`) {
      optimized = true;
    } else {
      optimized = false;
    }

    let _usePoints;

    if (usePoints === 'true') {
      _usePoints = true;
    } else {
      _usePoints = false;
    }

    const data = await compressAndSaveBulk(file, inscriptionId, optimized);
    const fileNames = data.compData.map(
      (x) => x.outPath.split('/')[x.outPath.split('/').length - 1],
    );

    const costPerInscription = await inscriptionPrice(
      feeRate,
      data.largestFile,
      'random',
      _usePoints,
    );
    const totalCost = costPerInscription.total * file.length;
    const cardinals = costPerInscription.inscriptionCost;
    const sizeFee = costPerInscription.sizeFee * file.length;

    const walletKey = await addWalletToOrd(inscriptionId, networkName);
    const url = `${ORD_API_URL}/ord/create/getMultipleReceiveAddr`;
    const r_data = {
      collectionName: inscriptionId,
      addrCount: 1,
      networkName,
    };
    const result = await axios.post(url, r_data);
    if (result.data.message !== 'ok') {
      return {
        compImage: [],
        inscriptionCost: '',
        paymentAddress: '',
        inscriptionId: '',
      };
    }
    const paymentAddress = result.data.userResponse.data[0];
    const bulkInscription = new BulkInscription({
      id: inscriptionId,
      flag: networkName,
      inscribed: false,
      feeRate,
      receiver: receiveAddress,
      fileNames,
      s3: false,
      usePoints,

      inscriptionDetails: {
        largestFile: data.largestFile,
        totalAmount: file.length,
        payAddress: paymentAddress,
        cid: data.cid,
      },
      cost: {
        costPerInscription,
        total: totalCost,
        cardinal: cardinals * file.length,
      },
      walletDetails: {
        keyPhrase: walletKey,
        walletName: inscriptionId,
      },
      stage: 'stage 1',
    });

    await bulkInscription.save();

    return {
      data,
      cardinals: cardinals * file.length,
      totalCost,
      sizeFee,
      serviceCharge,
      paymentAddress,
      inscriptionId,
    };
  } catch (e) {
    console.log(e.message);
    if (e.request) return { reqError: e.message };
    if (e.response) return { resError: e.response.data };
  }
};

const getSatPrices = async () => {
  try {
    const price = (await SpecialSat.find({})).map((sat) => ({
      satType: sat.satType,
      price: sat.price,
    }));

    return price;
  } catch (e) {
    console.log(e.message);
  }
};

const getSatCost = async (type) => {
  try {
    const sats = await getSatPrices();
    let price = 0;
    sats.forEach((x) => {
      if (x.satType === type) {
        price = x.price;
      }
    });
    const res = await usdToSat(price);
    // convert usd to sat
    return res.satoshi;
  } catch (e) {
    console.log(e.message);
  }
};

const inscriptionPrice = async (feeRate, fileSize, satType, usePoints) => {
  try {
    let serviceCharge = parseInt(process.env.SERVICE_CHARGE);
    const sats = Math.ceil((fileSize / 4) * feeRate);
    const cost = sats + 1500 + 550 + 2000;
    let sizeFee = Math.ceil(300 * feeRate + (sats / 10));
    let satCost = 0;
    if (sizeFee < 1024) {
      sizeFee = 1024;
    }
    if (satType !== 'random') {
      satCost = await getSatCost(satType);
    }

    if (usePoints === true) {
      serviceCharge = 1000;
      // cost = cost + 1000
    }

    const total = serviceCharge + cost + sizeFee + satCost;
    return {
      serviceCharge,
      inscriptionCost: cost + sizeFee,
      sizeFee,
      satCost,
      postageFee: 550,
      total,
    };
  } catch (e) {
    console.log(e.message);
  }
};

const getInscriptionCost = async (
  file,
  feeRate,
  optimize,
  satType,
  usePoints,
) => {
  try {
    let optData;
    if (optimize === 'true') {
      optData = true;
    } else {
      optData = false;
    }

    const compImage = await compressImage(file, optData);
    const inscriptionCost = await inscriptionPrice(
      feeRate,
      compImage.sizeOut,
      satType,
      usePoints,
    );
    const sizeIn = compImage.sizeIn / 1e3;
    const sizeOut = compImage.sizeOut / 1e3;
    const compPercentage = compImage.comPercentage;
    return {
      compImage: {
        sizeIn,
        sizeOut,
        compPercentage,
      },
      inscriptionCost,
    };
  } catch (e) {
    console.log(e);
  }
};

const getBulkInscriptionCost = async (files, feeRate, optimize, usePoints) => {
  try {
    const data = await compressBulk(files, optimize);
    const inscriptionCost = await inscriptionPrice(
      feeRate,
      data.largestFile,
      'random',
      usePoints,
    );
    const total = inscriptionCost.total * files.length;

    const compData = data.compData.map((x) => ({
      sizeIn: x.sizeIn,
      sizeOut: x.sizeOut,
      compPercentage: x.comPercentage,
    }));
    return {
      fileSize: data.largestFile / 1e3,
      total,
      costPerInscription: inscriptionCost,
      compData,
    };
  } catch (e) {
    console.log(e.message);
  }
};

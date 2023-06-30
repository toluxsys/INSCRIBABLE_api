const { unlinkSync, rmSync, existsSync, mkdirSync } = require("fs");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv").config();
const Inscription = require("../model/inscription");
const Network = require("../model/network");
const Ids = require("../model/ids");
const PayIds = require("../model/paymentIds");
const SelectedItems = require("../model/selectedItems");
const PayLink = require("../model/paymentLink");
const BulkInscription = require("../model/bulkInscription");
const Collection = require("../model/collection");
const Sats = require("../model/sats");
const ObjectId = require('mongoose').Types.ObjectId; 
const verifySats = require("../helpers/satNameHelper");
const {
  compressImage,
  compressAndSave,
  compressAndSaveBulk,
  compressAndSaveS3,
  compressAndSaveBulkS3,
  compressBulk,
  saveFile,
  saveFileS3,
} = require("../helpers/imageHelper");
const {
  createHDWallet,
  addWalletToOrd,
  utxoDetails,
  verifyAddress,
} = require("../helpers/walletHelper");
const {
  getRecomendedFee,
  getWalletBalance,
  getSpendUtxo
} = require("../helpers/sendBitcoin");

const {
  sendBitcoin,
  createLegacyAddress,
  createTaprootAddress,
  createLegacyPayLinkAddress,
} = require("../helpers/sendBitcoin2");
const { getType } = require("../helpers/getType");
const { btcToUsd } = require("../helpers/btcToUsd");
const { get } = require("http");

const imageMimetype = [`image/png`, `image/gif`, `image/jpeg`, `image/svg`, `image/svg+xml`];

const writeFile = (path, data) => {
  try {
      if(!existsSync(process.cwd()+`/build/files/`)) {
      fs.mkdirSync(
        process.cwd()+`/build/files/`,
        { recursive: true },
        (err) => {
          console.log(err);
        }
      );
    }

    fs.writeFileSync(path, data, (err) => {
      console.log(err.message);
    })
  } catch (e) {
    console.log(e.message);
  }
}

module.exports.inscribeText = async (req, res) => {
  try{
    const {textBody, feeRate, receiveAddress,  networkName, oldSats} = req.body;
    const id = await import("nanoid");
    const nanoid = id.customAlphabet(process.env.NANO_ID_SEED);
    const inscriptionId = `s${uuidv4()}`;
    let ORD_API_URL;
    const fileName = new Date().getTime().toString() + `.txt`;
    let walletKey = "";
    let paymentAddress;
    let satsId;
    s3 = false;
    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"})

    if (networkName === "mainnet")
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;
  
    let path = `./build/files/${fileName}`;
    
    writeFile(path, textBody);
    let fileDetail;
    let inscriptionCost;

    if(oldSats === `true`){
      fileDetail = await saveFile(fileName);
      inscriptionCost = inscriptionPrice(feeRate, fileDetail.size);
      let sats = await Sats.findOne({_id: new ObjectId(process.env.OLD_SATS_ID)});
      if(!sats) return res.status(200).json({status: false, message: "No 2009 sats available"});
      if(sats.count >= sats.size) return res.status(200).json({status: false, message: "sat range exusted"});
      satsId = sats._id;
    
      const url = process.env.ORD_SAT_API_URL + `/ord/create/getMultipleReceiveAddr`;
      const data = {
        collectionName: "oldSatsWallet",
        addrCount: 1,
        networkName: networkName,
      };
      const result = await axios.post(url, data);
      if (result.data.message !== "ok") {
        return res.status(200).json({status: false, message: result.data.message});
      }
      paymentAddress = result.data.userResponse.data[0];
    }else {
      fileDetail = await saveFileS3(fileName);
      inscriptionCost = inscriptionPrice(feeRate, fileDetail.size);
      s3 = true;
      walletKey = await addWalletToOrd(inscriptionId, networkName);
      const url = ORD_API_URL + `/ord/create/getMultipleReceiveAddr`;
      const data = {
        collectionName: inscriptionId,
        addrCount: 1,
        networkName: networkName,
      };
      const result = await axios.post(url, data);
      if (result.data.message !== "ok") {
        return res.status(200).json({status: false, message: result.data.message});
      }
      paymentAddress = result.data.userResponse.data[0];
    }
    const inscription = new Inscription({
      id: inscriptionId,
      flag: networkName,
      inscribed: false,
      feeRate: feeRate,
      receiver: receiveAddress,
      inscriptionType: "text",
      sat: satsId,
      s3: s3,

      inscriptionDetails: {
        fileName: fileName,
        payAddress: paymentAddress,
        cid: fileDetail.cid,
      },
      walletDetails: {
        keyPhrase: walletKey,
        walletName: inscriptionId,
      },
      cost: inscriptionCost,
      feeRate: feeRate,
      stage: "stage 1",
    });

    await inscription.save();
   
    res.status(200).json({
      status: true,
      message: "ok",
      userResponse: {
        cost: inscriptionCost,
        paymentAddress: paymentAddress,
        inscriptionId: inscriptionId,
      },
    });
  } catch (e){
    console.log(e.message);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
  }
}

module.exports.brc20 = async (req, res) => {
  try{
    const {tick, maxSupply, limit, method, amount, feeRate, receiveAddress,  networkName, oldSats} = req.body;
    const id = await import("nanoid");
    const nanoid = id.customAlphabet(process.env.NANO_ID_SEED);
    const inscriptionId = `s${uuidv4()}`;
    let ORD_API_URL;
    const fileName = new Date().getTime().toString() +`.txt`;
    let walletKey = "";
    let paymentAddress;
    let satsId;
    let s3 = false;
    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"})

    if (networkName === "mainnet")
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;
    let data;
    let s_path = `./build/files/${fileName}`;
    
    if (method === "deploy") {
      data = {
        p: "brc-20",
        op: "deploy",
        tick: tick,
        max: maxSupply,
        lim: limit
      }
    }

    if (method === "mint"){
      data = {
        p: "brc-20",
        op: "mint",
        tick: tick,
        amt: amount
      }
    }
    let s_data = JSON.stringify(data).toString();
    writeFile(s_path, s_data);
    let fileDetail;
    let inscriptionCost;
    if(oldSats === `true`){
      fileDetail = await saveFile(fileName);
      inscriptionCost = inscriptionPrice(feeRate, fileDetail.size);
      let sats = await Sats.findOne({_id: new ObjectId(process.env.OLD_SATS_ID)});
      if(!sats) return res.status(200).json({status: false, message: "No 2009 sats available"});
      if(sats.count >= sats.size) return res.status(200).json({status: false, message: "sat range exusted"});
      satsId = sats._id;
    
      const url = process.env.ORD_SAT_API_URL + `/ord/create/getMultipleReceiveAddr`;
      const data = {
        collectionName: "oldSatsWallet",
        addrCount: 1,
        networkName: networkName,
      };
      const result = await axios.post(url, data);
      if (result.data.message !== "ok") {
        return res.status(200).json({status: false, message: result.data.message});
      }
      paymentAddress = result.data.userResponse.data[0];
    }else {
      fileDetail = await saveFileS3(fileName);
      inscriptionCost = inscriptionPrice(feeRate, fileDetail.size);
      s3 = true;
      walletKey = await addWalletToOrd(inscriptionId, networkName);
      const url = ORD_API_URL + `/ord/create/getMultipleReceiveAddr`;
      const data = {
        collectionName: inscriptionId,
        addrCount: 1,
        networkName: networkName,
      };
      const result = await axios.post(url, data);
      if (result.data.message !== "ok") {
        return res.status(200).json({status: false, message: result.data.message});
      }
      paymentAddress = result.data.userResponse.data[0];
    }
    const inscription = new Inscription({
      id: inscriptionId,
      flag: networkName,
      inscribed: false,
      feeRate: feeRate,
      receiver: receiveAddress,
      inscriptionType: "brc20",
      sat: satsId,
      s3: s3,

      inscriptionDetails: {
        fileName: fileName,
        payAddress: paymentAddress,
        cid: fileDetail.cid,
      },
      walletDetails: {
        keyPhrase: walletKey,
        walletName: inscriptionId,
      },
      cost: inscriptionCost,
      feeRate: feeRate,
      stage: "stage 1",
    });

    await inscription.save();

    res.status(200).json({
      status: true,
      message: "ok",
      userResponse: {
        cost: inscriptionCost,
        paymentAddress: paymentAddress,
        inscriptionId: inscriptionId,
      },
    });
  } catch (e){
    console.log(e.message);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
  }
}

module.exports.satNames = async (req, res) => {
  try{
    const {name,feeRate, receiveAddress, networkName, oldSats} = req.body;
    const id = await import("nanoid");
    const nanoid = id.customAlphabet(process.env.NANO_ID_SEED);
    const inscriptionId = `s${uuidv4()}`;
    let ORD_API_URL;
    const fileName = new Date().getTime().toString() +`.txt`;
    let walletKey = "";
    let paymentAddress;
    let satsId;
    let s3 = false;
    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"})

    if (networkName === "mainnet")
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;
    let data;
    let s_path = `./build/files/${fileName}`;

    if(name.split("").includes(".")){
      return res.status(200).json({status: false, message: `${name} contains unsupported character`});
    }
    let verifyName = await verifySats(name + ".sats");
    if(!verifyName) return res.status(200).json({status: false, message: `${name} already exists`});
    
    data = {
      p: "sns",
      op: "reg",
      name: name + `.sats`
    }
    
    let s_data = JSON.stringify(data).toString();
    writeFile(s_path, s_data);
    let fileDetail;
    let inscriptionCost;

    if(oldSats === `true`){
      fileDetail = await saveFile(fileName);
      inscriptionCost = inscriptionPrice(feeRate, fileDetail.size);
      let sats = await Sats.findOne({_id: new ObjectId(process.env.OLD_SATS_ID)});
      if(!sats) return res.status(200).json({status: false, message: "No 2009 sats available"});
      if(sats.count >= sats.size) return res.status(200).json({status: false, message: "sat range exusted"});
      satsId = sats._id;
    
      const url = process.env.ORD_SAT_API_URL + `/ord/create/getMultipleReceiveAddr`;
      const data = {
        collectionName: "oldSatsWallet",
        addrCount: 1,
        networkName: networkName,
      };
      const result = await axios.post(url, data);
      if (result.data.message !== "ok") {
        return res.status(200).json({status: false, message: result.data.message});
      }
      paymentAddress = result.data.userResponse.data[0];
    }else {
      fileDetail = await saveFileS3(fileName);
      inscriptionCost = inscriptionPrice(feeRate, fileDetail.size);
      s3 = true;
      walletKey = await addWalletToOrd(inscriptionId, networkName);
      const url = ORD_API_URL + `/ord/create/getMultipleReceiveAddr`;
      const data = {
        collectionName: inscriptionId,
        addrCount: 1,
        networkName: networkName,
      };
      const result = await axios.post(url, data);
      if (result.data.message !== "ok") {
        return res.status(200).json({status: false, message: result.data.message});
      }
      paymentAddress = result.data.userResponse.data[0];
    }
    const inscription = new Inscription({
      id: inscriptionId,
      flag: networkName,
      inscribed: false,
      feeRate: feeRate,
      receiver: receiveAddress,
      inscriptionType: "sns",
      sat: satsId,
      s3: s3,

      inscriptionDetails: {
        fileName: fileName,
        payAddress: paymentAddress,
        cid: fileDetail.cid,
      },
      walletDetails: {
        keyPhrase: walletKey,
        walletName: inscriptionId,
      },
      cost: inscriptionCost,
      feeRate: feeRate,
      stage: "stage 1",
    });

    await inscription.save();

    res.status(200).json({
      status: true,
      message: "ok",
      userResponse: {
        cost: inscriptionCost,
        paymentAddress: paymentAddress,
        inscriptionId: inscriptionId,
      },
    });
  } catch (e){
    console.log(e.message);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
  }
}

module.exports.brc1155 = async (req, res) => {

  // BRC1155 Spec
  /**
   * {
   *    p: "brc-1155",
   *    op: "mint",
   *    content: https://ipfs.io/cid/fileName,
   * }
   */

  try {
    const file = req.files.file;
    const {networkName, receiveAddress, oldSats } = req.body;
    let feeRate = parseInt(req.body.feeRate);
    
    const id = await import("nanoid");
    const nanoid = id.customAlphabet(process.env.NANO_ID_SEED);
    const inscriptionId = `s${uuidv4()}`;
    let ORD_API_URL;
    let walletKey = "";
    let paymentAddress;
    let satsId;
    let s3 = false;
    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"})

    if (networkName === "mainnet")
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    const s_fileName = new Date().getTime().toString() + path.extname(file.name);
    const fileName = new Date().getTime().toString() +`.txt`
      const savePath = path.join(
        process.cwd(),
        "src",
        "img",
        "uncompressed",
        s_fileName
      );
      await file.mv(savePath);
      const saved_file = await compressAndSave(s_fileName, false);
      
      let data = {
        p: "brc-1155",
        op: "mint",
        content: process.env.IPFS_IMAGE_URL + `${saved_file.cid}/${s_fileName}`
      }
      let s_path = `./build/files/${fileName}`;
      let s_data = JSON.stringify(data).toString();
      writeFile(s_path, s_data);
      let fileDetail;
      let inscriptionCost;

      if(oldSats === `true`){
        fileDetail = await saveFile(fileName);
        inscriptionCost = inscriptionPrice(feeRate, fileDetail.size);
        let sats = await Sats.findOne({_id: new ObjectId(process.env.OLD_SATS_ID)});
        if(!sats) return res.status(200).json({status: false, message: "No 2009 sats available"});
        if(sats.count >= sats.size) return res.status(200).json({status: false, message: "sat range exusted"});
        satsId = sats._id;
      
        const url = process.env.ORD_SAT_API_URL + `/ord/create/getMultipleReceiveAddr`;
        const data = {
          collectionName: "oldSatsWallet",
          addrCount: 1,
          networkName: networkName,
        };
        const result = await axios.post(url, data);
        if (result.data.message !== "ok") {
          return res.status(200).json({status: false, message: result.data.message});
        }
        paymentAddress = result.data.userResponse.data[0];
      }else {
        fileDetail = await saveFileS3(fileName);
        inscriptionCost = inscriptionPrice(feeRate, fileDetail.size);
        s3 = true;
        walletKey = await addWalletToOrd(inscriptionId, networkName);
        const url = ORD_API_URL + `/ord/create/getMultipleReceiveAddr`;
        const data = {
          collectionName: inscriptionId,
          addrCount: 1,
          networkName: networkName,
        };
        const result = await axios.post(url, data);
        if (result.data.message !== "ok") {
          return res.status(200).json({status: false, message: result.data.message});
        }
        paymentAddress = result.data.userResponse.data[0];
      }
      const inscription = new Inscription({
        id: inscriptionId,
        flag: networkName,
        inscribed: false,
        feeRate: feeRate,
        receiver: receiveAddress,
        inscriptionType: "brc1155",
        sat: satsId,
        s3: s3,

        inscriptionDetails: {
          fileName: fileName,
          payAddress: paymentAddress,
          cid: fileDetail.cid,
        },
        walletDetails: {
          keyPhrase: walletKey,
          walletName: inscriptionId,
        },
        cost: inscriptionCost,
        feeRate: feeRate,
        stage: "stage 1",
      });

      await inscription.save();
      res.status(200).json({
        status: true,
        message: "ok",
        userResponse: {
          cost: inscriptionCost,
          paymentAddress: paymentAddress,
          inscriptionId: inscriptionId,
        },
      });
  } catch (e) {
    console.log(e.message);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
  }
}

module.exports.upload = async (req, res) => {
  try {
    const file = req.files.unCompImage;
    let feeRate = parseInt(req.body.feeRate);
    const networkName = req.body.networkName;
    let optimize = req.body.optimize;
    const receiveAddress = req.body.receiveAddress;
    let oldSats = req.body.oldSats;

    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"})
    
    if (!imageMimetype.includes(file.mimetype) && optimize === `true`){
      return res.status(200).json({status: false, message: `cannot optimaize ${file.mimetype}`})
    }
    const details = await init(file, feeRate, networkName, optimize, receiveAddress,oldSats);
    if (details.reqError) return res.status(200).json({status: false, message: details.reqError});
    if(details.resError) return res.status(200).json({status: false, message: details.resError})
    res.status(200).json({
      status: true,
      message: "ok",
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
    const files = req.files.unCompImage;
    const feeRate = parseInt(req.body.feeRate);
    const networkName = req.body.networkName;
    let optimize = req.body.optimize;
    const receiveAddress = req.body.receiveAddress;
    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"})
    if(files.length >= 100) return res.status(200).json({status: false, message: `file Upload Above Limit`});
    files.forEach((file) => {
      if (!imageMimetype.includes(file.mimetype) && optimize === `true`){
        return res.status(200).json({status:false, message: `cannot optimaize ${file.mimetype}`});
      }
    })
    const details = await initBulk(files, feeRate, networkName, optimize, receiveAddress);
    if (details.reqError) return res.status(200).json({status: false, message: details.reqError});
    if(details.resError) return res.status(200).json({status: false, message: details.resError})
    return res.status(200).json({
      status: true,
      message: "ok",
      userResponse: {
        compImage: {
          compPercentage: "",
          sizeIn: "",
          sizeOut: "",
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
    let ORD_API_URL;

    if (network === "mainnet") {
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    } else if (network === "testnet") {
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;
    }

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
    txDetails = await sendBitcoin(
      network,
      payAddressId,
      details,
      inscriptionType
    );

    if (txDetails.rawTx === "000")
      return res
        .status(200)
        .json({ status: false, message: `No input available for signing` });

    const txHash = await axios.post(ORD_API_URL + `/ord/broadcastTransaction`, {
      txHex: txDetails.rawTx,
      networkName: network,
    });

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
    console.log(e.message);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.sendUtxo1 = async(req,res) => {
  try{
    const inscriptionId = req.body.id;
    const networkName = req.body.networkName;
    const inscriptionType = getType(inscriptionId);

    let inscription;
    let instance;
    let balance;
    let ids;
    let ORD_API_URL;

    if (networkName === `mainnet`){
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    } else if(networkName === `testnet`){
      ORD_API_URL = process.env.ORD_TESTNET_API_URL
    }
    
    if (inscriptionType === "single") {
      inscription = await Inscription.where("id").equals(inscriptionId);
      instance = inscription[0];
      ids = await Ids.where("id").equals(instance._id);
      
    } else if (inscriptionType === "bulk") {
      inscription = await BulkInscription.where("id").equals(inscriptionId);
      instance = inscription[0];
      ids = await Ids.where("id").equals(instance._id);
    }
    
    const result = await axios.post(ORD_API_URL + `/ord/wallet/balance`, {
      walletName: inscriptionId,
      networkName: networkName,
    });
    balance = result.data.userResponse.data;

    if (balance < instance.cost.inscriptionCost) {
      return res.status(200).json({
        status: false,
        message: `not enough cardinal utxo for inscription. Available: ${balance}`,
      });
    } else {
      instance.stage = "stage 2";
      ids.status = `utxo sent`;
      await instance.save();
      return res
        .status(200)
        .json({ status: true, message: `ok`, userResponse: true });
    }
  }catch(e){
    console.log(e);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
  }
}

module.exports.inscribe = async (req, res) => {
  try {
    req.setTimeout(450000);
    const inscriptionId = req.body.id;
    const networkName = req.body.networkName;
    let changeAddress = req.body.changeAddress

    const type = getType(inscriptionId);
    let inscription;
    let instance;
    let newInscription;
    let imageName;
    let n_inscriptions;
    let details = [];
    let utxo;
    let offSet;
    let spendUtxo = "";
    let balance = 0;
    let ORD_API_URL;
    let receiverAddress;

    if (networkName === "mainnet"){
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
      if(!changeAddress) changeAddress = process.env.MAINNET_SERVICE_CHARGE_ADDRESS;
    }
      
    if (networkName === "testnet"){
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;
      if(!changeAddress) changeAddress = process.env.TESTNET_SERVICE_CHARGE_ADDRESS;
    }
    
    
    if (type === "single") {
      inscription = await Inscription.where("id").equals(inscriptionId);
      instance = inscription[0];

      balance = await getWalletBalance(instance.inscriptionDetails.payAddress, networkName).totalAmountAvailable;

      if(instance.sat){
        let sat = await Sats.findOne({_id: instance.sat});
        utxo = sat.output;
        offSet = sat.startOffset + sat.count;
        spendUtxo = await getSpendUtxo(instance.inscriptionDetails.payAddress, "mainnet");
        
        imageName = instance.inscriptionDetails.fileName;
        receiverAddress = instance.receiver;
        let cost = instance.cost.inscriptionCost;
        if (balance < cost) {
          return res.status(200).json({
          status: false,
          message: `not enough cardinal utxo for inscription. Available: ${balance}`,
         });
        }
      }else{
        imageName = instance.inscriptionDetails.fileName;
        console.log(imageName);
        receiverAddress = instance.receiver;
        let cost = instance.cost.inscriptionCost;
        if (balance < cost) {
          return res.status(200).json({
            status: false,
            message: `not enough cardinal utxo for inscription. Available: ${balance}`,
          });
        }
      }
    } else if (type === "bulk") {
      inscription = await BulkInscription.where("id").equals(inscriptionId);
      instance = inscription[0];

      balance = await getWalletBalance(instance.inscriptionDetails.payAddress, networkName).totalAmountAvailable;
      console.log(balance)
      receiverAddress = instance.receiver;
      let cost = instance.cost.cardinal;
      ids = await Ids.where("id").equals(instance._id);
      if (balance < cost) {
        return res.status(200).json({
          status: false,
          message: `not enough cardinal utxo for inscription. Available: ${balance}`,
        });
      }
    }
    
    if(instance.sat){ 
      newInscription = await axios.post(process.env.ORD_SAT_API_URL + `/ord/inscribe/oldSats`, {
        feeRate: instance.feeRate,
        receiverAddress: receiverAddress,
        cid: instance.inscriptionDetails.cid,
        inscriptionId: inscriptionId,
        type: type,
        imageName: imageName,
        networkName: "mainnet",
        changeAddress: changeAddress,
        utxo: utxo,
        offSet: offSet,
        spendUtxo: spendUtxo,
        oldSatWallet: "oldSatsWallet",
      });
    }else {
      if(instance.s3 === true){
        newInscription = await axios.post(ORD_API_URL + `/ord/inscribe/changeS3`, {
          feeRate: instance.feeRate,
          receiverAddress: receiverAddress,
          cid: instance.inscriptionDetails.cid,
          inscriptionId: inscriptionId,
          type: type,
          imageName: imageName,
          networkName: networkName,
          changeAddress: changeAddress,
          imageNames: instance.fileNames,
        });
      } else {
        newInscription = await axios.post(ORD_API_URL + `/ord/inscribe/change`, {
          feeRate: instance.feeRate,
          receiverAddress: receiverAddress,
          cid: instance.inscriptionDetails.cid,
          inscriptionId: inscriptionId,
          type: type,
          imageName: imageName,
          networkName: networkName,
          changeAddress: changeAddress,
        });
      }   
    }
    if (newInscription.data.message !== "ok") {
      return res
        .status(200)
        .json({ status: false, message: newInscription.data.message });
    }
    n_inscriptions = newInscription.data.userResponse.data;
    n_inscriptions.forEach((item) => {
      let inscriptions = item.inscriptions;
      inscriptions.map((e) => {
        const data = {
          inscription: e,
        };
        details.push(data);
      }) 
    });
    instance.inscription = details;
    
    if(instance.sat){
      await Sats.findOneAndUpdate({_id: instance.sat}, {$inc: {count: 1} }, {new: true });
    }
    
    if (!receiverAddress) {
      instance.inscribed = true;
      instance.stage = "stage 3";
      instance.receiver = "";
      await instance.save();
      return res.status(200).json({
        status: true,
        message: `ok`,
        userResponse: details,
      });
    } else {
      instance.sent = true;
      instance.inscribed = true;
      instance.stage = "stage 3";
      instance.receiver = receiverAddress;
      await instance.save();
      return res.status(200).json({
        status: true,
        message: `ok`,
        userResponse: details,
      });
    }
  } catch (e) {
    console.log(e.message);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.sendInscription = async (req, res) => {
  try {
    const id = req.body.inscriptionId;
    const inscriptions = req.body.inscriptions; // inscriptions in an array of objects containing the inscription id to be sent and the receiver address;
    const networkName = req.body.networkName;
    const feeRate = req.body.feeRate;
    let ORD_API_URL;

    if (networkName === "mainnet")
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    const result = await axios.post(ORD_API_URL + `/ord/sendInscription`, {
      inscriptions: inscriptions,
      inscriptionId: id,
      networkName: networkName,
      feeRate: feeRate,
    });

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
    console.log(e.message);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
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
    if(typeof(details) === `string`){
      return res.status(200).json({status: false, message: details});
    }

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

    if(files.length >= 100) return res.status(200).json({status: false, message: `file Upload Above Limit`});
    files.forEach((file) => {
      if (!imageMimetype.includes(file.mimetype) && optimize === `true`){
        return res.status(200).json({status:false, message: `cannot optimaize ${file.mimetype}`});
      }
    })
    const data = await getBulkInscriptionCost(files, feeRate, optimize);
    
    const details = {
      compImage: { compPercentage: "", sizeIn: "", sizeOut: "" },
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
      message: "ok",
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
    let cost;

    if (type === `single`) {
      inscription = await Inscription.findOne({ id: inscriptionId });
      if(!inscription) return res.status(200).json({status: false, message: "invalid inscription"});
      balance = await getWalletBalance(
        inscription.inscriptionDetails.payAddress,
        networkName
      );
      cost = inscription.cost.total;
    } else if (type === `bulk`) {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
      if(!inscription) return res.status(200).json({status: false, message: "invalid inscription"});
      balance = await getWalletBalance(
        inscription.inscriptionDetails.payAddress,
        networkName
      );
      cost = inscription.cost.total;
    }

    if (inscription.stage === "stage 2") {
      return res.status(200).json({ status: true, message: "utxo sent" });
    } else if (inscription.stage === "stage 3") {
      return res.status(200).json({
        status: true,
        message: "inscription complete",
        userResponse: inscription.inscription,
      });
    }

    if(inscription.collectionId){
      if(balance.status.length === 0) return res.status(200).json({status: false, message: "Waiting for payment"});
      if(balance.status[0].confirmed === false){
        if(inscription.collectionPayment === "waiting"){
          await Collection.findOneAndUpdate({id: inscription.collectionId}, {$push: {minted: {$each: inscription.fileNames, $position: -1}}},{$pull: {selected: {$in: inscription.selected}}}, {new: true});
          await SelectedItems.deleteOne({_id: inscription.selected});
          inscription.collectionPayment = "received";
          await inscription.save();
          return res.status(200).json({
            status: false,
            message: `Waiting for payment confirmation. confirmed: ${balance.status[0].confirmed}`,
          });
        }else if (inscription.collectionPayment === "received"){
          return res.status(200).json({
            status: false,
            message: `Waiting for payment confirmation. confirmed: ${balance.status[0].confirmed}`,
          });
        }
      }
    }

    if (balance.status[0] === undefined)
      return res.status(200).json({
        status: false,
        message: `Waiting for payment`,
      });

    if (balance.status[0].confirmed === false) {
      return res.status(200).json({
        status: false,
        message: `Waiting for payment confirmation. confirmed: ${balance.status[0].confirmed}`,
      });
    }
  
    if (balance.totalAmountAvailable < cost){
      return res.status(200).json({
        status: false,
        message: `payment not received. Available: ${balance.totalAmountAvailable}, Required: ${cost}`,
      });
    }else{
      return res
      .status(200)
      .json({ status: true, message: `ok`, userResponse: true });
    }
    
  } catch (e) {
    console.log(e.message);
    if(e.message === "Cannot read properties of undefined (reading 'status')") return res.status(200).json({status: false, message: "Waiting for payment"});
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.checkUtxo = async (req, res) => {
  try {
    const { inscriptionId, networkName } = req.body;
    const type = getType(inscriptionId);
    let inscription;
    let balance;
    let ORD_API_URL;

    if (networkName === "mainnet")
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    if (type === `single`) {
      inscription = await Inscription.findOne({ id: inscriptionId });
      const result = await axios.post(ORD_API_URL + `/ord/wallet/balance`, {
        walletName: inscriptionId,
        networkName: networkName,
      });
      balance = result.data.userResponse.data;
      if (inscription.stage === "stage 2") {
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
      } else if (inscription.stage === "stage 3") {
        return res.status(200).json({
          status: true,
          message: "inscription complete",
          userResponse: inscription.inscription,
        });
      }
    } else if (type === `bulk`) {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
      const result = await axios.post(ORD_API_URL + `/ord/wallet/balance`, {
        walletName: inscriptionId,
        networkName: networkName,
      });
      balance = result.data.userResponse.data;

      if (inscription.stage === "stage 2") {
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
      } else if (inscription.stage === "stage 3") {
        return res.status(200).json({
          status: true,
          message: "inscription complete",
          userResponse: inscription.inscription,
        });
      }
    }
  } catch (e) {
    console.log(e.message);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
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

    if (inscription.stage === "stage 1"){
      if (inscription.collectionId) {
        return res.status(200).json({
          status: true,
          message: "ok",
          userResponse: {
            stage: 1,
            endpoint: "inscription/checkPayment",
            route: "checkPayment",
            address: inscription.receiver,
            collectionId: inscription.collectionId,
          }
        });
      } else {
        return res.status(200).json({
          status: true,
          message: "ok",
          userResponse: {
            stage: 1,
            endpoint: "inscription/checkPayment",
            route: "checkPayment",
            address: inscription.receiver
          }
        });
      }
    }
      
    if (inscription.stage === "stage 2"){
        if (inscription.collectionId) {
          return res.status(200).json({
            status: true,
            message: "ok",
            userResponse: {
              stage: 2,
              endpoint: "collection/checkUtxo",
              route: "checkUtxo",
              address: inscription.receiver,
              collectionId: inscription.collectionId,
            }
          });
        } else {
          return res.status(200).json({
            status: true,
            message: "ok",
            userResponse: {
              stage: 2,
              endpoint: "inscription/checkUtxo",
              route: "checkUtxo",
              address: inscription.receiver
            }
          });
        }
    }
    
    if (inscription.stage === "stage 3"){
      if(inscription.collectionId){
        return res.status(200).json({
          status: true,
          message: "ok",
          userResponse: {
            stage: 3,
            endpoint: "",
            route: "viewInscriptions",
            address: inscription.receiver,
            collectionId: inscription.collectionId,
          }
        });
      }else{
        return res.status(200).json({
          status: true,
          message: "ok",
          userResponse: {
            stage: 3,
            endpoint: "",
            route: "viewInscriptions",
            address: inscription.receiver
          }
        });
      }
    }
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.getInscriptions = async (req, res) => {
  try{
    const { inscriptionId } = req.body;
    const type = getType(inscriptionId);
    let inscription;
    if (type === "single") {
      inscription = await Inscription.findOne({ id: inscriptionId });
    } else if (type === "bulk") {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
    }

    let allInscriptions = inscription.inscription;
    return res.status(200).json({status: true, message: `ok`, userResponse: allInscriptions});
  }catch(e){
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
}

module.exports.getConversion = async (req, res) => {
  try {
    const { btcAmount, satAmount } = req.body;
    const satToBtc = parseFloat((satAmount / 1e8).toFixed(8));
    let conversion = 0;
    if (btcAmount !== undefined) conversion = await btcToUsd(btcAmount);
    if (satAmount !== undefined) conversion = await btcToUsd(satToBtc);

    return res
      .status(200)
      .json({ status: true, message: "ok", userResponse: conversion });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.createPaymentLink = async (req, res) => {
  try {
    const { inscriptions, amount, networkName, inscriptionId } = req.body;
    const id = `p${uuidv4()}`;
    const count = await PayIds.find({}, { _id: 0 });
    const details = await createLegacyPayLinkAddress(networkName, count.length);
    const payAddress = details.p2pkh_addr;

    const payLink = new PayLink({
      id: id,
      amount: amount,
      inscriptions: inscriptions,
      payAddress: payAddress,
      payAddressId: count.length,
      inscriptionId: inscriptionId,
      sent: false,
    });

    const savedPayLink = await payLink.save();

    const payIds = new PayIds({
      id: savedPayLink._id,
      status: "pending",
    });

    await payIds.save();

    return res.status(200).json({
      status: true,
      message: "ok",
      userResponse: { amount: amount, id: id },
    });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.collectAddress = async (req, res) => {
  try {
    const { id, receiver } = req.body;
    const payLink = await PayLink.findOne({ id: id });
    const inscriptions = payLink.inscriptions;
    let n_inscriptions = [];
    inscriptions.forEach((id) => {
      let data = {
        address: receiver,
        id: id,
      };
      n_inscriptions.push(data);
    });
    const updatedPaylink = await PayLink.findOneAndUpdate(
      { id: id },
      { receiver: receiver }
    );

    const userResponse = {
      paymentAddress: updatedPaylink.payAddress,
      amount: updatedPaylink.amount,
      id: id,
    };

    return res
      .status(200)
      .json({ status: true, message: "ok", userResponse: userResponse });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.completePayment = async (req, res) => {
  try {
    const { id, networkName } = req.body;
    const payLink = await PayLink.findOne({ id: id });
    const payIds = await PayIds.findOne({ id: payLink._id });

    let payLinkAddress;
    let paymentDetails = [];
    const type = getType(id);
    if (networkName === `mainnet`) {
      payLinkAddress = process.env.MAINNET_PAYLINK_ADDRESS;
    } else if (networkName === `testnet`) {
      payLinkAddress = process.env.TESTNET_PAYLINK_ADDRESS;
    }
    const details = {
      address: payLinkAddress,
      value: payLink.amount - 5000,
    };

    paymentDetails.push(details);

    payLink.sent = true;
    payIds.status = "complete";

    const txDetails = await sendBitcoin(
      networkName,
      payLink.payAddressId,
      paymentDetails,
      type
    );

    console.log(txDetails);

    const txHash = await axios.post(
      process.env.ORD_API_URL + `/ord/broadcastTransaction`,
      { txHex: txDetails.rawTx, networkName: networkName }
    );

    if (txHash.data.message !== "ok") {
      return res.status(200).json({
        status: false,
        message: txHash.data.message,
      });
    }
  } catch (e) {
    console.log(e.message);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getPayLinkDetails = async (req, res) => {
  try {
    const { id } = req.body;
    const payLinkDetails = await PayLink.findOne({ id: id });
    return res
      .status(200)
      .json({ status: true, message: "ok", userResponse: payLinkDetails });
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
    if (type === "single") {
      inscription = await Inscription.findOne({ id: inscriptionId });
      data = {
        cost: inscription.cost,
        inscriptionId: inscriptionId,
        paymentAddress: inscription.inscriptionDetails.payAddress,
        receiverAddress: inscription.receiver,
        stage: inscription.stage,
      };
    }

    if (type === "bulk") {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
      const totalAmount = inscription.inscriptionDetails.totalAmount;
      const costPerInscription = inscription.cost.costPerInscription;
      const costDetails = {
        serviceCharge: costPerInscription.serviceCharge * totalAmount,
        inscriptionCost: costPerInscription.inscriptionCost * totalAmount,
        sizeFee: costPerInscription.sizeFee * totalAmount,
        postageFee: costPerInscription.postageFee,
        total: costPerInscription.total * totalAmount,
      };
      data = {
        cost: costDetails,
        inscriptionId: inscriptionId,
        paymentAddress: inscription.inscriptionDetails.payAddress,
        receiverAddress: inscription.receiver,
        stage: inscription.stage,
      };
    }

    return res
      .status(200)
      .json({ status: true, message: "ok", userResponse: data });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.addSats = async (req, res) => {
  try {
    const { sats } = req.body;
    let data = [];
    sats.forEach((sat) => {
      data.push({
        output: sat.output,
        start: sat.start,
        end: sat.end,
        year: sat.year,
        rarity: sat.rarity,
        specialAttribute: sat.specialAttribute,
        startOffset: sat.startOffset,
        endOffset: sat.endOffset,
        size: sat.size,
        count: 0
      }) 
    });
    const savedSats = await Sats.insertMany(data);
    return res
      .status(200)
      .json({ status: true, message: "ok", userResponse: savedSats });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.getSatsByYear = async (req, res) => {
  try {
    const { year } = req.body;
    const sats = await _getSatsByYear(year)
    return res
      .status(200)
      .json({ status: true, message: "ok", userResponse: sats });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.getSatsById = async (req, res) => {
  try {
    const { id } = req.body;
    const sat = await _getSatById(id)
    return res
      .status(200)
      .json({ status: true, message: "ok", userResponse: sat });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};


const _getSatsByYear = async (year) => {
  try {
    const sats = await Sats.find({ year: year });
    let validSats = [];
    sats.forEach((sat) => {
      if (sat.count < sat.size){
        validSats.push(sat);
      }
    });
    return validSats;
  } catch (e) {
    console.log(e.message);
    return [];
  }
};

const _getSatById = async (id) => {
  try {
    const sat = await Sats.findOne({ _id: id });
    return sat;
  } catch (e) {
    console.log(e.message);
    return null;
  }
};

const init = async (file, feeRate, networkName, optimize, receiveAddress, oldSats) => {
  try {
    const inscriptionId = `s${uuidv4()}`;
    let ORD_API_URL;
    let compImage;
    let inscriptionCost;
    let paymentAddress;
    let walletKey = "";
    let satsId;

    if (networkName === "mainnet")
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

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
      compImage = await compressAndSaveS3(fileName, true);
      inscriptionCost = inscriptionPrice(feeRate, compImage.sizeOut);

      if(oldSats === `true`){
        let sats = await Sats.findOne({_id: new ObjectId(process.env.OLD_SATS_ID)});
        if(!sats) return res.status(200).json({status: false, message: "No 2009 sats available"});
        if(sats.count >= sats.size) return res.status(200).json({status: false, message: "sat range exusted"});
        satsId = sats._id;
      
        const url = process.env.ORD_SAT_API_URL + `/ord/create/getMultipleReceiveAddr`;
        const data = {
          collectionName: "oldSatsWallet",
          addrCount: 1,
          networkName: networkName,
        };
        const result = await axios.post(url, data);
        if (result.data.message !== "ok") {
          return res.status(200).json({status: false, message: result.data.message});
        }
        paymentAddress = result.data.userResponse.data[0];
      }else {
        walletKey = await addWalletToOrd(inscriptionId, networkName);
        const url = ORD_API_URL + `/ord/create/getMultipleReceiveAddr`;
        const data = {
          collectionName: inscriptionId,
          addrCount: 1,
          networkName: networkName,
        };
        const result = await axios.post(url, data);
        if (result.data.message !== "ok") {
          return res.status(200).json({status: false, message: result.data.message});
        }
        paymentAddress = result.data.userResponse.data[0];
      }
    } else if (optimize === `false`) {
      compImage = await compressAndSaveS3(fileName, false);
      inscriptionCost = inscriptionPrice(feeRate, file.size);

      if(oldSats === `true`){
        let sats = await Sats.findOne({_id: new ObjectId(process.env.OLD_SATS_ID)});
        if(!sats) return res.status(200).json({status: false, message: "No 2009 sats available"});
        if(sats.count >= sats.size) return res.status(200).json({status: false, message: "sat range exusted"});
        satsId = sats._id;
      
        const url = process.env.ORD_SAT_API_URL + `/ord/create/getMultipleReceiveAddr`;
        const data = {
          collectionName: "oldSatsWallet",
          addrCount: 1,
          networkName: networkName,
        };
        const result = await axios.post(url, data);
        if (result.data.message !== "ok") {
          return res.status(200).json({status: false, message: result.data.message});
        }
        paymentAddress = result.data.userResponse.data[0];
      }else {
        walletKey = await addWalletToOrd(inscriptionId, networkName);
        const url = ORD_API_URL + `/ord/create/getMultipleReceiveAddr`;
        const data = {
          collectionName: inscriptionId,
          addrCount: 1,
          networkName: networkName,
        };
        const result = await axios.post(url, data);
        if (result.data.message !== "ok") {
          return res.status(200).json({status: false, message: result.data.message});
        }
        paymentAddress = result.data.userResponse.data[0];
      }
    }
    const inscription = new Inscription({
      id: inscriptionId,
      flag: networkName,
      inscribed: false,
      feeRate: feeRate,
      sat: satsId,
      s3: true,

      inscriptionDetails: {
        imageSizeIn: compImage.sizeIn / 1e3,
        imageSizeOut: compImage.sizeOut / 1e3,
        fileName: fileName,
        comPercentage: compImage.comPercentage,
        payAddress: paymentAddress,
        cid: compImage.cid,
      },
      walletDetails: {
        keyPhrase: walletKey,
        walletName: inscriptionId,
      },
      cost: inscriptionCost,
      feeRate: feeRate,
      receiver: receiveAddress,
      stage: "stage 1",
    });

    await inscription.save();
    
    return {
      compImage,
      inscriptionCost,
      paymentAddress,
      inscriptionId,
    };
  } catch (e) {
    console.log(e.message);
    if(e.request) return {reqError: e.message};
    if(e.response) return {resError: e.response.data};
  }
};

const initBulk = async (files, feeRate, networkName, optimize, receiveAddress) => {
  try {
    const id = await import("nanoid");
    const nanoid = id.customAlphabet(process.env.NANO_ID_SEED);
    const inscriptionId = `b${uuidv4()}`;
    const serviceCharge = parseInt(process.env.SERVICE_CHARGE) * files.length;
    let optimized;
    let imageNames = [];

    let ORD_API_URL;

    if (networkName === "mainnet")
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

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

    await Promise.all(
      files.map(async (file, index) => {
        ext = path.extname(file.name);
        const fileName = new Date().getTime().toString() + index.toString() + path.extname(file.name);
        imageNames.push(fileName);
        const savePath = path.join(
          process.cwd(),
          "src",
          "bulk",
          `${inscriptionId}`,
          fileName
        );
      await file.mv(savePath);
      })
    );

    const data = await compressAndSaveBulkS3(inscriptionId, optimized);
    const costPerInscription = inscriptionPrice(feeRate, data.largestFile);
    const totalCost = costPerInscription.total * files.length;
    const cardinals = costPerInscription.inscriptionCost;
    const sizeFee = costPerInscription.sizeFee * files.length;

    const walletKey = await addWalletToOrd(inscriptionId, networkName);
    const url = ORD_API_URL + `/ord/create/getMultipleReceiveAddr`;
    const r_data = {
      collectionName: inscriptionId,
      addrCount: 1,
      networkName: networkName,
    };
    const result = await axios.post(url, r_data);
    if (result.data.message !== "ok") {
      return res.status(200).json({status: false, message: result.data.message});
    }
    let paymentAddress = result.data.userResponse.data[0];
    const bulkInscription = new BulkInscription({
      id: inscriptionId,
      flag: networkName,
      inscribed: false,
      feeRate: feeRate,
      receiver: receiveAddress,
      fileNames: imageNames,
      s3: true,

      inscriptionDetails: {
        largestFile: data.largestFile,
        totalAmount: files.length,
        payAddress: paymentAddress,
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
      },
      stage: "stage 1",
    });

    await bulkInscription.save();

    return {
      data: data,
      cardinals: cardinals * files.length,
      totalCost: totalCost,
      sizeFee: sizeFee,
      serviceCharge: serviceCharge,
      paymentAddress: paymentAddress,
      inscriptionId: inscriptionId,
    };
  } catch (e) {
    console.log(e.message);
    if(e.request) return {reqError: e.message};
    if(e.response) return {resError: e.response.data};
  }
};

const inscriptionPrice = (feeRate, fileSize) => {
  const serviceCharge = parseInt(process.env.SERVICE_CHARGE);
  const sats = Math.ceil((fileSize / 4) * feeRate);
  const cost = sats + 1500 + 550;
  const sizeFee = Math.ceil(cost / 2);
  const total = serviceCharge + cost + parseInt(sizeFee);
  return {
    serviceCharge,
    inscriptionCost: cost + sizeFee,
    sizeFee: sizeFee,
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
    
    if (!imageMimetype.includes(file.mimetype) && optimize === `true`){
      return `cannot optimaize ${file.mimetype}`;
    }

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

    return {
      fileSize: data.largestFile / 1e3,
      total: total,
      costPerInscription: inscriptionCost,
    };
  } catch (e) {
    console.log(e.message);
  }
};

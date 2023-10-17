const { unlinkSync, existsSync, mkdirSync } = require("fs");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv").config();
const Inscription = require("../model/inscription");
const Network = require("../model/network");
const SelectedItems = require("../model/selectedItems");
const BulkInscription = require("../model/bulkInscription");
const Address = require("../model/address");
const Collection = require("../model/collection");
const SpecialSat = require("../model/specialSats");
const UserReward = require("../model/userReward")
const {checkPayment} = require("../helpers/inscriptionHelper.js")
const ObjectId = require('mongoose').Types.ObjectId; 
const {
  compressImage,
  compressAndSave,
  compressAndSaveS3,
  compressAndSaveBulkS3,
  compressBulk,
  saveFile,
  saveFileS3,
} = require("../helpers/imageHelper");
const {
  addWalletToOrd,
  verifyAddress,
} = require("../helpers/walletHelper");
const {
  getRecomendedFee,
  getWalletBalance,
  getSpendUtxo
} = require("../helpers/sendBitcoin");

const { getType } = require("../helpers/getType");
const { btcToUsd, usdToSat } = require("../helpers/btcToUsd");
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
    const fileName = inscriptionId +`_`+ new Date().getTime().toString() + `.txt`;
    let walletKey = "";
    let paymentAddress;
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

    if(oldSats !== "random"){
      fileDetail = await saveFile(fileName);
      inscriptionCost = await inscriptionPrice(feeRate, fileDetail.size, oldSats);
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
      inscriptionCost = await inscriptionPrice(feeRate, fileDetail.size, oldSats);
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
      sat: oldSats,
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
    const fileName = inscriptionId +`_`+ new Date().getTime().toString() +`.txt`;
    let walletKey = "";
    let paymentAddress;
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
    if(oldSats !== "random"){
      fileDetail = await saveFile(fileName);
      inscriptionCost = await inscriptionPrice(feeRate, fileDetail.size, oldSats);

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
      inscriptionCost = await inscriptionPrice(feeRate, fileDetail.size, oldSats);
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
      sat: oldSats,
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
    const fileName = inscriptionId +`_`+ new Date().getTime().toString() +`.txt`;
    let walletKey = "";
    let paymentAddress;
    let s3 = false;
    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"})

    if (networkName === "mainnet")
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;
    let data;
    let s_path = `./build/files/${fileName}`;

    if(name.split("").includes(".")){
      return res.status(200).json({status: false, message: `${name} your name can not contain "."`});
    }
    // let verifyName = await verifySats(name + ".sats");
    // if(!verifyName) return res.status(200).json({status: false, message: `${name} already exists`});
    
    data = {
      p: "sns",
      op: "reg",
      name: name + `.sats`
    }
    
    let s_data = JSON.stringify(data).toString();
    writeFile(s_path, s_data);
    let fileDetail;
    let inscriptionCost;

    if(oldSats !== "random"){
      fileDetail = await saveFile(fileName);
      inscriptionCost = await inscriptionPrice(feeRate, fileDetail.size, oldSats);
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
      inscriptionCost = await inscriptionPrice(feeRate, fileDetail.size, oldSats);
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
      sat: oldSats,
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
    console.log(e);
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
    let s3 = false;
    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"})

    if (networkName === "mainnet")
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    const s_fileName = inscriptionId +`_`+ new Date().getTime().toString() + path.extname(file.name);
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

      if(oldSats !== "random"){
        fileDetail = await saveFile(fileName);
        inscriptionCost = await inscriptionPrice(feeRate, fileDetail.size, oldSats);
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
      }else{
        fileDetail = await saveFileS3(fileName);
        inscriptionCost = await inscriptionPrice(feeRate, fileDetail.size, oldSats);
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
        sat: oldSats,
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
    let receiveAddress = req.body.receiveAddress;
    let oldSats = req.body.oldSats;
    let usePoints = req.body.usePoints
    let hasReward
    //TOTO: Remove hard coded vale and return from ENV or DB
    let inscriptionPoint = 1000;
    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"})
    let userReward = await UserReward.findOne({address: receiveAddress})
    if(!userReward) {
      hasReward = false
    }else {
      if(usePoints !== undefined && usePoints === "true"){
        if(userReward.totalPoints < inscriptionPoint) {
          return res.status(200).json({status: false, message: "user total scribe points is less than required point"})
        }else{
          hasReward = true
        }
      }else{
        hasReward = false
      }
    }
    
    if (!imageMimetype.includes(file.mimetype) && optimize === `true`){
      return res.status(200).json({status: false, message: `cannot optimaize ${file.mimetype}`})
    }
    const details = await init(file, feeRate, networkName, optimize, receiveAddress, oldSats, hasReward);
    if (details.reqError) return res.status(200).json({status: false, message: details.reqError});
    if(details.resError) return res.status(200).json({status: false, message: details.resError})
    
    return res.status(200).json({
      status: true,
      message: "ok",
      userResponse: {
        compImage: details.compImage,
        cost: await details.inscriptionCost,
        paymentAddress: details.paymentAddress,
        inscriptionId: details.inscriptionId,
      },
    });
  } catch (e) {
    console.log(e.message);
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
    let usePoints = req.body.usePoints
    let hasReward
    //TOTO: Remove hard coded vale and return from ENV or DB
    let inscriptionPoint = 1000 * files.length;
    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"})
    let userReward = await UserReward.findOne({address: receiveAddress})
    if(!userReward) {
      hasReward = false
    }else {
      if(usePoints !== undefined && usePoints === "true"){
        if(userReward.totalPoints < inscriptionPoint) {
          return res.status(200).json({status: false, message: "user total scribe points is less than required point"})
        }else{
          hasReward = true
        }
      }else{
        hasReward = false
      }
    }
    if(files.length >= 20) return res.status(200).json({status: false, message: `file Upload Above Limit`});
    files.forEach((file) => {
      if (!imageMimetype.includes(file.mimetype) && optimize === `true`){
        return res.status(200).json({status:false, message: `cannot optimaize ${file.mimetype}`});
      }
    })
    const details = await initBulk(files, feeRate, networkName, optimize, receiveAddress, usePoints);
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

module.exports.inscribe = async (req, res) => {
  try {
    req.setTimeout(450000);
    const inscriptionId = req.body.id;
    const networkName = req.body.networkName;
    let changeAddress = req.body.changeAddress

    console.log("Id:", inscriptionId)

    const type = getType(inscriptionId);
    let inscription;
    let instance;
    let newInscription ;
    let imageName;
    let n_inscriptions;
    let details = [];
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
      imageName = instance.inscriptionDetails.fileName;
      receiverAddress = instance.receiver;
      let cost = instance.cost.inscriptionCost;
      if (balance < cost) {
        return res.status(200).json({
          status: false,
          message: `not enough cardinal utxo for inscription. Available: ${balance}`,
        });
      }
      
    } else if (type === "bulk") {
      inscription = await BulkInscription.where("id").equals(inscriptionId);
      instance = inscription[0];

      balance = await getWalletBalance(instance.inscriptionDetails.payAddress, networkName).totalAmountAvailable;
      
      receiverAddress = instance.receiver;
      let cost = instance.cost.cardinal;
      if (balance < cost) {
        return res.status(200).json({
          status: false,
          message: `not enough cardinal utxo for inscription. Available: ${balance}`,
        });
      }
    }
    if(instance.sat && instance.sat !=="random"){ 
      let spendUtxo = await getSpendUtxo(instance.inscriptionDetails.payAddress, networkName)
      if(instance.s3 === true){
        newInscription = await axios.post(process.env.ORD_SAT_API_URL + `/ord/inscribe/oldSats`, {
          feeRate: instance.feeRate,
          receiverAddress: receiverAddress,
          type: instance.sat,
          imageName: imageName,
          networkName: "mainnet",
          spendUtxo: spendUtxo,
          changeAddress: changeAddress,
          walletName: "oldSatsWallet",
          storageType: "AWS",
        });
      }else{
        newInscription = await axios.post(process.env.ORD_SAT_API_URL + `/ord/inscribe/oldSats`, {
          feeRate: instance.feeRate,
          receiverAddress: receiverAddress,
          cid: instance.inscriptionDetails.cid,
          inscriptionId: inscriptionId,
          type: instance.sat,
          imageName: imageName,
          networkName: "mainnet",
          spendUtxo: spendUtxo,
          changeAddress: changeAddress,
          walletName: "oldSatsWallet",
          storageType: "IPFS",
        });
      }
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
    if(newInscription.data.userResponse.data.length === 0) return res.status(200).json({status: false, message: "file not inscribed"})
    n_inscriptions.forEach((item) => {
      const data = {
        inscription: item,
      };
      details.push(data);
    });
    
    instance.inscription = details;
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
  } catch (e) {
    console.log(e.message);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    console.log(e.response);
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
    const oldSats = req.body.oldSats
    let usePoints = req.body.usePoints
    const receiveAddress = req.body.receiveAddress;
    let hasReward
    //TOTO: Remove hard coded vale and return from ENV or DB
    let inscriptionPoint = 1000;
    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"})
    let userReward = await UserReward.findOne({address: receiveAddress})
    if(!userReward) {
      hasReward = false
    }else {
      if(usePoints !== undefined && usePoints === "true"){
        if(userReward.totalPoints < inscriptionPoint) {
          return res.status(200).json({status: false, message: "user total scribe points is less than required point"})
        }else{
          hasReward = true
        }
      }else{
        hasReward = false
      }
    }
    const details = await getInscriptionCost(file, feeRate, optimize, oldSats, hasReward);
    if(typeof details === `string`){
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
    const receiveAddress = req.body.receiveAddress;

    let usePoints = req.body.usePoints
    let hasReward
    //TOTO: Remove hard coded vale and return from ENV or DB
    let inscriptionPoint = 1000 * files.length;
    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"})
    let userReward = await UserReward.findOne({address: receiveAddress})
    if(!userReward) {
      hasReward = false
    }else {
      if(usePoints !== undefined && usePoints === "true"){
        if(userReward.totalPoints < inscriptionPoint) {
          return res.status(200).json({status: false, message: "user total scribe points is less than required point"})
        }else{
          hasReward = true
        }
      }else{
        hasReward = false
      }
    }

    if(files.length >= 100) return res.status(200).json({status: false, message: `file Upload Above Limit`});
    files.forEach((file) => {
      if (!imageMimetype.includes(file.mimetype) && optimize === `true`){
        return res.status(200).json({status:false, message: `cannot optimaize ${file.mimetype}`});
      }
    })
    const data = await getBulkInscriptionCost(files, feeRate, optimize, hasReward);
    
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

module.exports.checkPayments = async (req, res) => {
  try {
    const { inscriptionId, networkName } = req.body;
    let result = await checkPayment({inscriptionId: inscriptionId, networkName: networkName})
    if(result.status === true){
      return res.status(200).json({status:true, message: result.message, userResponse: result.data.ids})
    }else{
      return res.status(200).json({status:false, message: result.message, userResponse: result.data.ids})
    }
  } catch (e) {
    console.log(e.message);
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
          type: "collection",
          message: "ok",
          userResponse: {
            stage: 1,
            endpoint: "inscript",
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
            endpoint: "inscript",
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
            type: "collection",
            userResponse: {
              stage: 2,
              endpoint: "collection",
              route: "inscribe",
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
              endpoint: "inscript",
              route: "inscribe",
              address: inscription.receiver
            }
          });
        }
    }
    
    if (inscription.stage === "stage 3"){
      if(inscription.collectionId){
        return res.status(200).json({
          status: true,
          type: "collection",
          message: "ok",
          userResponse: {
            stage: 3,
            endpoint: "collection",
            route: "getInscriptions",
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
            endpoint: "inscript",
            route: "getInscriptions",
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

const init = async (file, feeRate, networkName, optimize, receiveAddress, satType, usePoints) => {
  try {
    const inscriptionId = `s${uuidv4()}`;
    let ORD_API_URL;
    let compImage;
    let inscriptionCost;
    let paymentAddress;
    let walletKey = "";
    let _usePoints

    if(usePoints === "true"){
      _usePoints = true
    }else{
      _usePoints = false
    }

    if (networkName === "mainnet")
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    const fileName = inscriptionId +`_`+new Date().getTime().toString() + path.extname(file.name);
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
      console.log(compImage)
      if(satType !== "random"){
        inscriptionCost = await inscriptionPrice(feeRate, compImage.sizeOut, satType, _usePoints);
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
        inscriptionCost = await inscriptionPrice(feeRate, compImage.sizeOut, satType, _usePoints);
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
      
      if(satType !== "random"){
        inscriptionCost = await inscriptionPrice(feeRate, file.size, satType, _usePoints);
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
        inscriptionCost = await inscriptionPrice(feeRate, file.size, satType, _usePoints);
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
      sat: satType,
      s3: true,
      usePoints:_usePoints,

      inscriptionDetails: {
        imageSizeIn: file.size / 1e3,
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

const initBulk = async (files, feeRate, networkName, optimize, receiveAddress, usePoints) => {
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

    let _usePoints

    if(usePoints === "true"){
      _usePoints = true
    }else{
      _usePoints = false
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
    const costPerInscription = await inscriptionPrice(feeRate, data.largestFile, "random", _usePoints);
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
      usePoints:usePoints,

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

const getSatPrices = async () => {
  try{
    let price = (await SpecialSat.find({})).map(sat=> {
      return {
        satType: sat.satType,
        price: sat.price
      }
    })

    return  price
  }catch(e){
    console.log(e.message);
  }
}

const getSatCost = async (type) => {
  try{
    let sats = await getSatPrices()
    let price = 0;
    sats.forEach((x)=> {
      if (x.satType === type) {
        price = x.price
      }
    })
    //convert usd to sat
    return (await usdToSat(price)).satoshi
  }catch(e){
    console.log(e.message)
  }
}

const inscriptionPrice = async (feeRate, fileSize, satType, usePoints) => {
  try{
    let serviceCharge = parseInt(process.env.SERVICE_CHARGE);
    let sats = Math.ceil((fileSize / 4) * feeRate);
    let cost = sats + 1500 + 550 + 5000;
    let sizeFee = parseInt(Math.ceil(cost / 7));
    let satCost = 0
    if(sizeFee < 1024){
      sizeFee = 1024
    }
    if(satType !== "random"){
      satCost = await getSatCost(satType)
    }

    if(usePoints === true){
      serviceCharge = 1000
      //cost = cost + 1000
    }

    const total = serviceCharge + cost + sizeFee + satCost;
    return {
      serviceCharge,
      inscriptionCost: cost + sizeFee,
      sizeFee: sizeFee,
      satCost: satCost,
      postageFee: 550,
      total: total,
    };
  }catch(e){
    console.log(e.message);
  }
};

const getInscriptionCost = async (file, feeRate, optimize, satType, usePoints) => {
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
      inscriptionCost = await inscriptionPrice(feeRate, compImage.sizeOut, satType, usePoints);
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
      inscriptionCost = await inscriptionPrice(feeRate, file.size, satType, usePoints);
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

const getBulkInscriptionCost = async (files, feeRate, optimize, usePoints) => {
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

    const inscriptionCost = await inscriptionPrice(feeRate, data.largestFile, "random", usePoints);
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



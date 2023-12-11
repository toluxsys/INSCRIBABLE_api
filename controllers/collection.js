/* eslint-disable object-shorthand */
/* eslint-disable prettier/prettier */
/* eslint-disable no-continue */
const { existsSync } = require('fs');
const axios = require('axios');

const interval = 15;
const moment = require('moment');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv').config();
const Inscription = require('../model/inscription');
const Address = require('../model/address');
const BulkInscription = require('../model/bulkInscription');
const Collection = require('../model/collection');
const SelectedItems = require('../model/selectedItems');
const ServiceFee = require('../model/serviceFee');
const SpecialSat = require('../model/specialSats');
const UserReward = require('../model/specialSats');
const FeaturedCollections = require('../model/featuredCollection');
const RabbitMqClient = require('../helpers/queue/rabbitMqClient.js');
const Task = require('../model/task');
const { getType } = require('../helpers/getType');
const { usdToSat } = require('../helpers/btcToUsd');
const {
  addWalletToOrd,
  verifyAddress,
  collectionWalletDetails,
} = require('../helpers/walletHelper');
const {
  compressAndSaveBulk,
  uploadToS3,
  downloadAddressFile,
  downloadAllAddressFile,
  compressAndSave,
} = require('../helpers/imageHelper');
const { getSats } = require('../helpers/satHelper');
const MintDetails = require('../model/mintDetails');
const { inscribe, addToCreatorsQueue } = require('../helpers/inscriptionHelper');
const {createTransaction, getAddressType, getAddressHistory, } = require('../helpers/walletHelper.js');

const writeImageFiles = (path, data) => {
  try {
    if (!existsSync(`${process.cwd()}/src/imageLinks/`)) {
      fs.mkdirSync(
        `${process.cwd()}/src/imageLinks/`,
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

const getLinks = async (cid, totalSupply) => {
  try {
    const client = await import('ipfs-http-client');
    const links = [];
    const url = 'https://dweb.link/api/v0';
    const ipfs = client.create({ url });

    if (!existsSync(`${process.cwd()}/src/imageLinks/${cid}.json`)) {
      for await (const link of ipfs.ls(cid)) {
        links.push(link);
      }
      const filePath = `./src/imageLinks/${cid}.json`;
      writeImageFiles(filePath, JSON.stringify(links));
      const i_data = [];

      for (let i = 0; i < totalSupply; i++) {
        if(links[i] !== undefined){
          i_data.push(links[i]);
        } 
      }
      return i_data;
    }
    const data = JSON.parse(
      fs.readFileSync(`${process.cwd()}/src/imageLinks/${cid}.json`),
    );
    const i_data = [];

    for (let i = 0; i < totalSupply; i++) {
      if(data[i] !== undefined){
        i_data.push(data[i]);
      } 
    }
    return i_data;
  } catch (e) {
    console.log(e.message);
  }
};

const getServiceFee = async (collectionId) => {
  try {
    const serviceFee = await ServiceFee.findOne({ collectionId });
    if (!serviceFee) return process.env.COLLECTION_SERVICE_FEE;
    return serviceFee.serviceFee.toString();
  } catch (e) {
    console.log(e.message);
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
      if (x.satType === type) price = x.price;
    });
    return (await usdToSat(price)).satoshi;
  } catch (e) {
    console.log(e.message);
  }
};


//addresses is an array of the service fee address and creators address
const inscriptionPrice = async (
  feeRate,
  fileSize,
  price,
  collectionId,
  satType,
  usePoints,
  addresses
) => {
  try {
    let serviceCharge = parseInt(await getServiceFee(collectionId));
    const sats = Math.ceil((fileSize / 4) * feeRate);
    const cost = sats + 1500 + 550 + 2000;
    const sizeFee = Math.ceil(300 * feeRate + (sats / 10));
    let satCost = 0;
  
    if (satType !== 'random') {
      satCost = await getSatCost(satType);
    }
    if (usePoints === true) {
      serviceCharge = 1000;
      // cost = cost + 1000
    }

    // This calculates the fees required to send the creator their fee for the mint
    // eslint-disable-next-line import/no-extraneous-dependencies
    let creatorsTransactionFees = 0;
    if(price !== 0){
      const qip_wallet = (await import('qip-wallet')).default;
      const addrTypes = await getAddressType(addresses, 'mainnet')
      const transactionSize = qip_wallet.getTransactionSize({input: 1, output: addrTypes, addressType: 'segwit'}).txVBytes
      creatorsTransactionFees = transactionSize * feeRate
    }
    
    const total = serviceCharge + cost + creatorsTransactionFees + sizeFee + price + satCost;
    return {
      serviceCharge,
      inscriptionCost: cost + sizeFee + creatorsTransactionFees,
      sizeFee,
      postageFee: 550,
      satCost,
      total,
    };
  } catch (e) {
    console.log(e.message);
  }
};

const updateMintStage1 = async (collectionId) => {
  try {
    const collection = await Collection.findOne({ id: collectionId });
    if (!collection) {
      return 'collection not found';
    }
    if (collection.paused === true) return 'mint is paused';
    if (collection.ended === true) return 'mint ended';
    if (collection.startMint === false) return 'mint is yet to start';

    const stages = collection.mintDetails;
    if (!stages) return 'mint stages not added';

    const mintStage = await MintDetails.findOne({ _id: collection.mintStage });
    if (!mintStage) return 'mint stage not set';

    const allStages = await MintDetails.find({ collectionId });
    let prevDuration = 0;
    for (let i = 0; i < allStages.length; i++) {
      if (i === 0 && allStages[i].name === mintStage.name) {
        prevDuration = 0;
        break;
      } else {
        prevDuration += allStages[i].duration;
        if (allStages[i + 1].name === mintStage.name) {
          break;
        } else {
          continue;
        }
      }
    }

    const currentTime = moment();
    const startTime = collection.startAt;
    const stageStartTime = new Date(startTime.getTime() + prevDuration);
    const timeDifference = currentTime.diff(stageStartTime, 'seconds');
    const duration = mintStage.duration;

    if (timeDifference >= duration) {
      const nextStageIndex = stages.indexOf(collection.mintStage) + 1;
      if (nextStageIndex + 1 > stages.length) {
        collection.startMint = false;
        collection.ended = true;
        await collection.save();
        return 'mint stage updated';
      }
      const nextStage = stages[nextStageIndex];
      collection.mintStage = nextStage;
      await collection.save();
      return 'mint stage updated';
    }
    return 'mint stage updated';
  } catch (e) {
    console.log(e);
    return 'error updating mint stage';
  }
};

const checkTimeElapsed = (timestamp) => {
  const currentTime = moment();
  const timeDiff = currentTime.diff(timestamp, 'minutes');

  if (timeDiff >= interval) {
    return true;
  }
  return false;
};

const addMintDetails = async (collectionId, details) => {
  try {
    // let details = await JSON.parse(items);
    const allDetails = [];
    details.forEach(async (detail) => {
      // convert duration from hours to seconds
      const duration = detail.duration * 60 * 60;
      allDetails.push({
        collectionId,
        name: detail.name,
        mintLimit: detail.mintLimit,
        price: detail.price * 1e8,
        duration,
      });
    });
    const savedDetails = await MintDetails.insertMany(allDetails);
    const ids = savedDetails.map((item) => item._id);
    return ids;
  } catch (e) {
    console.log(e.message);
  }
};

const checkWallet = async (collectionId, address) => {
  try {
    const mintStages = await MintDetails.find({ collectionId });
    const stagNames = [];
    const params = [];
    let addresses = [];
    const regex = /[^,\r\n]+/g;
    mintStages.forEach(async (stage) => {
      if (stage.name === 'public' || stage.name === 'Public') {
        stagNames.push(`addr-${collectionId}-${stage.name}.txt`);
      } else {
        stagNames.push(`addr-${collectionId}-${stage.name}.txt`);
        params.push({
          Bucket: process.env.S3_BUCKET_NAME,
          Key: `addr-${collectionId}-${stage.name}.txt`,
        });
      }
    });

    const res = await downloadAllAddressFile(params, collectionId);
    if (res === false) {
      return {
        valid: false,
        price: 0,
        mintCount: 0,
        message: `collection addresses not found`,
      };
    }

    fs.readdirSync(`${process.cwd()}/src/address/${collectionId}`).forEach(
      (file) => {
        const _addr = fs.readFileSync(
          `${process.cwd()}/src/address/${collectionId}/${file}`,
          { encoding: 'utf8' },
        );
        const allowedAddr = _addr.match(regex);
        addresses = addresses.concat(allowedAddr);
      },
    );

    // filter the addresses array to remove items that appear more than once
    const _addresses = addresses.filter(
      (item, index) => addresses.indexOf(item) === index,
    );

    if (_addresses.includes(address)) {
      return {
        valid: true,
        price: 0,
        mintCount: 0,
        message: `valid mint`,
      };
    }
    return {
      valid: false,
      price: 0,
      mintCount: 0,
      message: `address not valid for mint`,
    };
  } catch (e) {
    console.log(e.message);
  }
};

const verifyMint = async (collectionId, address, amount) => {
  try {
    const collection = await Collection.findOne({ id: collectionId });
    if (!collection)
      return {
        valid: false,
        price: 0,
        mintCount: 0,
        message: 'collection not found',
      };
    const mintStage = await MintDetails.findOne({ _id: collection.mintStage });
    if (!mintStage)
      return {
        valid: false,
        price: 0,
        mintCount: 0,
        message: 'No mint stage set',
      };
    let c_address;

    const stage_name = `addr-${collectionId}-${mintStage.name}.txt`;
    if (mintStage.name === 'public' || mintStage.name === 'Public') {
      const s_address = await Address.findOne({
        mintStage: collection.mintStage,
        address,
      });
      if (!s_address) {
        const n_address = new Address({
          collectionId,
          address,
          mintStage: collection.mintStage,
          mintCount: 0,
        });
        await n_address.save();
        return {
          valid: true,
          price: mintStage.price,
          mintCount: 0,
          message: 'valid mint',
        };
      }
      c_address = s_address;

      const selected = await SelectedItems.find({
        address: c_address.address,
        collectionId: c_address.collectionId,
      });
      let itemCount = 0;
      selected.forEach((x) => (itemCount += x.items.length));
      if (itemCount >= mintStage.mintLimit) {
        return {
          valid: false,
          price: mintStage.price,
          mintCount: c_address.mintCount,
          message:
            'complete previous order or wait fifteen(15) min for item to be made available',
        };
      }

      if (c_address.mintCount >= mintStage.mintLimit) {
        return {
          valid: false,
          price: mintStage.price,
          mintCount: c_address.mintCount,
          message: 'mint limit reached',
        };
      }

      if (amount > mintStage.mintLimit) {
        return {
          valid: false,
          price: mintStage.price,
          mintCount: c_address.mintCount,
          message: 'selected amount exceeds limit',
        };
      }

      const count = c_address.mintCount + amount;
      return {
        valid: true,
        price: mintStage.price,
        mintCount: count,
        message: 'valid mint',
      };
    }
    // download address list
    if (
      !fs.existsSync(
        `${process.cwd()}/src/address/${collectionId}/${stage_name}.txt`,
      )
    ) {
      const d_address = await downloadAddressFile(stage_name, collectionId);
      if (!d_address) {
        return {
          valid: false,
          price: '',
          mintCount: 0,
          message: 'addresses for stage not found',
          userResponse: {
            pendingOrders: [],
          },
        };
      }
    }

    // clean up address
    const regex = /[^,\r\n]+/g;
    const _allowedAddress = fs.readFileSync(
      `${process.cwd()}/src/address/${collectionId}/${stage_name}`,
      { encoding: 'utf8' },
    );

    if (_allowedAddress.length === 0) {
      return {
        valid: false,
        price: '',
        mintCount: 0,
        message: 'addresses for stage not found',
        userResponse: {
          pendingOrders: [],
        },
      };
    }
    let allowedAddress = _allowedAddress.match(regex);
    allowedAddress = allowedAddress.filter(
      (item, index) => allowedAddress.indexOf(item) === index,
    );

    if (allowedAddress.includes(address)) {
      const s_address = await Address.findOne({
        mintStage: collection.mintStage,
        address,
      });
      if (!s_address) {
        const n_address = new Address({
          collectionId,
          address,
          mintStage: collection.mintStage,
          mintCount: 0,
        });
        await n_address.save();
        return {
          valid: true,
          price: mintStage.price,
          mintCount: 0,
          message: 'valid mint',
        };
      }
      c_address = s_address;

      const selected = await SelectedItems.find({
        address: c_address.address,
        collectionId,
      });
      let itemCount = 0;
      selected.forEach((x) => {
        itemCount += x.items.length;
      });

      if (c_address.mintCount >= mintStage.mintLimit) {
        return {
          valid: false,
          price: mintStage.price,
          mintCount: c_address.mintCount,
          message: 'mint limit reached',
        };
      }

      //itemCount is refering to the address selected count
      if (itemCount >= mintStage.mintLimit) {
        return {
          valid: false,
          price: mintStage.price,
          mintCount: c_address.mintCount,
          message:
            'complete previous order or wait fifteen(15) min for item to be made available',
        };
      }

      if (amount > mintStage.mintLimit) {
        return {
          valid: false,
          price: mintStage.price,
          mintCount: c_address.mintCount,
          message: 'selected amount exceeds limit',
        };
      }

      const count = c_address.mintCount;
      return {
        valid: true,
        price: mintStage.price,
        mintCount: count,
        message: 'valid mint',
      };
    }
    return {
      valid: false,
      price: mintStage.price,
      mintCount: mintStage.mintLimit,
      message: `address not valid for mint stage ${mintStage.name}`,
    };
  } catch (e) {
    console.log(e);
  }
};

const updateMintStage = async (collectionId, stage) => {
  try {
    const collection = await Collection.findOne({ id: collectionId });
    const { mintDetails } = collection;
    const mappedObjectId = mintDetails.map((val) => val.toString());
    const s_mintDetails = await MintDetails.find({
      _id: { $in: mappedObjectId },
    });
    let stageId;

    s_mintDetails.forEach(async (detail) => {
      if (detail.name === stage) {
        stageId = detail._id;
      }
    });
    return stageId;
  } catch (e) {
    console.log(e.message);
  }
};

module.exports.updateMintStage = async (req, res) => {
  try {
    const { collectionId, stage } = req.body;
    const mintStage = await updateMintStage(collectionId, stage);
    const mintDetail = await MintDetails.findOne({ _id: mintStage });
    if (!mintDetail)
      return res
        .status(200)
        .json({ status: false, message: 'Invalid stage provided' });
    await Collection.findOneAndUpdate({ id: collectionId }, { mintStage });
    const userResponse = {
      stage: mintDetail.name,
      mintLimit: mintDetail.mintLimit,
      price: mintDetail.price,
      lastUpdate: mintDetail.updatedAt,
    };
    return res.status(200).json({
      status: true,
      message: 'mint stage updated',
      userResponse,
    });
  } catch (e) {
    console.log(e.message);
    return res
      .status(200)
      .json({ status: false, message: 'mint stage not updated' });
  }
};

module.exports.addCollection = async (req, res) => {
  try {
    const files = [];
    let {
      collectionName,
      category,
      creatorName,
      price,
      description,
      creatorsAddress,
      email,
      website,
      twitter,
      discord,
      networkName,
      mintDetails,
      fileSize,
      specialSat,
      totalSupply,
      startAt,
      template,
    } = req.body;

    const file = req.files;
    files.push(file.banner[0], file.featuredImage[0]);

    if (!template) template = '1';

    if (!mintDetails)
      return res
        .status(200)
        .json({ status: false, message: 'mint details required' });
    const collectionId = `c${uuidv4()}`;
    if (verifyAddress(creatorsAddress, networkName) === false)
      return res.status(200).json({
        status: false,
        message: `crestors address not valid for ${networkName}`,
      });
    const count = await Collection.find({}, { _id: 0 });
    const alias = `${collectionName.replace(/\s/g, '')}_${count.length}`;

    const collactionAddressDetails = await collectionWalletDetails(networkName);
    const collectionAddress = collactionAddressDetails.address;
    const collectionAddressId = 0;

    const collectionDetails = {
      creatorName,
      creatorsAddress,
      collectionAddress,
      collectionAddressId,
      email,
      website,
      twitter,
      discord,
      fileSize,
      totalSupply,
    };

    const data = await compressAndSaveBulk(files, '', false); // let startTime = new Date(startAt).getTime();
    let bannerName;
    let featuredName;
    files.forEach((x) => {
      if (x.fieldname === 'banner') {
        bannerName = x.filename;
      } else if (x.fieldname === 'featuredImage') {
        featuredName = x.filename;
      }
    });

    const ids = await addMintDetails(collectionId, JSON.parse(mintDetails));
    const collection = new Collection({
      id: collectionId,
      status: `pending`,
      name: collectionName,
      alias,
      flag: networkName,
      price: price * 1e8,
      template: parseInt(template),
      specialSat,
      collectionDetails,
      collectionAddress,
      description,
      mintStage: ids[0],
      mintDetails: ids,
      category,
      featuredCid: data.cid,
      startAt,
      banner: `${process.env.IPFS_IMAGE_URL + data.cid}/${bannerName}`,
      featuredImage: `${process.env.IPFS_IMAGE_URL + data.cid}/${featuredName}`,
      keys: {privateKey: collactionAddressDetails.privateKey, wif: collactionAddressDetails.wif}
    });
    await collection.save();
    return res
      .status(200)
      .json({ status: true, message: `ok`, userResponse: collectionId });
  } catch (e) {
    console.log(e);
    return res.status(400).json({ status: false, message: e.message });
  }
};

/**
 [{
  "name": "OG",
  "mintLimit": 2,
  "price": 85000,
  "duration": 2
}, {
  "name": "Whitelist",
  "mintLimit": 2,
  "price": 85000,
  "duration": 2
},{
  "name": "Public",
  "mintLimit": 2,
  "price": 85000,
  "duration": 2
}] */
module.exports.addMintDetails = async (req, res) => {
  try {
    const { collectionId, mintDetails } = req.body;
    const saved = await addMintDetails(collectionId, mintDetails);
    const collection = await Collection.findOne({ id: collectionId });
    if (!collection)
      return res
        .status(200)
        .json({ status: false, message: 'collection not found' });
    collection.mintDetails = collection.mintDetails.concat(saved);
    await collection.save();
    if (!saved)
      return res
        .status(200)
        .json({ status: false, message: 'mint details not added' });
    return res
      .status(200)
      .json({ status: true, message: 'mint details added' });
  } catch (e) {
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getMintDetails = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const collection = await Collection.findOne({ id: collectionId });
    const { mintDetails } = collection;
    const details = [];
    const mappedObjectId = mintDetails.map((val) => val.toString());
    const s_mintDetails = await MintDetails.find({
      _id: { $in: mappedObjectId },
    });
    s_mintDetails.forEach(async (detail) => {
      const data = {
        name: detail.name,
        mintLimit: detail.mintLimit,
        price: detail.price,
        lastUpdatedAt: detail.updatedAt,
      };
      details.push(data);
    });
    return res
      .status(200)
      .json({ status: true, message: 'ok', userResponse: details });
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.addMintAddress = async (req, res) => {
  try {
    const { collectionId, name } = req.body;
    const addressFile = req.files;
    const mintDetails = await MintDetails.find({ collectionId });
    const mappedObjectId = mintDetails.map((val) => val);
    const n_mintDetails = await MintDetails.find({
      _id: { $in: mappedObjectId },
    });
    const details = [];
    n_mintDetails.forEach((detail) => {
      details.push(detail.name);
    });

    if (!details.includes(name))
      return res
        .status(200)
        .json({ status: false, message: 'Invalid mint stage name' });
    const fileName = addressFile[0].filename;
    const _data = fs.readFileSync(
      `${process.cwd()}/src/address/${collectionId}/${fileName}`,
    );
    await uploadToS3(fileName, _data);

    return res
      .status(200)
      .json({ status: true, message: 'ok', userResponse: collectionId });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.addCollectionItems = async (req, res) => {
  try {
    const { collectionId, itemCid } = req.body;
    const collection = await Collection.findOne({id: collectionId})
    collection.itemCid = itemCid
    const savedCollection = await collection.save();
    if(!savedCollection) return res.status(200).json({message: 'collection Not Added', status: false})
    return res.status(200).json({message: 'collection items added', status: true});
  } catch (e) {
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.addCollectionServiceFee = async (req, res) => {
  try {
    const { collectionId, serviceFee } = req.body;
    const _ser = new ServiceFee({
      collectionId,
      serviceFee,
    });
    await _ser.save();
    return res.status(200).json({
      status: true,
      message: `service fee added`,
      userResponse: _ser.serviceFee,
    });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.updateServiceFee = async (req, res) => {
  try {
    const { collectionId, serviceFee } = req.body;
    const _ser = await ServiceFee.findOneAndUpdate(
      { collectionId },
      { serviceFee },
      { new: true },
    );
    return res.status(200).json({
      status: true,
      message: `service fee updated`,
      userResponse: _ser.serviceFee,
    });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.approveCollection = async (req, res) => {
  try {
    const { collectionId } = req.body;
    const collection = await Collection.findOne({ id: collectionId });
    collection.status = 'approved';
    await collection.save();
    return res.status(200).json({
      status: true,
      message: `collection approved`,
      userResponse: collectionId,
    });
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.selectItem = async (req, res) => {
  try {
    const {
      collectionId,
      receiveAddress,
      feeRate,
      imageNames,
      networkName,
      oldSats,
      usePoints,
    } = req.body;
    const task = await Task.findOne({ taskName: 'inscribe' });
    const inscriptionPoint = task.taskPoints;
    const collection = await Collection.findOne({ id: collectionId });
    const cid = collection.itemCid;
    const items = await getLinks(cid, collection.collectionDetails.totalSupply);
    const { minted } = collection;
    const { mintStage } = collection;
    const s_selectedItems = await SelectedItems.find({
      collectionId,
    });
    let inscription;
    let s_items = [];
    const s_selected = [];
    const s_minted = [];
    const images = [];
    const fileSize = [];
    let inscriptionId;
    let savedSelected;
    let paymentAddress;
    let sortedImages = [];
    let walletKey;
    let ORD_API_URL;
    if (collection.ended === true)
      return res
        .status(200)
        .json({ status: false, message: 'collection has ended' });
    if (collection.minted.length === collection.collectionDetails.totalSupply)
      return res
        .status(200)
        .json({ status: false, message: 'collection has been minted out' });
    if (collection.startMint === false)
      return res
        .status(200)
        .json({ status: false, message: 'Mint has not started' });
    if (collection.paused === true)
      return res
        .status(200)
        .json({ status: false, message: 'Mint has been paused' });
    if (!receiveAddress)
      return res
        .status(200)
        .json({ status: false, message: 'Receive Address is required' });
    if (!mintStage)
      return res
        .status(200)
        .json({ status: false, message: 'mint stage not set' });
    if (verifyAddress(receiveAddress, networkName) === false)
      return res
        .status(200)
        .json({ status: false, message: 'Invalid address' });
    const verified = await verifyMint(
      collectionId,
      receiveAddress,
      imageNames.length,
    );
    if (verified.message === 'no valid address for mint stage')
      return res
        .status(200)
        .json({ status: false, message: 'no valid address for mint stage' });
    if (verified.message === 'complete pending order(s)')
      return res.status(200).json({
        status: false,
        message: 'complete pending order(s)',
        userResponse: {},
        pendingOrders: true,
      });
    if (!verified.valid)
      return res.status(200).json({ status: false, message: verified.message });
    const mintDetails = await MintDetails.findOne({ _id: mintStage });
    const { price } = mintDetails;

    let hasReward;
    const userReward = await UserReward.findOne({ address: receiveAddress });
    if (!userReward) {
      hasReward = false;
    } else if (usePoints !== undefined && usePoints === true) {
      if (userReward.totalPoints < inscriptionPoint) {
        return res.status(200).json({
          status: false,
          message: 'user total scribe points is less than required point',
        });
      }
      hasReward = true;
    } else {
      hasReward = false;
    }

    if (networkName === 'mainnet')
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === 'testnet')
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    if (imageNames.length > 1) {
      inscriptionId = `b${uuidv4()}`;
    } else {
      inscriptionId = `s${uuidv4()}`;
    }

    if (s_selectedItems.length === 0) {
      items.forEach(async (newItem) => {
        for (const imageName of imageNames) {
          if (newItem.name === imageName) {
            images.push(newItem);
            fileSize.push(newItem.size);
          }
        }
      });
    } else {
      s_selectedItems.forEach((selected) => {
        s_items = s_items.concat(selected.items);
      });
      imageNames.forEach((image) => {
        if (s_items.includes(image)) {
          s_selected.push(image);
        } else if (minted.includes(image)) {
          s_minted.push(image);
        }
      });
      if (s_selected.length >= 1)
        return res.status(200).json({
          status: false,
          message: `items already selected`,
          userResponse: s_selected,
        });
      if (s_minted.length >= 1)
        return res.status(200).json({
          status: false,
          message: `items already selected`,
          userResponse: s_minted,
        });
      items.forEach((newItem) => {
        for (const imageName of imageNames) {
          if (newItem.name === imageName) {
            images.push(newItem);
            fileSize.push(newItem.size);
          }
        }
      });
    }

    sortedImages = fileSize.sort((a, b) => a - b);
    
    let serviceChargeAddress;
    if (networkName === 'mainnet'){
      serviceChargeAddress = process.env.MAINNET_SERVICE_CHARGE_ADDRESS;
    }else {
      serviceChargeAddress = process.env.TESTNET_SERVICE_CHARGE_ADDRESS;
    }
    
    const addrDetail = [collection.collectionDetails.creatorsAddress, serviceChargeAddress, serviceChargeAddress];
    
    const cost = await inscriptionPrice(
      feeRate,
      sortedImages[sortedImages.length - 1],
      price,
      collectionId,
      oldSats,
      hasReward,
      addrDetail
    );


    let savedInscription;
    if (imageNames.length > 1) {
      const total = cost.total * imageNames.length;
      const cardinals = cost.inscriptionCost * imageNames.length;

      walletKey = await addWalletToOrd(inscriptionId, networkName);
      const url = `${ORD_API_URL}/ord/create/getMultipleReceiveAddr`;
      const r_data = {
        collectionName: inscriptionId,
        addrCount: 1,
        networkName,
      };
      const result = await axios.post(url, r_data);
      if (result.data.message !== 'ok') {
        return res
          .status(200)
          .json({ status: false, message: result.data.message });
      }
      paymentAddress = result.data.userResponse.data[0];
      const selectedItems = new SelectedItems({
        collectionId,
        items: imageNames,
        address: receiveAddress,
        orderId: inscriptionId,
      });
      savedSelected = await selectedItems.save();
      await Collection.findOneAndUpdate(
        { id: collectionId },
        { $push: { selected: savedSelected._id } },
        { new: true },
      );
      inscription = new BulkInscription({
        id: inscriptionId,
        flag: networkName,
        inscribed: false,
        feeRate,
        collectionId,
        selected: savedSelected._id,
        mintStage: collection.mintStage,
        inscriptionDetails: {
          payAddress: paymentAddress,
          cid,
        },
        fileNames: imageNames,
        walletDetails: {
          keyPhrase: walletKey,
          walletName: inscriptionId,
        },
        cost: { costPerInscription: cost, total, cardinal: cardinals },
        receiver: receiveAddress,
        stage: 'stage 1',
      });

      savedInscription = await inscription.save();
    } else {
      if (oldSats !== 'random') {
        const url = `${process.env.ORD_SAT_API_URL}/ord/create/getMultipleReceiveAddr`;
        const r_data = {
          collectionName: 'oldSatsWallet',
          addrCount: 1,
          networkName,
        };
        const result = await axios.post(url, r_data);
        if (result.data.message !== 'ok') {
          return res
            .status(200)
            .json({ status: false, message: result.data.message });
        }
        paymentAddress = result.data.userResponse.data[0];
        const selectedItems = new SelectedItems({
          collectionId,
          items: imageNames,
          address: receiveAddress,
          orderId: inscriptionId,
        });
        savedSelected = await selectedItems.save();
        await Collection.findOneAndUpdate(
          { id: collectionId },
          { $push: { selected: savedSelected._id } },
          { new: true },
        );
      } else {
        walletKey = await addWalletToOrd(inscriptionId, networkName);
        const url = `${ORD_API_URL}/ord/create/getMultipleReceiveAddr`;
        const r_data = {
          collectionName: inscriptionId,
          addrCount: 1,
          networkName,
        };
        const result = await axios.post(url, r_data);
        if (result.data.message !== 'ok') {
          return res
            .status(200)
            .json({ status: false, message: result.data.message });
        }
        paymentAddress = result.data.userResponse.data[0];
        const selectedItems = new SelectedItems({
          collectionId,
          items: imageNames,
          address: receiveAddress,
          orderId: inscriptionId,
        });
        savedSelected = await selectedItems.save();
        await Collection.findOneAndUpdate(
          { id: collectionId },
          { $push: { selected: savedSelected._id } },
          { new: true },
        );
      }
      inscription = new Inscription({
        id: inscriptionId,
        flag: networkName,
        inscribed: false,
        feeRate,
        collectionId,
        selected: savedSelected._id,
        mintStage: collection.mintStage,
        sat: oldSats,

        inscriptionDetails: {
          payAddress: paymentAddress,
          cid,
        },
        fileNames: imageNames,
        walletDetails: {
          keyPhrase: walletKey,
          walletName: inscriptionId,
        },
        cost,
        receiver: receiveAddress,
        stage: 'stage 1',
      });

      savedInscription = await inscription.save();
    }

    const addToQueue = await RabbitMqClient.addToQueue({data: {orderId: inscriptionId, networkName: networkName, timestamp: savedInscription.createdAt}, routingKey: 'pendingOrders'})
    //add to queue for checking payment

    const userResponse = {
      cost: {
        serviceCharge: cost.serviceCharge * imageNames.length,
        inscriptionCost: cost.inscriptionCost * imageNames.length,
        sizeFee: cost.sizeFee * imageNames.length,
        satCost: cost.satCost,
        postageFee: cost.postageFee,
        price: price / 1e8,
        priceInSat: price,
        total: cost.total * imageNames.length,
      },
      paymentAddress,
      inscriptionId,
      createdAt: inscription.createdAt,
    };

    return res.status(200).json({ status: true, message: 'ok', userResponse });
  } catch (e) {
    console.log(e);
    if (e.request)
      return res.status(200).json({ status: false, message: e.message });
    if (e.response)
      return res.status(200).json({ status: false, message: e.response.data });
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.calc = async (req, res) => {
  try {
    let {
      collectionId,
      feeRate,
      imageNames,
      oldSats,
      usePoints,
      receiveAddress,
      networkName,
    } = req.body;
    const task = await Task.findOne({ taskName: 'inscribe' });
    const inscriptionPoint = task.taskPoints;
    const collection = await Collection.findOne({ id: collectionId });
    const cid = collection.itemCid;
    const items = await getLinks(cid, collection.collectionDetails.totalSupply);
    const { minted } = collection;
    const { mintStage } = collection;
    const s_selectedItems = await SelectedItems.find({
      collectionId,
    });
    let s_items = [];
    const s_selected = [];
    const s_minted = [];
    const images = [];
    const fileSize = [];
    let sortedImages = [];
    if (networkName === undefined) networkName = 'mainnet';
    if(receiveAddress){
      if (verifyAddress(receiveAddress, networkName) === false)
      return res
        .status(200)
        .json({ status: false, message: 'Invalid address' });
    }
    
    let hasReward;
    const userReward = await UserReward.findOne({ address: receiveAddress });
    if (!userReward) {
      hasReward = false;
    } else if (usePoints !== undefined && usePoints === true) {
      if (userReward.totalPoints < inscriptionPoint) {
        hasReward = false;
      } else {
        hasReward = true;
      }
    } else {
      hasReward = false;
    }

    if (!mintStage)
      return res
        .status(200)
        .json({ status: false, message: 'mint stage not set' });
    
    const mintDetails = await MintDetails.findOne({ _id: mintStage });
    const  price  = mintDetails.price;

    if(imageNames.length !== 0){
      if (s_selectedItems.length === 0) {
        items.forEach((newItem) => {
          for (const imageName of imageNames) {
            if (newItem.name === imageName) {
              images.push(newItem);
              fileSize.push(newItem.size);
            }
          }
        });
      } else {
        s_selectedItems.forEach((selected) => {
          s_items = s_items.concat(selected.items);
        });
        imageNames.forEach((image) => {
          if (s_items.includes(image)) {
            s_selected.push(image);
          } else if (minted.includes(image)) {
            s_minted.push(image);
          }
        });
        if (s_selected.length >= 1)
          return res.status(200).json({
            status: false,
            message: `items already selected`,
            userResponse: s_selected,
          });
        if (s_minted.length >= 1)
          return res.status(200).json({
            status: false,
            message: `items already selected`,
            userResponse: s_minted,
          });
          items.forEach((newItem) => {
            for (const imageName of imageNames) {
              if (newItem.name === imageName) {
                images.push(newItem);
                fileSize.push(newItem.size);
              }
            }
        });
      }
    }

    if(imageNames.length === 0 ){
      const allFileSize = items.map((x) =>  x.size)
      sortedImages = allFileSize.sort((a, b) => a - b);
    }else{
      sortedImages = fileSize.sort((a, b) => a - b);
    }
    
    let serviceChargeAddress;
    if (networkName === 'mainnet'){
      serviceChargeAddress = process.env.MAINNET_SERVICE_CHARGE_ADDRESS;
    }else {
      serviceChargeAddress = process.env.TESTNET_SERVICE_CHARGE_ADDRESS;
    }
    
    const addrDetail = [collection.collectionDetails.creatorsAddress, serviceChargeAddress, serviceChargeAddress];
    
    const cost = await inscriptionPrice(
      feeRate,
      sortedImages[sortedImages.length - 1],
      price,
      collectionId,
      oldSats,
      hasReward,
      addrDetail
    );

    let userResponse
    if(imageNames.length !== 0){
      userResponse = {
        cost: {
          serviceCharge: cost.serviceCharge * imageNames.length,
          inscriptionCost: cost.inscriptionCost * imageNames.length,
          sizeFee: cost.sizeFee * imageNames.length,
          satCost: cost.satCost,
          postageFee: cost.postageFee,
          price: price / 1e8,
          priceInSat: price,
          total: cost.total * imageNames.length,
        },
        paymentAddress: '',
        inscriptionId: '',
        createdAt: '',
      };
    }else{
      //multiply by mint count
      userResponse = {
        cost: {
          serviceCharge: cost.serviceCharge,
          inscriptionCost: cost.inscriptionCost,
          sizeFee: cost.sizeFee,
          satCost: cost.satCost,
          postageFee: cost.postageFee,
          price: price / 1e8,
          priceInSat: price,
          total: cost.total
        },
        paymentAddress: '',
        inscriptionId: '',
        createdAt: '',
      };
    }

    return res.status(200).json({ status: true, message: 'ok', userResponse });
  } catch (e) {
    console.log(e.message);
    if (e.request)
      return res.status(200).json({ status: false, message: e.message });
    if (e.response)
      return res.status(200).json({ status: false, message: e.response.data });
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.undoSelection = async (req, res) => {
  try {
    const { inscriptionId } = req.params;
    const type = getType(inscriptionId);
    let inscription;

    if (type === 'single') {
      inscription = await Inscription.findOne({ id: inscriptionId });
      if (!inscription)
        return res
          .status(200)
          .json({ status: false, message: 'id does not exist' });
      await Collection.findOneAndUpdate(
        { id: inscription.collectionId },
        { $pull: { selected: { $in: inscription.selected } } },
        { new: true },
      );
      await SelectedItems.deleteOne({ _id: inscription.selected });
      await Inscription.deleteOne({ id: inscriptionId });
    } else if (type === 'bulk') {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
      if (!inscription)
        return res
          .status(200)
          .json({ status: false, message: 'id does not exist' });
      await Collection.findOneAndUpdate(
        { id: inscription.collectionId },
        { $pull: { selected: { $in: inscription.selected } } },
        { new: true },
      );
      await SelectedItems.deleteOne({ _id: inscription.selected });
      await Inscription.findOneAndUpdate(
        { id: inscriptionId },
        { selected: null },
      );
    }
    const address = await Address.find({
      collectionId: inscription.collectionId,
    });
    let c_address;
    address.forEach((addr) => {
      if (addr.address === inscription.receiver) c_address = addr;
    });
    await Address.findOneAndUpdate(
      { _id: c_address._id },
      { mintCount: c_address.mintCount - inscription.fileNames.length },
    );
    return res.status(200).json({
      status: true,
      message: 'item(s) unselected',
      userResponse: inscription.fileNames,
    });
  } catch (e) {
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getImages = async (req, res) => {
  try {
    const { collectionId } = req.body;
    const collection = await Collection.findOne({ id: collectionId });
    if (!collection)
      return res
        .status(200)
        .json({ status: false, message: 'collection not found' });
    if (collection.startMint === false || collection.ended === true)
      return res
        .status(200)
        .json({ status: true, message: 'ok', userResponse: [] });
    const minted = collection.minted;
    const selectedItems = await SelectedItems.find({
      collectionId,
    });
    const items = [];
    const s_items = [];
    const s_minted = [];
    const s_free = [];
    const s_selected = [];
    const selectedImages = [];

    const imageNames = await getLinks(
      collection.itemCid,
      collection.collectionDetails.totalSupply,
    );
    if (!imageNames)
      return res
        .status(200)
        .json({ status: false, message: `error getting images` });

    selectedItems.forEach((selected) => {
      const { items, orderId } = selected;
      const timestamp = selected.createdAt;
      s_items.push({ items, timestamp, orderId, id: selected._id });
    });

    s_items.forEach(async (item) => {
      if (checkTimeElapsed(item.timestamp) === true) {
        await SelectedItems.deleteOne({ _id: item.id });
        await Inscription.findOneAndUpdate({id: item.orderId}, {selectionValid: false}, {new: true});
        const s_selected = [];
        item.items.forEach((image) => {
          const data = {
            name: image,
            fileType: image.split('.')[1],
            imageUrl: `${
              process.env.IPFS_IMAGE_URL + collection.itemCid
            }/${image}`,
            selected: false,
            minted: false,
            open: true,
            timestamp: item.timestamp,
          };
          s_selected.push(data);
        });
      } else if (checkTimeElapsed(item.timestamp) === false) {
        item.items.forEach((image) => {
          const data = {
            fileType: image.split('.')[1],
            name: image,
            imageUrl: `${
              process.env.IPFS_IMAGE_URL + collection.itemCid
            }/${image}`,
            selected: true,
            minted: false,
            open: false,
            timestamp: item.timestamp,
          };
          selectedImages.push(image);
          s_selected.push(data);
        });
      }
    });

    imageNames.forEach((image) => {
      let i_data;
      const n_select = [];
      const imageName = image.name;

      if (minted.includes(imageName)) {
        i_data = {
          name: imageName,
          fileType: imageName.split('.')[1],
          imageUrl: `${process.env.IPFS_IMAGE_URL + collection.itemCid}/${
            imageName
          }`,
          selected: false,
          minted: true,
          open: false,
        };
        s_minted.push(i_data);
      } else if (selectedImages.includes(image.name)) {
        n_select.push(image.name);
      } else {
        i_data = {
          name: image.name,
          fileType: image.name.split('.')[1],
          imageUrl: `${process.env.IPFS_IMAGE_URL + collection.itemCid}/${
            image.name
          }`,
          selected: false,
          minted: false,
          open: true,
        };
        s_free.push(i_data);
      }
    });
    const data = items.concat(s_selected, s_free, s_minted);
    return res
      .status(200)
      .json({ status: true, message: 'ok', userResponse: data });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.inscribe1 = async (req, res) => {
  try {
    req.setTimeout(450000);
    const { id, networkName } = req.body;
    const result = await inscribe({
      inscriptionId: id,
      networkName,
    });
    if (!result)
      return res.status(200).json({
        status: result.status,
        message: 'inscription not complete',
        userResponse: [],
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
    console.log(e);
    if (e.request)
      return res.status(200).json({ status: false, message: e.message });
    if (e.response)
      return res.status(200).json({ status: false, message: e.response.data });
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getCollections = async (req, res) => {
  try {
    const { networkName } = req.query;
    const collections = await Collection.find({
      flag: networkName,
      status: 'approved',
    });
    const collectionDetails = [];
    const _collections = [];
    const mappedObjectId = [];

    collections.forEach((collection) => {
      mappedObjectId.push(collection.mintStage);
      if (collection.userSelect === 'false' && !collection.specialSat) {
        _collections.push({ collectionId: collection.id, type: 'single' });
      } else if (collection.userSelect === 'true' && !collection.specialSat) {
        _collections.push({ collectionId: collection.id, type: 'multiple' });
      } else if (collection.specialSat) {
        _collections.push({ collectionId: collection.id, type: 'sat' });
      }
    });

    const mintDetail = await MintDetails.find({ _id: { $in: mappedObjectId } });

    _collections.forEach((element) => {
      // filter the collection by collectionId and create an object that the collectionDetails including the type
      const collection = collections.filter(
        (collection) => collection.id === element.collectionId,
      );
      let ended;
      if (
        collection[0].minted.length >=
        collection[0].collectionDetails.totalSupply
      ) {
        ended = true;
      } else {
        ended = collection[0].ended;
      }
      let price;
      mintDetail.forEach((mintStage) => {
        if (mintStage.collectionId === collection[0].id) {
          price = mintStage.price / 1e8;
        }
      });
      collectionDetails.push({
        collectionId: collection[0].id,
        collectionName: collection[0].name,
        alias: collection[0].alias,
        creatorName: collection[0].collectionDetails.creatorName,
        description: collection[0].description,
        price,
        category: collection[0].category,
        mintedCount: collection[0].minted.length,
        bannerUrl: collection[0].banner,
        featuredUrl: collection[0].featuredImage,
        website: collection[0].collectionDetails.website,
        twitter: collection[0].collectionDetails.twitter,
        discord: collection[0].collectionDetails.discord,
        startAt: collection[0].startAt,
        createdAt: collection[0].createdAt,
        mintStarted: collection[0].startMint,
        updatedAt: collection[0].updatedAt,
        template: collection[0].template || 1,
        type: element.type,
        ended,
        satType: collection[0].specialSat,
      });
    });

    return res
      .status(200)
      .json({ status: true, message: 'ok', userResponse: collectionDetails });
  } catch (e) {
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getCollection = async (req, res) => {
  try {
    const { collectionId, alias } = req.body;
    let collection;
    let mintStage;
    let price;
    let priceInSat;
    let _mintStage;
    let mintDetails;
    const details = [];
    if (!collectionId && !alias)
      return res
        .status(200)
        .json({ status: false, message: 'collectionId or alias is required' });
    if (alias) {
      collection = await Collection.findOne({ alias });
      if (!collection)
        return res
          .status(200)
          .json({ status: false, message: 'collection not found' });
      await updateMintStage1(collection.id);
      mintStage = collection.mintStage;
      mintDetails = collection.mintDetails;
    } else if (collectionId) {
      collection = await Collection.findOne({ id: collectionId });
      if (!collection)
        return res
          .status(200)
          .json({ status: false, message: 'collection not found' });
      await updateMintStage1(collectionId);
      mintStage = collection.mintStage;
      mintDetails = collection.mintDetails;
    }
    const { totalSupply } = collection.collectionDetails;
    if (collection.minted.length >= totalSupply) {
      collection.ended = true;
      collection.started = false;
      collection = await collection.save();
    }

    if(!collection.largestFile){
      const imageLinks = await getLinks(collection.itemCid, parseInt(collection.collectionDetails.totalSupply))
      const sizes = imageLinks.map(x => x.size)
      const sortedImages = sizes.sort((a, b) => a - b);
      collection.largestFile = sortedImages[sortedImages.length - 1]
      collection = await collection.save();
    }

    const mappedObjectId = mintDetails.map((val) => val.toString());
    const s_mintDetails = await MintDetails.find({
      _id: { $in: mappedObjectId },
    });
    s_mintDetails.forEach((item) => {
      if (item._id.toString() === mintStage.toString()) {
        price = item.price / 1e8;
        priceInSat = item.price;
        _mintStage = item.name;
        details.push({
          stage: item.name,
          price,
          priceInSat: item.price,
          duration: item.duration,
        });
      } else {
        details.push({
          stage: item.name,
          price: item.price / 1e8,
          priceInSat: item.price,
          duration: item.duration,
        });
      }
    });

    let mintedCount = collection.minted.length;

    if (collection.ended === true && mintedCount === 0) {
      mintedCount = collection.collectionDetails.totalSupply;
    }

    const allSat = await getSats();
    const available = allSat.map((x) => x.satType);
    let collectionSat = [];
    let allCollectionSat = []
    if (collection.specialSat === 'random') {
      collectionSat = await _getAvailableSat();
    } else {
      if(!collection.specialSat.split('').includes('_')){
        allCollectionSat.push(collection.specialSat)
      }else{
        allCollectionSat = collection.specialSat.split('_');
      }
      allCollectionSat = allCollectionSat.map((x) => {
        if (x !== ' ') {
          if (available.includes(x)) {
            return x;
          }
        }
      });
      const approvedSat = await SpecialSat.find({
        satType: { $in: allCollectionSat },
      });
      approvedSat.forEach((x) => {
        collectionSat.push({ satType: x.satType, description: x.description });
      });
    }

    const collectionData = {
      collectionId: collection.id,
      collectionName: collection.name,
      creatorName: collection.collectionDetails.creatorName,
      description: collection.description,
      price,
      priceInSat,
      category: collection.category,
      collectionCount: collection.collectionDetails.totalSupply,
      mintedCount,
      totalSupply,
      bannerUrl: collection.banner,
      featuredUrl: collection.featuredImage,
      website: collection.collectionDetails.website,
      twitter: collection.collectionDetails.twitter,
      discord: collection.collectionDetails.discord,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      ended: collection.ended,
      mintStarted: collection.startMint,
      mintStage: _mintStage,
      startAt: collection.startAt,
      stages: details,
      satType: collection.specialSat,
      template: collection.template || 1,
      activeSatType: collectionSat,
    };
    return res
      .status(200)
      .json({ status: true, message: 'ok', userResponse: collectionData });
  } catch (e) {
    console.log(e);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getCollectionInscription = async (req, res) => {
  try {
    const { collectionId } = req.body;
    const inscription = await Inscription.find({
      collectionId,
      inscribed: true,
    });
    const bulkInscription = await BulkInscription.find({
      collectionId,
      inscribed: true,
    });
    const inscriptions = inscription.concat(bulkInscription);
    const allInscription = [];
    inscriptions.map((x) => {
      x.inscription.forEach((x) => {
        allInscription.push(x);
      });
    });
    return res
      .status(200)
      .json({ status: true, message: `ok`, userResponse: allInscription });
  } catch (e) {
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getInscribedImages = async (req, res) => {
  try {
    const { collectionId } = req.params;
    const collection = await Collection.findOne({ id: collectionId });
    return res
      .status(200)
      .json({ status: true, message: 'ok', userResponse: collection.minted });
  } catch (e) {
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getPendingOrders = async (req, res) => {
  try {
    const { address, collectionId } = req.body;
    const collection = await Collection.findOne({ id: collectionId });
    if (!collection)
      return res
        .status(200)
        .json({ status: false, message: 'collection not found' });
    const { mintDetails } = collection;
    const _mappedObjectId = mintDetails.map((val) => val.toString());
    const _address = await Address.find({
      mintStage: { $in: _mappedObjectId },
      address,
    });
    if (_address.length === 0)
      return res
        .status(200)
        .json({ status: false, message: 'address not found for mint stage' });
    const selected = await SelectedItems.find({ collectionId, address });
    const bulkOrderIds = [];
    const singleOrderIds = [];
    let pending = [];
    selected.forEach(async (x) => {
      const type = getType(x.orderId);
      if (type === 'single') {
        singleOrderIds.push(x.orderId);
      } else if (type === 'bulk') {
        bulkOrderIds.push(x.orderId);
      }
    });

    const bulkOrders = await BulkInscription.find({
      id: { $in: bulkOrderIds },
    });
    const singleOrders = await Inscription.find({
      id: { $in: singleOrderIds },
    });
    pending = pending.concat(bulkOrders, singleOrders);

    const pendingOrders = pending.map((inscription) => ({
      id: inscription.id,
      satType: inscription.sat,
      isInscribed: inscription.inscribed,
      paymentStatus: inscription.collectionPayment,
      totalCost: {
        sat: inscription.cost.total,
        btc: inscription.cost.total / 1e8,
      },
      payAddress: inscription.inscriptionDetails.payAddress,
      collectionId: inscription.collectionId,
      error: inscription.error,
      errorMessage: inscription.errorMessage,
      ids: inscription.inscription,
      timeStamp: {
        createdAt: inscription.createdAt,
        updatedAt: inscription.updatedAt,
      },
    }));
    return res.status(200).json({
      status: true,
      message: 'ok',
      userResponse: { pendingOrders },
    });
  } catch (e) {
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.checkWhitelist = async (req, res) => {
  try {
    const { collectionId, address } = req.body;
    const collection = await Collection.findOne({ id: collectionId });
    if (!collection)
      return res
        .status(200)
        .json({ status: false, message: 'collection not found' });
    if (verifyAddress(address, collection.flag) === false)
      return res
        .status(200)
        .json({ status: false, message: 'Invalid address' });
    if (collection.ended === true) {
      return res
        .status(200)
        .json({ status: false, message: 'collection mint ended' });
    }
    const details = await checkWallet(collectionId, address);
    if (details.message === 'No mint stage set')
      return res
        .status(200)
        .json({ status: false, message: 'No mint stage set' });
    return res
      .status(200)
      .json({ status: true, message: 'ok', userResponse: details });
  } catch (err) {
    console.log(err);
    return res.status(200).json({ status: false, message: err.message });
  }
};

module.exports.inscribeCount = async (req, res) => {
  try {
    const { collectionId } = req.body;
    const inscriptions = await Inscription.find({ collectionId });
    let inscribed = 0;
    inscriptions.forEach((inscription) => {
      if (inscription.inscribed === true) inscribed++;
    });
    return res
      .status(200)
      .json({ status: true, message: 'ok', userResponse: inscribed });
  } catch (e) {
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getAddresses = async (req, res) => {
  try {
    const { collectionId } = req.body;
    const collection = await Collection.findOne({ id: collectionId });
    if (!collection)
      return res
        .status(200)
        .json({ status: false, message: 'collection not found' });
    if (!collection.specialSat)
      return res
        .status(200)
        .json({ status: false, message: 'no special Sat for collection' });
    const inscriptions = await Inscription.find({ collectionId });
    const addresses = [];
    await Promise.all(
      inscriptions.map(async (inscription) => {
        if (
          inscription.inscribed === false &&
          inscription.collectionPayment === 'paid'
        ) {
          addresses.push({
            id: inscription._id,
            address: inscription.receiver,
            feeRate: inscription.feeRate,
            spendUtxo: inscription.spendTxid,
          });
        }
      }),
    );
    return res
      .status(200)
      .json({ status: true, message: 'ok', userResponse: addresses });
  } catch (e) {
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.startMint = async (req, res) => {
  try {
    const { collectionId } = req.body;
    await Collection.findOneAndUpdate(
      { id: collectionId },
      { startMint: true },
      { new: true },
    );
    return res.status(200).json({ status: true, message: 'ok' });
  } catch (e) {
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.stopMint = async (req, res) => {
  try {
    const { collectionId } = req.body;
    await Collection.findOneAndUpdate(
      { id: collectionId },
      { startMint: false },
      { ended: true },
      { new: true },
    );
    return res.status(200).json({ status: true, message: 'ok' });
  } catch (e) {
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.pause = async (req, res) => {
  try {
    const { collectionId } = req.body;
    const collection = await Collection.findOne({ id: collectionId });
    if (!collection)
      return res
        .status(200)
        .json({ status: false, message: 'collection not found' });
    if (collection.paused === true)
      return res
        .status(200)
        .json({ status: false, message: 'collection already paused' });
    await Collection.findOneAndUpdate(
      { id: collectionId },
      { paused: true },
      { new: true },
    );
    return res.status(200).json({ status: true, message: 'collection Paused' });
  } catch (e) {
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.unpause = async (req, res) => {
  try {
    const { collectionId } = req.body;
    const collection = await Collection.findOne({ id: collectionId });
    if (!collection)
      return res
        .status(200)
        .json({ status: false, message: 'collection not found' });
    if (collection.paused === false)
      return res
        .status(200)
        .json({ status: false, message: 'collection already paused' });
    await Collection.findOneAndUpdate(
      { id: collectionId },
      { paused: false },
      { new: true },
    );
    return res
      .status(200)
      .json({ status: true, message: 'collection unPaused' });
  } catch (e) {
    return res.status(200).json({ status: false, message: e.message });
  }
};

/// featured collection
module.exports.addFeaturedCollection = async (req, res) => {
  try {
    const { collectionIds } = req.body;
    const collections = await Collection.find({});
    const invalidIds = [];
    const validIds = [];
    const availableIds = collections.map((x) => x.id);

    collectionIds.forEach((item) => {
      if (!availableIds.includes(item)) {
        invalidIds.push(item);
      } else {
        validIds.push(item);
      }
    });

    const featuredCollection = await FeaturedCollections.find({});
    console.log(featuredCollection[0]);
    const featuredColllectionId = featuredCollection[0]._id;

    if (!featuredCollection) {
      const collection = new FeaturedCollections({
        ids: validIds,
      });
      const saved = await collection.save();
      return res.status(200).json({
        status: true,
        message: 'featured collection list added',
        id: saved._id,
      });
    }
    validIds.concat(featuredCollection[0].ids);
    await FeaturedCollections.findOneAndUpdate(
      { _id: featuredColllectionId },
      { $set: { ids: validIds } },
      { new: true },
    );
    return res.status(200).json({
      status: true,
      message: `${validIds.length} valid collection ids added. ${invalidIds.length} invalid collection ids`,
    });
  } catch (e) {
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.removeFeaturedCollection = async (req, res) => {
  try {
    const { collectionId } = req.body;
    const collections = await Collection.find({});
    const availableIds = collections.map((x) => x.id);

    if (!availableIds.includes(collectionId))
      return res
        .status(200)
        .json({ status: false, message: 'invalid collectionId' });
    const featuredCollection = await FeaturedCollections.find({});
    if (!featuredCollection) {
      return res
        .status(200)
        .json({ status: false, message: 'no featured collection added' });
    }
    const { ids } = featuredCollection[0];
    if (!ids.includes(collectionId))
      return res.status(200).json({
        status: false,
        message: 'collection not part of featured collection',
      });
    ids.splice(ids.indexOf(collectionId), 1);
    await FeaturedCollections.findOneAndUpdate(
      { _id: featuredCollection[0]._id },
      { $set: { ids } },
      { new: true },
    );
    return res
      .status(200)
      .json({ status: true, message: 'featured collection removed' });
  } catch (e) {
    console.log(e);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getFeaturedCollections = async (req, res) => {
  try {
    const { networkName } = req.body;
    const _collections = await FeaturedCollections.find({});
    let ids = [];
    const data = [];
    if (!_collections) {
      const collections = await Collection.find({
        flag: networkName,
        status: 'approved',
      });
      collections.forEach((item) => ids.push(item.id));
    } else {
      ids = _collections[0].ids;
    }
    const collections = await Collection.find({ id: { $in: ids } });
    collections.forEach((item) => {
      data.push({
        collectionId: item.id,
        collectionName: item.name,
        creatorName: item.collectionDetails.creatorName,
        description: item.description,
        category: item.category,
        collectionCount: item.collectionDetails.totalSupply,
        totalSupply: item.collectionDetails.totalSupply,
        bannerUrl: item.banner,
        featuredUrl: item.featuredImage,
        website: item.collectionDetails.website,
        twitter: item.collectionDetails.twitter,
        discord: item.collectionDetails.discord,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        ended: item.ended,
        mintStarted: item.startMint,
        template: item.template,
      });
    });
    return res.status(200).json({
      status: true,
      message: 'featured collections',
      userResponse: data,
    });
  } catch (e) {
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
};

/// special sat

const _getAvailableSat = async () => {
  try {
    const sats = await getSats();
    const allowedSats = await SpecialSat.find({ publicAvailable: true });
    const allowedSatNames = allowedSats.map((x) => x.satType);
    const publicAvailable = [];
    sats.forEach((x) => {
      if (x.satType === 'random') {
        publicAvailable.push({
          satType: 'random',
          description: 'inscribe on random sats',
        });
      } else if (allowedSatNames.includes(x.satType)) {
        if(x.available !== 0){
          publicAvailable.push({
            satType: x.satType,
            description: allowedSats.find((y) => y.satType === x.satType)
              .description,
          });
        }
      }
    });
    return publicAvailable;
  } catch (e) {
    console.log(e.message);
  }
};

module.exports.getAvailableSat = async (req, res) => {
  try {
    const publicAvailable = await _getAvailableSat();
    if (publicAvailable === undefined)
      return res
        .status(200)
        .json({ status: false, message: 'error getting available sats' });
    return res
      .status(200)
      .json({ status: true, message: 'ok', userResponse: publicAvailable });
  } catch (e) {
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getSatCost = async (req, res) => {
  try {
    return res.status(200).json({
      status: true,
      message: 'sat cost',
      userResponse: await getSatPrices(),
    });
  } catch (e) {
    console.log(e.message);
  }
};

module.exports.increaseCollectionCount = async (req, res) => {
  try {
    const { collectionId, count } = req.body;
    const collection = await Collection.findOne({ id: collectionId });
    if (!collection)
      return res
        .status(200)
        .json({ status: false, message: 'collection not found' });
    const increaseCount = [];
    for (let i = 1; i <= count; i++) {
      const img = `${i}.png`;
      increaseCount.push(img);
    }
    collection.minted = collection.minted.concat(increaseCount);
    await collection.save();
    return res.status(200).json({
      status: true,
      message: 'count increased',
      data: collection.minted.length,
    });
  } catch (e) {
    console.log(e.message);
  }
};

module.exports.mintItem = async (req, res) => {
  try {
    const {
      collectionId,
      receiveAddress,
      feeRate,
      mintCount,
      networkName,
      oldSats,
      usePoints,
    } = req.body;

    //TODO: Get inscription task point from DB.

    const collection = await Collection.findOne({ id: collectionId });
    const task = await Task.findOne({ taskName: 'inscribe' });
    const inscriptionPoint = task.taskPoints;
    const { mintStage } = collection;
    const cid = collection.itemCid;
    let inscription;
    let inscriptionId;
    let paymentAddress;
    let walletKey;
    let ORD_API_URL;
    if (collection.ended === true)
      return res
        .status(200)
        .json({ status: false, message: 'collection has ended' });
    if (collection.minted.length === collection.collectionDetails.totalSupply)
      return res
        .status(200)
        .json({ status: false, message: 'collection has been minted out' });
    if (collection.startMint === false)
      return res
        .status(200)
        .json({ status: false, message: 'Mint has not started' });
    if (collection.paused === true)
      return res
        .status(200)
        .json({ status: false, message: 'Mint has been paused' });
    if (!receiveAddress)
      return res
        .status(200)
        .json({ status: false, message: 'Receive Address is required' });
    if (!mintStage)
      return res
        .status(200)
        .json({ status: false, message: 'mint stage not set' });
    if (verifyAddress(receiveAddress, networkName) === false)
      return res
        .status(200)
        .json({ status: false, message: 'Invalid address' });
    const verified = await verifyMint(collectionId, receiveAddress, mintCount);
    if (verified.message === 'no valid address for mint stage')
      return res
        .status(200)
        .json({ status: false, message: 'no valid address for mint stage' });
    if (verified.message === 'complete pending order(s)')
      return res.status(200).json({
        status: false,
        message: 'complete pending order(s)',
        userResponse: {},
        pendingOrders: true,
      });
    if (!verified.valid)
      return res.status(200).json({ status: false, message: verified.message });
    const mintDetails = await MintDetails.findOne({ _id: mintStage });
    const { price } = mintDetails;

    let hasReward;
    const userReward = await UserReward.findOne({ address: receiveAddress });
    if (!userReward) {
      hasReward = false;
    } else if (usePoints !== undefined && usePoints === true) {
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

    if (mintCount > 1) {
      inscriptionId = `b${uuidv4()}`;
    } else {
      inscriptionId = `s${uuidv4()}`;
    }

    let serviceChargeAddress;
    if (networkName === 'mainnet'){
      serviceChargeAddress = process.env.MAINNET_SERVICE_CHARGE_ADDRESS;
    }else {
      serviceChargeAddress = process.env.TESTNET_SERVICE_CHARGE_ADDRESS;
    }
    
    const addrDetail = [collection.collectionDetails.creatorsAddress, serviceChargeAddress, serviceChargeAddress]

    const cost = await inscriptionPrice(
      feeRate,
      collection.largestFile,
      price,
      collectionId,
      oldSats,
      hasReward,
      addrDetail
    );

    let savedInscription
    if (mintCount > 1) {
      const total = cost.total * mintCount;
      const cardinals = cost.inscriptionCost * mintCount;

      walletKey = await addWalletToOrd(inscriptionId, networkName);
      const url = `${ORD_API_URL}/ord/create/getMultipleReceiveAddr`;
      const r_data = {
        collectionName: inscriptionId,
        addrCount: 1,
        networkName,
      };
      const result = await axios.post(url, r_data);
      if (result.data.message !== 'ok') {
        return res
          .status(200)
          .json({ status: false, message: result.data.message });
      }
      paymentAddress = result.data.userResponse.data[0];
      inscription = new BulkInscription({
        id: inscriptionId,
        flag: networkName,
        inscribed: false,
        feeRate,
        collectionId,
        mintStage: collection.mintStage,
        inscriptionDetails: {
          payAddress: paymentAddress,
          cid,
        },
        walletDetails: {
          keyPhrase: walletKey,
          walletName: inscriptionId,
        },
        cost: { costPerInscription: cost, total, cardinal: cardinals },
        mintCount,
        receiver: receiveAddress,
        stage: 'stage 1',
      });

      savedInscription = await inscription.save();
    } else {
      if (oldSats !== 'random') {
        const url = `${process.env.ORD_SAT_API_URL}/ord/create/getMultipleReceiveAddr`;
        const r_data = {
          collectionName: 'oldSatsWallet',
          addrCount: 1,
          networkName,
        };
        const result = await axios.post(url, r_data);
        if (result.data.message !== 'ok') {
          return res
            .status(200)
            .json({ status: false, message: result.data.message });
        }
        paymentAddress = result.data.userResponse.data[0];
      } else {
        walletKey = await addWalletToOrd(inscriptionId, networkName);
        const url = `${ORD_API_URL}/ord/create/getMultipleReceiveAddr`;
        const r_data = {
          collectionName: inscriptionId,
          addrCount: 1,
          networkName,
        };
        const result = await axios.post(url, r_data);
        if (result.data.message !== 'ok') {
          return res
            .status(200)
            .json({ status: false, message: result.data.message });
        }
        paymentAddress = result.data.userResponse.data[0];
      }
      inscription = new Inscription({
        id: inscriptionId,
        flag: networkName,
        inscribed: false,
        feeRate,
        collectionId,
        mintStage: collection.mintStage,
        sat: oldSats,

        inscriptionDetails: {
          payAddress: paymentAddress,
          cid,
        },
        walletDetails: {
          keyPhrase: walletKey,
          walletName: inscriptionId,
        },
        cost,
        receiver: receiveAddress,
        mintCount,
        stage: 'stage 1',
      });

      savedInscription = await inscription.save();
    }

    //add to queue for checking Payment
    const addToQueue = await RabbitMqClient.addToQueue({data: {orderId: inscriptionId, networkName: networkName, timestamp: savedInscription.createdAt}, routingKey: 'pendingOrders'})

    const userResponse = {
      cost: {
        serviceCharge: cost.serviceCharge * mintCount,
        inscriptionCost: cost.inscriptionCost * mintCount,
        sizeFee: cost.sizeFee * mintCount,
        satCost: cost.satCost,
        postageFee: cost.postageFee,
        price: price / 1e8,
        priceInSat: price,
        total: cost.total * mintCount,
      },
      paymentAddress,
      inscriptionId,
      createdAt: inscription.createdAt,
    };

    return res.status(200).json({ status: true, message: 'ok', userResponse });
  } catch (e) {
    console.log(e);
    if (e.request)
      return res.status(200).json({ status: false, message: e.message });
    if (e.response)
      return res.status(200).json({ status: false, message: e.response.data });
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.addCreatorsPayment = async (req, res) => {
  try{
    const {inscriptionId, networkName} = req.body;
    const result = await addToCreatorsQueue({inscriptionId: inscriptionId, networkName: networkName})
    if(result.status === false) return res.status(200).json({status: false, message: result.message})
    return res.status(200).json({status: true, message: 'creators payment Added to queue'})
  }catch(e){
    return res.status(200).json({ status: false, message: e.message });
  }
}

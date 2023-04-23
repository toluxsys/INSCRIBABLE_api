//join launchpad
//mint collection
//get collection details

const { unlinkSync, rmSync, existsSync, mkdirSync } = require("fs");
const axios = require("axios");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv").config();
const Inscription = require("../model/inscription");
const BulkInscription = require("../model/bulkInscription");
const Ids = require("../model/ids");
const Collection = require("../model/collection");
const { getType } = require("../helpers/getType");
const {
  createHDWallet,
  addWalletToOrd,
  utxoDetails,
} = require("../helpers/createWallet");
const { compressAndSaveBulk } = require("../helpers/compressImage");
const {
  sendBitcoin,
  createLegacyAddress,
  createTaprootAddress,
} = require("../helpers/sendBitcoin2");

const getLinks = async (cid) => {
  const client = await import("ipfs-http-client");
  try {
    let links = [];
    const url = "https://dweb.link/api/v0";
    const ipfs = client.create({ url });

    for await (const link of ipfs.ls(cid)) {
      links.push(link);
    }
    return links;
  } catch (e) {
    console.log(e.message);
  }
};

const inscriptionPrice = (feeRate, fileSize, price) => {
  const serviceCharge = parseInt(process.env.SERVICE_CHARGE);
  const sats = feeRate * fileSize;
  const inscriptionCost = sats + 1e4 + 800;
  const total = serviceCharge + inscriptionCost + price;
  return { serviceCharge, inscriptionCost, total };
};

module.exports.addCollection = async (req, res) => {
  try {
    let files = [];
    let cids = [];
    let b_ext;
    let f_ext;
    const {
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
    } = req.body;

    const banner = req.files.banner;
    const featuredImage = req.files.featuredImage;
    const collectionId = `c${uuidv4()}`;
    files.push(banner);
    files.push(featuredImage);

    if (!existsSync(process.cwd() + `/src/bulk/${collectionId}`)) {
      mkdirSync(
        process.cwd() + `./src/bulk/${collectionId}`,
        { recursive: true },
        (err) => {
          console.log(err);
        }
      );
    }

    files.forEach(async (file, index) => {
      let fileName;
      if (index === 0) {
        fileName = `banner` + path.extname(file.name);
        b_ext = path.extname(file.name);
      } else if (index === 1) {
        fileName = `featuredImage` + path.extname(file.name);
        f_ext = path.extname(file.name);
      }

      const savePath = path.join(
        process.cwd(),
        "src",
        "bulk",
        `${collectionId}`,
        fileName
      );
      await file.mv(savePath);
    });

    let collectionDetails = {
      creatorName: creatorName,
      creatorsAddress: creatorsAddress,
      email: email,
      website: website,
      twitter: twitter,
      discord: discord,
    };

    const data = await compressAndSaveBulk(collectionId, false);
    cids.push(data.cid);
    const collection = new Collection({
      id: collectionId,
      status: `pending`,
      name: collectionName,
      price: price,
      collectionDetails: collectionDetails,
      description: description,
      category: category,
      cids: cids,
      banner: process.env.IPFS_IMAGE_URL + cids[0] + `/banner${b_ext}`,
      featuredImage:
        process.env.IPFS_IMAGE_URL + cids[0] + `/featuredImage${f_ext}`,
    });
    await collection.save();
    return res
      .status(200)
      .json({ status: true, message: `ok`, userResponse: collectionId });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.addCollectionItems = async (req, res) => {
  try {
    let cid = [];
    const collectionId = req.body.collectionId;
    const collectionItems = req.files.items;
    const optimize = req.body.optimize;
    const instance = await Collection.find({ id: collectionId });

    if (instance.status === "approved") {
      return res
        .status(200)
        .json({ status: false, message: `collection items already added` });
    }

    let optimized;

    if (optimize === `true`) {
      optimized = true;
    } else {
      optimized = false;
    }

    if (!existsSync(process.cwd() + `/src/bulk/${collectionId}`)) {
      mkdirSync(
        process.cwd() + `./src/bulk/${collectionId}`,
        { recursive: true },
        (err) => {
          console.log(err);
        }
      );
    }

    collectionItems.forEach(async (file, index) => {
      ext = path.extname(file.name);
      const fileName = `${index + 1}` + path.extname(file.name);
      const savePath = path.join(
        process.cwd(),
        "src",
        "bulk",
        `${collectionId}`,
        fileName
      );
      await file.mv(savePath);
    });

    const data = await compressAndSaveBulk(collectionId, optimized);
    cid.push(data.cid);
    await Collection.findOneAndUpdate(
      { id: collectionId },
      { $push: { cids: { $each: cid, $position: -1 } } },
      { largestFile: data.largestFile },
      { status: `approved` },
      { new: true }
    );

    let collection = await Collection.findOne({ id: collectionId });

    return res.status(200).json({
      status: true,
      message: `ok`,
      userResponse: {
        collectionId: collectionId,
        collectionName: collection.name,
        category: collection.category,
        collectionImageUri: collection.featuredImage,
      },
    });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.seleteItem = async (req, res) => {
  // collectionId, imageIndex,
  try {
    const { collectionId, address, feeRate, imageNames, networkName } =
      req.body;
    const collection = await Collection.findOne({ id: collectionId });
    const cid = collection.cids[0];
    const price = collection.price;
    const items = await getLinks(cid);
    const count = await Ids.find({}, { _id: 0 });

    let images = [];
    let fileSize = [];
    let ids;
    let inscriptionId;
    let savedInscription;

    if (imageNames.length > 1) {
      inscriptionId = `b${uuidv4()}`;
    } else {
      inscriptionId = `s${uuidv4()}`;
    }

    items.forEach(async (newItem, index) => {
      for (const imageName of imageNames) {
        if (newItem.name === imageName) {
          images.push(newItem);
          fileSize.push(newItem.size);
        }
      }
    });

    console.log(images);

    const sortedImages = fileSize.sort((a, b) => a - b);

    const cost = inscriptionPrice(
      feeRate,
      sortedImages[sortedImages.length - 1],
      price
    );
    const total = cost.total * imageNames.length;
    const cardinals = cost.inscriptionCost * imageNames.length;
    console.log(cost, total, cardinals);

    const payDetails = await createLegacyAddress(networkName, count.length);
    let paymentAddress = payDetails.p2pkh_addr;

    const walletKey = await addWalletToOrd(inscriptionId);
    const blockHeight = await axios.post(
      process.env.ORD_API_URL + `/ord/getLatestBlock`
    );
    if (blockHeight.data.message !== `ok`) {
      return res.status(200).json({ message: blockHeight.data.message });
    }

    if (imageNames.length > 1) {
      const inscription = new BulkInscription({
        id: inscriptionId,
        inscribed: false,
        feeRate: feeRate,

        inscriptionDetails: {
          payAddress: paymentAddress,
          payAddressId: count.length,
          cid: cid,
        },
        fileNames: imageNames,
        walletDetails: {
          keyPhrase: walletKey,
          walletName: inscriptionId,
          creationBlock: blockHeight.data.userResponse.data,
        },
        cost: { costPerInscription: cost, total: total, cardinal: cardinals },
        feeRate: feeRate,
      });

      savedInscription = await inscription.save();
      ids = new Ids({
        id: savedInscription._id,
        type: "bulk",
      });
      await ids.save();
    } else {
      const inscription = new Inscription({
        id: inscriptionId,
        inscribed: false,
        feeRate: feeRate,

        inscriptionDetails: {
          payAddress: paymentAddress,
          payAddressId: count.length,
          cid: cid,
        },
        fileNames: imageNames,
        walletDetails: {
          keyPhrase: walletKey,
          walletName: inscriptionId,
          creationBlock: blockHeight.data.userResponse.data,
        },
        cost: { costPerInscription: cost, total: total },
        feeRate: feeRate,
      });

      savedInscription = await inscription.save();
      ids = new Ids({
        id: savedInscription._id,
        type: "single",
      });
      await ids.save();
    }

    const userResponse = {
      cost: savedInscription.cost.total,
      paymentAddress: paymentAddress,
      inscriptionId: inscriptionId,
    };

    return res.status(200).json({ message: `ok`, userResponse: userResponse });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ message: e.message });
  }
};

module.exports.sendUtxo = async (req, res) => {
  try {
    const inscriptionId = req.body.id;
    const network = req.body.networkName;
    const collectionId = req.body.collectionId;
    const inscriptionType = getType(inscriptionId);
    const collection = await Collection.findOne({ id: collectionId });

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
      inscription = await Inscription.where("id").equals(inscriptionId);
      instance = inscription[0];
      addrCount = 1;
      amount = instance.cost.inscriptionCost;
      payAddressId = instance.inscriptionDetails.payAddressId;
      payAddress = instance.inscriptionDetails.payAddress;
      addressFromId = (await createLegacyAddress(network, payAddressId))
        .p2pkh_addr;
      ids = await Ids.where("id").equals(instance._id);
      if (addressFromId !== payAddress) {
        return res.status(200).json({ message: "Invalid address from ID" });
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
        return res.status(200).json({ message: "Invalid address from ID" });
      }
    }

    balance = await getWalletBalance(payAddress, network);
    if (balance < instance.cost.total) {
      return res.status(200).json({
        message: `inscription cost not received. Available: ${
          balance / 1e8
        }, Required: ${instance.cost.total}`,
      });
    }

    details = await utxoDetails(inscriptionId, addrCount, amount, network);
    if (collection.price !== 0) {
      const creatorPayment = {
        address: collection.collectionDetails.creatorsAddress,
        value: collection.price,
      };

      details.push(creatorPayment);
    }

    txDetails = await sendBitcoin(network, payAddressId, details);
    const txHash = await axios.post(
      process.env.ORD_API_URL + `/ord/broadcastTransaction`,
      { txHex: txDetails.rawTx, networkName: network }
    );
    if (txHash.data.message !== "ok") {
      return res.status(200).json({
        message: txHash.data.message,
      });
    }
    instance.inscriptionDetails.receciverDetails = details;
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
    return res.status(400).json({ message: e.message });
  }
};

module.exports.inscribe = async (req, res) => {};

module.exports.getCollection = async (req, res) => {};

module.exports.getCollectionImages = async (req, res) => {};

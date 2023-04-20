//join launchpad
//mint collection
//get collection details

const { unlinkSync, rmSync, existsSync, mkdirSync } = require("fs");
const axios = require("axios");
const { Web3Storage, getFilesFromPath } = require("web3.storage");
// const { create } = require("ipfs-http-client");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv").config();
const Inscription = require("../model/inscription");
const Ids = require("../model/ids");
const Collection = require("../model/collection");
const {
  createHDWallet,
  addWalletToOrd,
  utxoDetails,
} = require("../helpers/createWallet");
const { compressAndSaveBulk } = require("../helpers/compressImage");

// const initStorage = async () => {
//   return new Web3Storage({ token: process.env.WEB3_STORAGE_KEY });
// };

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
    return res.status(200).json({ message: `ok`, userResponse: collectionId });
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ message: e.message });
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
        .status(409)
        .json({ message: `collection items already added` });
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
    return res.status(500).json({ message: e.message });
  }
};

module.exports.mint = async (req, res) => {
  // collectionId, imageIndex,
  try {
    const { collectionId, address, feeRate, imageName } = req.body;
    const collection = await Collection.findOne({ id: collectionId });
    const cid = collection.cids[0];
    const price = collection.price;
    const items = await getLinks(cid);
    const inscriptionId = `s${uuidv4()}`;
    const count = await Ids.find({}, { _id: 0 });

    let item;

    items.forEach(async (newItem, index) => {
      if (newItem.name === imageName) {
        console.log(newItem);
        item = newItem;
      }
    });

    const cost = inscriptionPrice(feeRate, item.size, price);
    console.log(cost);

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

      inscriptionDetails: {
        fileName: imageName,
        payAddress: paymentAddress,
        payAddressId: count.length,
        cid: cid,
      },
      walletDetails: {
        keyPhrase: walletKey,
        walletName: inscriptionId,
        creationBlock: blockHeight.data.userResponse.data,
      },
      cost: cost,
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

    const userResponse = {
      cost: cost.total,
      paymentAddress: paymentAddress,
      inscriptionId: inscriptionId,
    };
  } catch (e) {
    console.log(e.message);
  }
};

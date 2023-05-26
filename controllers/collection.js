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
} = require("../helpers/walletHelper");
const { compressAndSaveBulk } = require("../helpers/imageHelper");
const {
  sendBitcoin,
  createLegacyAddress,
  createTaprootAddress,
} = require("../helpers/sendBitcoin2");
const index = require("compress-images");

const {
  getRecomendedFee,
  getWalletBalance,
} = require("../helpers/sendBitcoin");
const { rejects } = require("assert");

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
  const sats = Math.ceil((fileSize / 2) * feeRate);
  const cost = sats + 1500 + 550;
  const sizeFee = Math.ceil(cost / 2);
  const total = serviceCharge + cost + parseInt(sizeFee) + price;
  return {
    serviceCharge,
    inscriptionCost: cost + sizeFee,
    sizeFee: sizeFee,
    postageFee: 550,
    total: total,
  };
};

module.exports.addCollection = async (req, res) => {
  try {
    let files = [];
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
      networkName,
    } = req.body;

    const banner = req.files.banner;
    const featuredImage = req.files.featuredImage;
    const collectionId = `c${uuidv4()}`;
    files.push(banner);
    files.push(featuredImage);
    const count = await Collection.find({}, { _id: 0 });

    const collactionAddressDetailss = await createLegacyAddress(networkName, count.length);
    let collectionAddress = collactionAddressDetailss.p2pkh_addr;
    let collectionAddressId = count.length;

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
      collectionAddress: collectionAddress,
      collectionAddressId: collectionAddressId,
      email: email,
      website: website,
      twitter: twitter,
      discord: discord,
    };

    const data = await compressAndSaveBulk(collectionId, false);
    const collection = new Collection({
      id: collectionId,
      status: `pending`,
      name: collectionName,
      price: price,
      collectionDetails: collectionDetails,
      collectionAddress: collectionAddress,
      description: description,
      category: category,
      featuredCid: data.cid,
      banner: process.env.IPFS_IMAGE_URL + data.cid + `/banner${b_ext}`,
      featuredImage:
        process.env.IPFS_IMAGE_URL + data.cid + `/featuredImage${f_ext}`,
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
    req.setTimeout(450000);
    const collectionId = req.body.collectionId;
    const collectionItems = req.files.items;
    const optimize = req.body.optimize;
    const itemCid = req.body.itemCid;
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

    if (!collectionItems){
        if (!itemCid) res.status(200).json({status: false, message: "choose item(s) to upload or input collection item cid"});
        let collection =await Collection.findOne({ id: collectionId });
        collection.itemCid = itemCid;
        await collection.save();
    }

    if (collectionItems.length > 100) return res.status(200).json({status:false, message: "collection items above 100, upload images to ipfs and pass CID"});

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
    let collection = await Collection.findOne({ id: collectionId });
    collection.itemCid = data.cid;
    await collection.save();

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
  try {
    const { collectionId, receiverAddress, feeRate, imageNames, networkName } =
      req.body;
    const collection = await Collection.findOne({ id: collectionId });
    const cid = collection.itemCid;
    console.log("cid:",cid);
    const price = collection.price;
    const items = await getLinks(cid);

    const minted = collection.minted;
    imageNames.forEach(async (image) => {
     
        if (minted.includes(image)) return res.status(200).json({status: false, message: `item with name ${image}, already inscribed`});
    })

    let images = [];
    let fileSize = [];
    let inscriptionId;
    let userResponse;

    let ORD_API_URL;

    if (networkName === "mainnet")
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

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

    const sortedImages = fileSize.sort((a, b) => a - b);

    const cost = inscriptionPrice(
      feeRate,
      sortedImages[sortedImages.length - 1],
      price
    );
    const total = cost.total * imageNames.length;
    const cardinals = cost.inscriptionCost * imageNames.length;

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

    if (imageNames.length > 1) {
      const inscription = new BulkInscription({
        id: inscriptionId,
        inscribed: false,
        feeRate: feeRate,
        collectionId: collectionId,
        inscriptionDetails: {
          payAddress: paymentAddress,
          cid: cid,
        },
        fileNames: imageNames,
        walletDetails: {
          keyPhrase: walletKey,
          walletName: inscriptionId,
        },
        cost: { costPerInscription: cost, total: total, cardinal: cardinals },
        feeRate: feeRate,
        receiver: receiverAddress,
        stage: "stage 1"
      });

      await inscription.save();
    } else {
      const inscription = new Inscription({
        id: inscriptionId,
        inscribed: false,
        feeRate: feeRate,
        collectionId: collectionId,

        inscriptionDetails: {
          payAddress: paymentAddress,
          cid: cid,
        },
        fileNames: imageNames,
        walletDetails: {
          keyPhrase: walletKey,
          walletName: inscriptionId,
        },
        cost: cost,
        feeRate: feeRate,
        stage: "stage 1"
      });

     await inscription.save();
    }

    userResponse = {
      cost: {
        serviceCharge: cost.serviceCharge * imageNames.length,
        inscriptionCost: cost.inscriptionCost * imageNames.length,
        sizeFee: cost.sizeFee * imageNames.length,
        postageFee: cost.postageFee,
        total: cost.total * imageNames.length,
      },
      paymentAddress: paymentAddress,
      inscriptionId: inscriptionId,
    };

    return res.status(200).json({ status:true, message: `ok`, userResponse: userResponse });
  } catch (e) {
    console.log(e);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.sendUtxo = async (req, res) => {
  try {
    const inscriptionId = req.body.inscriptionId;
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
    let ORD_API_URL;

    if (network === "mainnet")
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (network === "testnet")
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

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
      addrCount = instance.fileNames.length;
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
          balance
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

    console.log(details);

    txDetails = await sendBitcoin(network, payAddressId, details, inscriptionType);
    console.log(txDetails);
    const txHash = await axios.post(ORD_API_URL + `/ord/broadcastTransaction`, {
      txHex: txDetails.rawTx,
      networkName: network,
    });
    if (txHash.data.message !== "ok") {
      return res.status(200).json({
        message: txHash.data.message,
      });
    }
    instance.inscriptionDetails.receciverDetails = details;
    instance.stage = "stage 2";
    await instance.save();
    return res.status(200).json({
      status: true,
      message: "ok",
      userResponse: {
        details: txDetails,
        txId: txHash.data.userResponse.data,
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
    const inscriptionId = req.body.inscriptionId;
    const networkName = req.body.networkName;
    const inscriptionType = getType(inscriptionId);
    const collectionId = req.body.collectionId;

    let inscription;
    let instance;
    let balance;
    let ORD_API_URL;

    if (networkName === `mainnet`){
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    } else if(networkName === `testnet`){
      ORD_API_URL = process.env.ORD_TESTNET_API_URL
    }
    
    if (inscriptionType === "single") {
      inscription = await Inscription.where("id").equals(inscriptionId);
      instance = inscription[0];
    } else if (inscriptionType === "bulk") {
      inscription = await BulkInscription.where("id").equals(inscriptionId);
      instance = inscription[0];
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
      await instance.save();
      return res
        .status(200)
        .json({ status: true, message: `ok`, userResponse: true });
    }
  }catch(e){
    console.log(e.message);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
  }
}

module.exports.getImages = async(req, res) => {
  try{
    const {collectionId} = req.body;
    const collection = await Collection.findOne({id: collectionId});
    let minted = collection.minted;
    let items = [];
    const imageNames = await getLinks(collection.itemCid);
    if(!imageNames) return res.status(200).json({status: false, message: `error getting images`})
    imageNames.forEach((newItem, index) => {
      let i_data;
      if(minted.includes(newItem.name)){
         i_data = {
          name: newItem.name,
          imageUrl: process.env.IPFS_IMAGE_URL + collection.itemCid + `/${newItem.name}`,
          minted: true,
        }
      } else {
        i_data = {
          name: newItem.name,
          imageUrl: process.env.IPFS_IMAGE_URL + collection.itemCid + `/${newItem.name}`,
          minted: false,
        }
      }
      items.push(i_data);
    })
    return res.status(200).json({status: true, message:"ok", userResponse: items})
  } catch(e){
    console.log(e.message);
    return res.status(500).json({status: false, message: e.message})
  }
}

module.exports.inscribe = async (req, res) => {
  try{
    req.setTimeout(450000);
    const {collectionId, inscriptionId, receiverAddress, networkName} = req.body;
    const type = getType(inscriptionId);
    let inscription;
    let instance;
    let newInscription;
    let imageNames;
    let n_inscriptions;
    let details = [];
    let ids;
    let ORD_API_URL;

    const collection = await Collection.findOne({id: collectionId});
    const changeAddress = collection.collectionAddress;

    if (networkName === "mainnet")
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    const result = await axios.post(ORD_API_URL + `/ord/wallet/balance`, {
      walletName: inscriptionId,
      networkName: networkName,
    });
    const balance = result.data.userResponse.data;

    if (type === "single") {
      inscription = await Inscription.where("id").equals(inscriptionId);
      instance = inscription[0];
      imageNames = instance.fileNames;
      ids = await Ids.where("id").equals(instance._id);
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
      imageNames = instance.fileNames;
      ids = await Ids.where("id").equals(instance._id);
      let cost = instance.cost.cardinal;
      if (balance < cost) {
        return res.status(200).json({
          status: false,
          message: `not enough cardinal utxo for inscription. Available: ${balance}`,
        });
      }
    }
        newInscription = await axios.post(ORD_API_URL + `/ord/inscribe/change`, {
          feeRate: instance.feeRate,
          receiverAddress: receiverAddress,
          cid: collection.itemCid,
          inscriptionId: inscriptionId,
          networkName: networkName,
          collectionId: collectionId,
          imageNames: imageNames,
          changeAddress: changeAddress
        });
  
        if (newInscription.data.message !== "ok") {
          return res
            .status(200)
            .json({ status: false, message: newInscription.data.message });
        }
  
        n_inscriptions = newInscription.data.userResponse.data;
        n_inscriptions.forEach((item) => {
          const data = {
            inscription: item.inscriptions[0],
            commit: item.commit,
          };
    
          details.push(data);
        });
    
    await Collection.findOneAndUpdate({id: collectionId}, {$push: {inscriptions: {$each: details, $position: -1}}}, { new: true });

    if (!receiverAddress) {
      instance.inscription = details;
      instance.inscribed = true;
      instance.stage = "stage 3";
      await instance.save();
      return res.status(200).json({
        status: true,
        message: `ok`,
        userResponse: details,
      });
    } else {
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
    }
  } catch(e) {
    console.log(e.message);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getCollections = async (req, res) => {
  try{
    let collectionDetails = [];
    const collections = await Collection.find({}, { _id: 0 });

    collections.forEach(async (collection, index) => {
      let mintedItems = collection.minted;
      let mintedCount = mintedItems.length;
      data = {
        collectionId: collection.id,
        collectionName: collection.name,
        creatorName: collection.collectionDetails.creatorName,
        description: collection.description,
        price: collection.price,
        category: collection.category,
        mintedCount: mintedCount,
        bannerUrl: collection.banner,
        featuredUrl: collection.featuredImage,
        website: collection.collectionDetails.website,
        twitter: collection.collectionDetails.twitter,
        discord: collection.collectionDetails.discord,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt
      }
      collectionDetails.push(data);
    })

    return res.status(200).json({status: true, message: "ok", userResponse: collectionDetails})
  }catch(e){
    console.log(e.message);
    return res.status(200).json({status: false, message: e.message});
  }
};

module.exports.getCollection = async (req, res) => {
  try{
    const {collectionId} = req.body;
    const collection = await Collection.findOne({id: collectionId});
    let collectionItems = await getLinks(collection.itemCid);
    let mintedItems = collection.minted;
    let collectionCount = collectionItems.length;
    let mintedCount = mintedItems.length;
    let collectionData = {
        collectionId: collection.id,
        collectionName: collection.name,
        creatorName: collection.collectionDetails.creatorName,
        description: collection.description,
        price: collection.price,
        category: collection.category,
        collectionCount: collectionCount,
        mintedCount: mintedCount,
        bannerUrl: collection.banner,
        featuredUrl: collection.featuredImage,
        website: collection.collectionDetails.website,
        twitter: collection.collectionDetails.twitter,
        discord: collection.collectionDetails.discord,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt
    }
    return res.status(200).json({status: true, message: "ok", userResponse: collectionData});
  }catch(e){
    console.log(e.message);
    return res.status(200).json({status: false, message: e.message});
  }
}

module.exports.getCollectionInscription = async (req, res) => {
  try{
    const {collectionId} = req.body;
    const collection = await Collection.findOne({id: collectionId});
    const inscriptions = collection.inscriptions;

    return res.status(200).json({status: true, message: `ok`, userResponse: inscriptions})
  }catch(e){
    console.log(e.message);
    return res.status(200).json({status: false, message: e.message});
  }
}

module.exports.getInscribedImages = async (req, res) => {
  try{
    const {collectionId} = req.body;
    const collection = await Collection.findOne({id: collectionId});
    return res.status(200).json({status: true, message: "ok", userResponse: collection.minted});
  }catch(e){
    console.log(e.message);
    return res.status(200).json({status: false, message: e.message});
  }
}

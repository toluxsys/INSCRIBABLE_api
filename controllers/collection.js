//join launchpad
//mint collection
//get collection details

const { unlinkSync, rmSync, existsSync, mkdirSync } = require("fs");
const axios = require("axios");
const interval = 15;
const moment = require("moment");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv").config();
const Inscription = require("../model/inscription");
const Address = require("../model/address");
const BulkInscription = require("../model/bulkInscription");
const Ids = require("../model/ids");
const Collection = require("../model/collection");
const SelectedItems = require("../model/selectedItems");
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
const inscription = require("../model/inscription");
const MintDetails = require("../model/mintDetails");
const { promises } = require("dns");
const { address } = require("bitcoinjs-lib");
const { timeStamp } = require("console");

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

const checkTimeElapsed = (timestamp) => {
  const currentTime = moment();
  const timeDiff = currentTime.diff(timestamp, 'minutes');

  if (timeDiff >= interval) {
   return true;
  } else {
   return false;
  }
}

const addMintDetails = async (collectionId, items) => {
  try{
    let details = await JSON.parse(items);
    let collection = await Collection.findOne({id: collectionId});
    if(collection.mintDetails.length > 1) throw new Error("mint details already added");
    details.details.forEach(async (detail) => {
      const mintDetails = new MintDetails({
        collectionId: collectionId,
        name: detail.name,
        mintLimit: detail.mintLimit,
        price: detail.price
      })
      let savedDetails = await mintDetails.save();
      await Collection.findOneAndUpdate({id: collectionId}, {$push: {mintDetails: savedDetails._id}}, {new: true});
    });
    return true;
  }catch(e){
    console.log(e.message);
    return false;
  }
}

const verifyMint = async (collectionId, address, amount) => {
  try{
    const collection = await Collection.findOne({id: collectionId});
    const mintStage = await MintDetails.findOne({_id: collection.mintStage}); 
    let allowedAddress = mintStage.addresses;
    let data;
    let c_address;
    if(mintStage.name === "public"){
      let s_address = await Address.find({mintStage: collection.mintStage});
      if(s_address.length === 0) {
        let n_address = new Address({
          collectionId: collectionId,
          address: address,
          mintStage: collection.mintStage,
          mintCount : 0
        })
        let savedAddress = await n_address.save();
        c_address = savedAddress;
        console.log(c_address);
      }
      s_address.forEach(async (addr)=>{
        if(addr.address === address) {
          c_address = addr
        }else{
          let n_address = new Address({
            collectionId: collectionId,
            address: address,
            mintStage: collection.mintStage,
            mintCount : 0
          })
          let savedAddress = await n_address.save();
          c_address = savedAddress;
        }
      })
      
      if (c_address.mintCount >= mintStage.mintLimit){
        data = {
          valid: false,
          price: mintStage.price,
          mintCount: c_address.mintCount,
          message: "mint limit reached"
        }
      }else if (amount > mintStage.mintLimit) {
        data = {
          valid: false,
          price: mintStage.price,
          mintCount: c_address.mintCount,
          message: "selected amount exceeds limit"
        }
      }else{
        let count = c_address.mintCount + amount;
        await Address.findOneAndUpdate({_id: c_address._id}, {mintCount: count}, {new: true});
        data = {
          valid: true,
          price: mintStage.price,
          mintCount: count,
          message: "valid mint"
        }
      }
    }else if(allowedAddress.includes(address)){
      let s_address = await Address.find({mintStage: collection.mintStage});
      if(s_address.length === 0) {
        let n_address = new Address({
          collectionId: collectionId,
          address: address,
          mintStage: collection.mintStage,
          mintCount : 0
        })
        let savedAddress = await n_address.save();
        c_address = savedAddress;
        console.log(c_address);
      }
      s_address.forEach(async (addr)=>{
        if(addr.address === address) {
          c_address = addr
        }else{
          let n_address = new Address({
            collectionId: collectionId,
            address: address,
            mintStage: collection.mintStage,
            mintCount : 0
          })
          let savedAddress = await n_address.save();
          c_address = savedAddress;
        }
      })

      if (c_address.mintCount >= mintStage.mintLimit){
        data = {
          valid: false,
          price: mintStage.price,
          mintCount: c_address.mintCount,
          message: "mint limit reached"
        }
      }else if (amount > mintStage.mintLimit) {
        data = {
          valid: false,
          price: mintStage.price,
          mintCount: c_address.mintCount,
          message: "selected amount exceeds limit"
        }
      }else{
        let count = c_address.mintCount + amount;
        await Address.findOneAndUpdate({_id: c_address._id}, {mintCount: count}, {new: true});
        data = {
          valid: true,
          price: mintStage.price,
          mintCount: count,
          message: "valid mint"
        }
      }

    }else{
      data = {
        valid: false,
        price: mintStage.price,
        mintCount: mintStage.mintLimit,
        message: `address not valid for mint stage ${mintStage.name}`
      }
    }
    return data; 
  }catch(e){
    console.log(e)
  }
}



const updateMintStage = async (collectionId, stage) => {
  try{
    const collection = await Collection.findOne({id: collectionId});
    const mintDetails = collection.mintDetails;
    //let savedCollection;

    let mappedObjectId = mintDetails.map(val => val.toString())
    let s_mintDetails = await MintDetails.find({_id: {$in: mappedObjectId}});
    let stageId; 

    s_mintDetails.forEach(async (detail) => {
      if (detail.name === stage) {
        stageId = detail._id;
      };
    })
    return stageId
  }catch(e){
    console.log(e.message);
    throw new Error(e.message);
  }
}

module.exports.updateMintStage = async (req, res) => {
  try{
    const {collectionId, stage} = req.body;
    let mintStage = await updateMintStage(collectionId, stage);
    let mintDetail = await MintDetails.findOne({_id: mintStage});
    if(!mintDetail) return res.status(200).json({status: false, message: "Invalid stage provided"});
    await Collection.findOneAndUpdate({id: collectionId}, {mintStage: mintStage});
    let userResponse = {
      stage: mintDetail.name,
      mintLimit: mintDetail.mintLimit,
      price: mintDetail.price,
      lastUpdate: mintDetail.updatedAt
    }
    return res.status(200).json({status: true, message: "mint stage updated", userResponse: userResponse})
  }catch(e){
    console.log(e.message);
    return res.status(200).json({status: false, message: "mint stage not updated"})
  }
}

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
      mintDetails,
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
    await addMintDetails(collectionId, mintDetails)
    return res
      .status(200)
      .json({ status: true, message: `ok`, userResponse: collectionId });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.getMintDetails = async (req,res) => {
  try{
    const collectionId = req.params.collectionId;
    const collection = await Collection.findOne({id: collectionId});
    let mintDetails = collection.mintDetails;
    let details = [];
    let mappedObjectId = mintDetails.map(val => val.toString())
    let s_mintDetails = await MintDetails.find({_id: {$in: mappedObjectId}});
    s_mintDetails.forEach(async(detail) => {
      let data = {
        name: detail.name,
        mintLimit: detail.mintLimit,
        price: detail.price,
        lastUpdatedAt: detail.updatedAt 
      };
      details.push(data);
    })
    return res.status(200).json({status: true, message: "ok", userResponse: details});
  }catch(e){
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
}

module.exports.addMintAddress = async (req, res) => {
  try{
    const {collectionId, name, addresses} = req.body;
    const mintDetails = await MintDetails.find({collectionId: collectionId});
    let mappedObjectId = mintDetails.map(val => val)
    let n_mintDetails = await MintDetails.find({_id: {$in: mappedObjectId}});
    let id;
    n_mintDetails.forEach((detail) => {
      if(detail.name === name) {
        id = detail._id;
      }
    })
    let s_mintDetails = await MintDetails.findOne({_id: id});
    if (s_mintDetails.addresses.length > 0){ return res.status(200).json({status:false, message: `addresses already added for ${name}`})};
    s_mintDetails.addresses = addresses;
    await s_mintDetails.save();
    return res.status(200).json({status: true, message: "ok", userResponse: collectionId});
  }catch(e){
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
}

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
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.seleteItem = async (req, res) => {
  try {
    const { collectionId, receiveAddress, feeRate, imageNames, networkName } = req.body;
    const collection = await Collection.findOne({ id: collectionId });
    const cid = collection.itemCid;
    const items = await getLinks(cid);
    const minted = collection.minted;
    const mintStage = collection.mintStage;
    let s_selectedItems = await SelectedItems.find({collectionId: collectionId});
    let inscription;
    let s_items = [];
    let s_selected = [];
    let s_minted = [];
    let images = [];
    let fileSize = [];
    let inscriptionId;
    let userResponse;
    let savedSelected;
    let paymentAddress;
    let ORD_API_URL;
    if(!receiveAddress) return res.status(200).json({status: false, message: "Receive Address is required"});
    if(!mintStage) return res.status(200).json({status: false, message: "mint stage not set"});
    let mintDetails = await MintDetails.findOne({_id: mintStage});
    const price = mintDetails.price;

    if (networkName === "mainnet")
    ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
    ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    let verified = await verifyMint(collectionId, receiveAddress, imageNames.length);
    console.log(verified);
    if (!verified.valid) return res.status(200).json({status: false, message: verified.message});

    if (imageNames.length > 1) {
      inscriptionId = `b${uuidv4()}`;
    } else {
      inscriptionId = `s${uuidv4()}`;
    }
  
    if (s_selectedItems.length === 0){
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
      paymentAddress = result.data.userResponse.data[0];

      const selectedItems = new SelectedItems({
        collectionId : collectionId,
        items: imageNames
      })
      savedSelected = await selectedItems.save();
      await Collection.findOneAndUpdate({id: collectionId}, {$push: {selected: savedSelected._id}}, {new: true});
      
      if (imageNames.length > 1) {
        inscription = new BulkInscription({
          id: inscriptionId,
          inscribed: false,
          feeRate: feeRate,
          collectionId: collectionId,
          selected: savedSelected._id,
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
          receiver: receiveAddress,
          stage: "stage 1"
        });
  
        await inscription.save();
      } else {
        inscription = new Inscription({
          id: inscriptionId,
          inscribed: false,
          feeRate: feeRate,
          collectionId: collectionId,
          selected: savedSelected._id,
  
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
          receiver: receiveAddress,
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
        createdAt: inscription.createdAt,
      };

    }else {
      
      s_selectedItems.forEach((selected) => {
        s_items = s_items.concat(selected.items);
      })

      imageNames.forEach((image) => {
        if (s_items.includes(image)) {
          s_selected.push(image);
        } else if (minted.includes(image)) {
          s_minted.push(image);
        }    
      })

      if(s_selected.length >= 1) return res.status(200).json({status: false, message: `items already selected`, userResponse: s_selected});
      if(s_minted.length >= 1) return res.status(200).json({status: false, message: `items already selected`, userResponse: s_minted});

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
      paymentAddress = result.data.userResponse.data[0];
      const selectedItems = new SelectedItems({
        collectionId : collectionId,
        items: imageNames
      })
      savedSelected = await selectedItems.save();
      await Collection.findOneAndUpdate({id: collectionId}, {$push: {selected: savedSelected._id}}, {new: true});

      if (imageNames.length > 1) {
        inscription = new BulkInscription({
          id: inscriptionId,
          inscribed: false,
          feeRate: feeRate,
          collectionId: collectionId,
          selected: savedSelected._id,
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
          receiver: receiveAddress,
          stage: "stage 1"
        });
  
        await inscription.save();
      } else {
        inscription = new Inscription({
          id: inscriptionId,
          inscribed: false,
          feeRate: feeRate,
          collectionId: collectionId,
          selected: savedSelected._id,
  
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
          receiver: receiveAddress,
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
        createdAt: inscription.createdAt,
      };
    }
    return res.status(200).json({ status:true, message: verified.message, userResponse: userResponse });
  } catch (e) {
    console.log(e.message);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.undoSelection = async (req, res) => {
  try{
    const inscriptionId = req.params.inscriptionId;
    const type = getType(inscriptionId);
    let inscription;

    if(type === "single"){
      inscription = await Inscription.findOne({id: inscriptionId});
      if (!inscription) return res.status(200).json({status: false, message: "id does not exist"});
      await Collection.findOneAndUpdate({id: inscription.collectionId}, {$pull: {selected: {$in: inscription.selected}}}, {new: true});
      await SelectedItems.deleteOne({_id: inscription.selected});
      await Inscription.deleteOne({id: inscriptionId})
    }else if(type === "bulk"){
      inscription = await BulkInscription.findOne({id: inscriptionId})
      if (!inscription) return res.status(200).json({status: false, message: "id does not exist"});
      await Collection.findOneAndUpdate({id: inscription.collectionId}, {$pull: {selected: {$in: inscription.selected}}}, {new: true});
      await SelectedItems.deleteOne({_id: inscription.selected});
      await Inscription.findOneAndUpdate({id: inscriptionId}, {selected: null});
    }
    let address = await Address.find({collectionId: inscription.collectionId});
    let c_address;
    address.forEach((addr)=> {
      if(addr.address === inscription.receiver) c_address = addr;
    })
    await Address.findOneAndUpdate({_id: c_address._id}, {mintCount: c_address.mintCount - inscription.fileNames.length});
    return res.status(200).json({status: true, message: "item(s) unselected", userResponse: inscription.fileNames});
  }catch(e){
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
}

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
    let selectedItems = await SelectedItems.find({collectionId: collectionId});
    let items = [];
    let s_items = [];
    let s_minted = [];
    let s_free = [];
    let s_selected = [];
    let selectedImages = [];

    const imageNames = await getLinks(collection.itemCid);
    if(!imageNames) return res.status(200).json({status: false, message: `error getting images`})

    selectedItems.forEach((selected) => {
      let items = selected.items;
      let timestamp = selected.createdAt;
      s_items.push({items: items, timestamp: timestamp, id: selected._id});
    })

    s_items.forEach(async (item)=>{
      if(checkTimeElapsed(item.timestamp) === true) { 
        await SelectedItems.deleteOne({_id: item.id});
        let s_selected = [];
        item.items.forEach((image) => {
          let data = {
            name: image,
            imageUrl: process.env.IPFS_IMAGE_URL + collection.itemCid + `/${image}`,
             selected: false,
             minted: false,
             open: true,
            timestamp: item.timestamp
          }
          s_selected.push(data)
        })
      }else if (checkTimeElapsed(item.timestamp) === false){
        item.items.forEach((image) => {
          let data = {
            name: image,
            imageUrl: process.env.IPFS_IMAGE_URL + collection.itemCid + `/${image}`,
             selected: true,
             minted: false,
             open: false,
            timestamp: item.timestamp
          }
          selectedImages.push(image);
          s_selected.push(data)
        })
      }  
    })

    imageNames.forEach((image) => {
      
      let i_data;
      let n_select = [];
      
     if (minted.includes(image.name)) {
        i_data = {
          name: image.name,
          imageUrl: process.env.IPFS_IMAGE_URL + collection.itemCid + `/${image.name}`,
          selected: false,
           minted: true,
           open: false,
        }
        s_minted.push(i_data);
      } else if (selectedImages.includes(image.name)) {
        n_select.push(image.name);
      } else {
        i_data = {
          name: image.name,
          imageUrl: process.env.IPFS_IMAGE_URL + collection.itemCid + `/${image.name}`,
          selected: false,
           minted: false,
           open: true,
        }
        s_free.push(i_data);
      }
    })
    let data = items.concat(s_selected, s_free, s_minted);
    return res.status(200).json({status: true, message:"ok", userResponse: data})
  } catch(e){
    console.log(e);
    return res.status(500).json({status: false, message: e.message})
  }
}

module.exports.inscribe = async (req, res) => {
  try{
    req.setTimeout(450000);
    const {collectionId, inscriptionId, networkName} = req.body;
    const type = getType(inscriptionId);
    let inscription;
    let instance;
    let newInscription;
    let imageNames;
    let n_inscriptions;
    let details = [];
    let ids;
    let ORD_API_URL;
    let receiveAddress;

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
      receiveAddress = instance.receiver;
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
      receiveAddress = instance.receiver;
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
          receiverAddress: receiveAddress,
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
          let inscriptions = item.inscriptions;
          inscriptions.map((e) => {
            const data = {
              inscription: e,
            };
            details.push(data);
          }) 
        });
    
    await Collection.findOneAndUpdate({id: collectionId}, {$push: {inscriptions: {$each: details, $position: -1}}}, {$pull: {selected: {$in: instance.selected}}}, { new: true }); 
    //await SelectedItems.deleteOne({_id: instance.selected});
    if (!receiveAddress) {
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
      instance.receiver = receiveAddress;
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
    const mintStage = collection.mintStage;
    let mintDetails = await MintDetails.findOne({_id: mintStage});
    let collectionItems = await getLinks(collection.itemCid);
    let mintedItems = collection.minted;
    let collectionCount = collectionItems.length;
    let mintedCount = mintedItems.length;
    let collectionData = {
        collectionId: collection.id,
        collectionName: collection.name,
        creatorName: collection.collectionDetails.creatorName,
        description: collection.description,
        price: mintDetails.price || collection.price,
        mintStage: mintDetails.name || "open mint",
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

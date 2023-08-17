const { unlinkSync, rmSync, existsSync, mkdirSync } = require("fs");
const axios = require("axios");
const interval = 15;
const moment = require("moment");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv").config();
const Inscription = require("../model/inscription");
const Address = require("../model/address");
const BulkInscription = require("../model/bulkInscription");
const Ids = require("../model/ids");
const Collection = require("../model/collection");
const SelectedItems = require("../model/selectedItems");
const ServiceFee = require("../model/serviceFee");
const Sats = require("../model/sats");
const { getType } = require("../helpers/getType");
const {
  createHDWallet,
  addWalletToOrd,
  utxoDetails,
  verifyAddress,
} = require("../helpers/walletHelper");
const { compressAndSaveBulk, uploadToS3, downloadAddressFile,downloadAllAddressFile } = require("../helpers/imageHelper");
const {
  sendBitcoin,
  createLegacyAddress,
  createCollectionLegacyAddress,
  createTaprootAddress,
} = require("../helpers/sendBitcoin2");

const {
  getRecomendedFee,
  getWalletBalance,
  checkAddress,
  getSpendUtxo
} = require("../helpers/sendBitcoin");
const MintDetails = require("../model/mintDetails");
const { start } = require("repl");
const { get } = require("express/lib/response");
const ObjectId = require('mongoose').Types.ObjectId; 
let satTypes = ['rare', 'common', 'block9', 'block84', 'pizza','pizza1','uncommon', '2009', '2010', '2011'];


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

const getServiceFee = async (collectionId) => {
  try{
    const serviceFee = await ServiceFee.findOne({collectionId: collectionId});
    if(!serviceFee) return process.env.COLLECTION_SERVICE_FEE;
    return serviceFee.serviceFee.toString();
  }catch(e){
    console.log(e.message);
    throw new Error(e.message);
  }
}

const inscriptionPrice = async (feeRate, fileSize, price, collectionId) => {
  const serviceCharge = parseInt(await getServiceFee(collectionId));
  const sats = Math.ceil((fileSize / 4) * feeRate);
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

const updateMintStage1 = async (collectionId) => {
  try{
    const collection = await Collection.findOne({id: collectionId});
    const mintStage = await MintDetails.findOne({_id: collection.mintStage});
    const stages = collection.mintDetails;
    let nextStageIndex = stages.indexOf(collection.mintStage) - 1;
    const currentTime = moment();
    const startTime = collection.startAt;
    const timeDifference = currentTime.diff(startTime , 'seconds');
    const duration = mintStage.duration;
   if(nextStageIndex < 0){
    if(collection.startMint === false) {
      return "mint stage updated";
    }else{
      if(timeDifference >= duration){
        collection.startMint = false;
        await collection.save();
        return "mint stage updated";
      }else{
        return "stage mint not complete";
      } 
    }
   }else{
    if(collection.startMint === false) {
      return "mint stage updated";
    }else{
      let nextStage = stages[nextStageIndex];
      if(timeDifference >= duration){
        collection.mintStage = nextStage;
        collection.startAt = new Date();
        await collection.save();
        return "mint stage updated";
      }else{
        return "stage mint not complete";
      }
    }
   };
  }catch(e){
    console.log(e);
    return "error updating mint stage";
  }
}

const checkTimeElapsed = (timestamp) => {
  const currentTime = moment();
  const timeDiff = currentTime.diff(timestamp, 'minutes');

  if (timeDiff >= interval) {
   return true;
  } else {
   return false;
  }
}

const addMintDetails = async (collectionId, details) => {
  try{
    // let details = await JSON.parse(items);
    let collection = await Collection.findOne({id: collectionId});
    if(collection.mintDetails.length > 1) throw new Error("mint details already added");
    details.details.forEach(async (detail) => {
      //convert duration from hours to seconds
      let duration = detail.duration * 60 * 60;
      const mintDetails = new MintDetails({
        collectionId: collectionId,
        name: detail.name,
        mintLimit: detail.mintLimit,
        price: detail.price,
        duration: duration,
      })
      let savedDetails = await mintDetails.save();
      await Collection.findOneAndUpdate({id: collectionId}, {$push: {mintDetails: savedDetails._id}}, {new: true});
    });
    return true;
  }catch(e){
    console.log(e);
    return false;
  }
}

const checkWallet = async (collectionId, address) => {
  try{
    const mintStages = await MintDetails.find({collectionId: collectionId});
    let stagNames = [];
    let params = [];
    let addresses = [];
    mintStages.forEach(async (stage) => {
      if(stage.name == "public" || stage.name == "Public"){
        
      }else{
        stagNames.push(`addr-`+collectionId+`-`+stage.name+`.txt`);
        params.push({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `addr-`+collectionId+`-`+stage.name+`.txt`,
        });
      } 
    });
   
    await downloadAllAddressFile(params, collectionId);
    fs.readdirSync(process.cwd()+`/src/address/${collectionId}`).forEach((file) => {
      fs.readFileSync(process.cwd()+`/src/address/${collectionId}/${file}`, { encoding: 'utf8'}).split("\r\n").forEach((address) => {
        addresses.push(address);
      });
    });

   //filter the addresses array to remove items that appear more than once
    let _addresses = addresses.filter((item, index) => {
      return addresses.indexOf(item) === index;
    });

    if(_addresses.includes(address)){
      return data = {
        valid: true,
        price: 0,
        mintCount: 0,
        message: `valid mint`
      }
    }else{
      return data = {
        valid: false,
        price: 0,
        mintCount: 0,
        message: `address not valid for mint`
      }
    }
  }catch(e){
    console.log(e.message);
  }
};

const verifyMint = async (collectionId, address, amount) => {
  try{
    const collection = await Collection.findOne({id: collectionId});
    const mintStage = await MintDetails.findOne({_id: collection.mintStage});
    if(!mintStage) return data = {
      valid: false,
        price: 0,
        mintCount: 0,
        message: "No mint stage set"
    };
    let c_address;
    let stage_name = `addr-`+collectionId+`-`+mintStage.name+`.txt`;
    if(mintStage.name === "public" || mintStage.name === "Public"){ 
      let s_address = await Address.findOne({mintStage: collection.mintStage, address: address});
        if(!s_address) {
          let n_address = new Address({
            collectionId: collectionId,
            address: address,
            mintStage: collection.mintStage,
            mintCount : 0
          })
          await n_address.save();
          return data = {
            valid: true,
            price: mintStage.price,
            mintCount: 0,
            message: "valid mint"
          }
        }else{ 
          if(s_address.pendingOrders.length >= mintStage.mintLimit){
            let pendingOrders = [];
            let mappedObjectId = s_address.pendingOrders.map(val => val.toString())
            let _pendingOrders = await Inscription.find({id: {$in: mappedObjectId}});
            _pendingOrders.forEach((item)=>{
              pendingOrders.push({
                orderId: item.id,
                paymentStatus: item.collectionPayment,
                inscriptionStatus: item.inscribed,
              })
            })
            return data = {
              valid: true,
              price: mintStage.price,
              mintCount: 0,
              message: "complete pending order(s)",
              userResponse: {
                pendingOrders: pendingOrders
              },
            }
          }else{
            c_address = s_address;  
          }
        }
        if (c_address.mintCount >= mintStage.mintLimit){
          return data = {
            valid: false,
            price: mintStage.price,
            mintCount: c_address.mintCount,
            message: "mint limit reached"
          }
        }
        
        if (amount > mintStage.mintLimit) {
          return data = {
            valid: false,
            price: mintStage.price,
            mintCount: c_address.mintCount,
            message: "selected amount exceeds limit"
          }
        }
      
        let count = c_address.mintCount + amount;
        return data = {
          valid: true,
          price: mintStage.price,
          mintCount: count,
          message: "valid mint"
        }
    }else{
      if(!fs.existsSync(process.cwd()+`/src/address/${collectionId}/${stage_name}`)){
        let d_address = await downloadAddressFile(stage_name, collectionId);
        if(!d_address) {
          return data = {
            valid: false,
            price: "",
            mintCount: 0,
            message: "addresses for stage not found",
            userResponse: {
              pendingOrders: []
            },
          }
        }
      };
      let allowedAddress = fs.readFileSync(process.cwd()+`/src/address/${collectionId}/${stage_name}`, { encoding: 'utf8'})
      .split("\n")
      .filter((item, index) => {
        return allowedAddress.indexOf(item) === index;
      });

      if(allowedAddress.includes(address)){
        let s_address = await Address.findOne({mintStage: collection.mintStage, address: address});
        if(!s_address) {
          let n_address = new Address({
            collectionId: collectionId,
            address: address,
            mintStage: collection.mintStage,
            mintCount : 0
          })
          await n_address.save();
          return data = {
            valid: true,
            price: mintStage.price,
            mintCount: 0,
            message: "valid mint"
          }
        }else{ 
          if(s_address.pendingOrders.length >= mintStage.mintLimit){
            let pendingOrders = [];
            let mappedObjectId = s_address.pendingOrders.map(val => val.toString())
            let _pendingOrders = await Inscription.find({id: {$in: mappedObjectId}});
            _pendingOrders.forEach((item)=>{
              pendingOrders.push({
                orderId: item.id,
                paymentStatus: item.collectionPayment,
                inscriptionStatus: item.inscribed,
              })
            })
            return data = {
              valid: true,
              price: mintStage.price,
              mintCount: 0,
              message: "complete pending order(s)",
              userResponse: {
                pendingOrders: pendingOrders
              },
            }
          }else{
            c_address = s_address;  
          }   
        }
        if (c_address.mintCount >= mintStage.mintLimit){
          return data = {
            valid: false,
            price: mintStage.price,
            mintCount: c_address.mintCount,
            message: "mint limit reached"
          }
        }
        
        if (amount > mintStage.mintLimit) {
          return data = {
            valid: false,
            price: mintStage.price,
            mintCount: c_address.mintCount,
            message: "selected amount exceeds limit"
          }
        }
      
        let count = c_address.mintCount + amount;
        return data = {
          valid: true,
          price: mintStage.price,
          mintCount: count,
          message: "valid mint"
        }
      }else{
        return data = {
          valid: false,
          price: mintStage.price,
          mintCount: mintStage.mintLimit,
          message: `address not valid for mint stage ${mintStage.name}`
        }
      }   
    } 
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
      userSelect,
      fileSize,
      specialSat,
      totalSupply,
      startAt,
    } = req.body;

    if(!mintDetails) return res.status(200).json({status: false, message: "mint details required"});
    const banner = req.files.banner;
    const featuredImage = req.files.featuredImage;
    const collectionId = `c${uuidv4()}`;
    if(verifyAddress(creatorsAddress, networkName) === false) return res.status(200).json({status: false, message: `crestors address not valid for ${networkName}`});
    files.push(banner);
    files.push(featuredImage);
    const count = await Collection.find({}, { _id: 0 });
    const alias = `${collectionName.replace(/\s/g, "")}_${count.length}`;

    const collactionAddressDetails = await createCollectionLegacyAddress(networkName, count.length);
    let collectionAddress = collactionAddressDetails.p2pkh_addr;
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
      fileSize: fileSize,
      totalSupply: totalSupply,
    };

    const data = await compressAndSaveBulk(collectionId, false);
    //let startTime = new Date(startAt).getTime();
    await addMintDetails(collectionId, JSON.parse(mintDetails));
    let mintStage = await updateMintStage(collectionId, JSON.parse(mintDetails).details[0].name);
    const collection = new Collection({
      id: collectionId,
      status: `pending`,
      name: collectionName,
      alias: alias,
      flag: networkName,
      price: price,
      userSelect: userSelect,
      specialSat: specialSat,
      collectionDetails: collectionDetails,
      collectionAddress: collectionAddress,
      description: description,
      mintStage: mintStage,
      category: category,
      featuredCid: data.cid,
      startAt: startAt,
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

/**
 {"details": [{
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
}]} */
module.exports.addMintDetails = async (req, res) => {
  try{
    const {collectionId, mintDetails} = req.body;
    let saved = await addMintDetails(collectionId, mintDetails);
    let mintStage = await updateMintStage(collectionId, mintDetails.details[0].name);
    await Collection.findOneAndUpdate({id: collectionId}, {mintStage: mintStage}, {new: true});
    if(!saved) return res.status(200).json({status: false, message: "mint details not added"});
    return res.status(200).json({status: true, message: "mint details added"});
  }catch(e){
    console.log(e.message)
  return res.status(200).json({ status: false, message: e.message });
  };
}

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
    const {collectionId, name} = req.body;
    const addressFile = req.files.address;
    const mintDetails = await MintDetails.find({collectionId: collectionId});
    let mappedObjectId = mintDetails.map(val => val)
    let n_mintDetails = await MintDetails.find({_id: {$in: mappedObjectId}});
    let id;

    let details = [];
    n_mintDetails.forEach((detail) => {
      details.push(detail.name);
    })

    if(!details.includes(name)) return res.status(200).json({status: false, message: "Invalid mint stage name"});

    if (!existsSync(process.cwd() + `/src/address/${collectionId}`)) {
      mkdirSync(
        process.cwd() + `./src/address/${collectionId}`,
        { recursive: true },
        (err) => {
          console.log(err);
        }
      );
    }
    
    let _name = `addr-`+collectionId+`-`+name;
    let fileName = _name + path.extname(addressFile.name);

    
    const savePath = path.join(
      process.cwd(),
      "src",
      "address",
      `${collectionId}`,
      fileName
    );
    await addressFile.mv(savePath);

    let _data = fs.readFileSync(process.cwd()+`/src/address/${collectionId}/${fileName}`);
    let uploaded = await uploadToS3(fileName, _data);

    return res.status(200).json({status: true, message: "ok", userResponse: collectionId});
  }catch(e){
    console.log(e);
    return res.status(500).json({ status: false, message: e.message });
  }
}

module.exports.addCollectionItems = async (req, res) => {
  try {
    req.setTimeout(450000);
    const collectionId = req.body.collectionId;
    let collectionItems;
    let optimize;
    const itemCid = req.body.itemCid;
    let optimized;
    const collection = await Collection.findOne({ id: collectionId });
    
    if(collection.status === "approved") return res.status(200).json({ status: false, message: `collection items already added` });
    
    if(itemCid){
      collection.itemCid = itemCid;
    }else{
      collectionItems = req.files.items;
      optimize = req.body.optimize;

      if(!collectionItems) return res.status(200).json({status: false, message: "choose item(s) to upload"});
      if (collectionItems.length > 100) return res.status(200).json({status:false, message: "collection items above 100, upload images to ipfs and pass CID"});

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
      collection.itemCid = data.cid;
    }

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

module.exports.addCollectionServiceFee = async (req, res) => {
  try {
    const { collectionId, serviceFee } = req.body;
    const _ser = new ServiceFee({
      collectionId: collectionId,
      serviceFee: serviceFee,
    });
    await _ser.save();
    return res.status(200).json({ status: true, message: `service fee added`, userResponse: _ser.serviceFee });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.updateServiceFee = async (req, res) => {
  try {
    const { collectionId, serviceFee } = req.body;
    const _ser = await ServiceFee.findOneAndUpdate({ collectionId: collectionId }, { serviceFee: serviceFee }, { new: true });
    return res.status(200).json({ status: true, message: `service fee updated`, userResponse: _ser.serviceFee });
  } catch (e) {
    console.log(e.message);
    return res.status(400).json({ status: false, message: e.message });
  }
};

module.exports.approveCollection = async (req, res) => {
  try {
    const { collectionId } = req.body;
    const collection = await Collection.findOne({ id: collectionId });
    collection.status = "approved";
    await collection.save();
    return res
      .status(200)
      .json({ status: true, message: `collection approved`, userResponse: collectionId });
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.seleteItem = async (req, res) => {
  try {
    const { collectionId, receiveAddress, feeRate, imageNames, networkName, oldSats } = req.body;
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
    let cost;
    let sortedImages = [];
    let satsId;
    let walletKey;
    let ORD_API_URL;
    if(collection.ended === true) return res.status(200).json({status: false, message: "collection has ended"});
    if(collection.minted.length === collection.collectionDetails.totalSupply) return res.status(200).json({status: false, message: "collection has been minted out"});
    if(collection.startMint === false) return res.status(200).json({status: false, message: "Mint has not started"});
    if(collection.paused === true) return res.status(200).json({status: false, message: "Mint has been paused"});
    if(!receiveAddress) return res.status(200).json({status: false, message: "Receive Address is required"});
    if(!mintStage) return res.status(200).json({status: false, message: "mint stage not set"});
    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"});
    let verified = await verifyMint(collectionId, receiveAddress, imageNames.length);
    if(verified.message === "no valid address for mint stage") return res.status(200).json({status: false, message: "no valid address for mint stage"});
    if (verified.message === "complete pending order(s)")return res.status(200).json({status: true, message: "complete pending order(s)", userResponse: {}, pendingOrders: true})
    if (!verified.valid) return res.status(200).json({status: false, message: verified.message});
    let mintDetails = await MintDetails.findOne({_id: mintStage});
    const price = mintDetails.price;

    if (networkName === "mainnet")
    ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
    ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    if (imageNames.length > 1) {
      inscriptionId = `b${uuidv4()}`;
    } else {
      inscriptionId = `s${uuidv4()}`;
    }
  
    if (s_selectedItems.length == 0){
      items.forEach(async (newItem, index) => {
        for (const imageName of imageNames) {
          if (newItem.name === imageName) {
            images.push(newItem);
            fileSize.push(newItem.size);
          }
        }
      });

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
      if(s_minted.length >= 1) return res.status(200).json({status: false, message: `items already inscribed`, userResponse: s_minted});
      items.forEach((newItem, index) => {
        for (const imageName of imageNames) {
          if (newItem.name === imageName) {
            images.push(newItem);
            fileSize.push(newItem.size);
          }
        }
      });
    }

    if (imageNames.length > 1) {
      sortedImages = fileSize.sort((a, b) => a - b);
      cost = await inscriptionPrice(
        feeRate,
        sortedImages[sortedImages.length - 1],
        price,
        collectionId
      );
      const total = cost.total * imageNames.length;
      const cardinals = cost.inscriptionCost * imageNames.length;

      walletKey = await addWalletToOrd(inscriptionId, networkName);
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
      inscription = new BulkInscription({
        id: inscriptionId,
        flag: networkName,
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
      sortedImages = fileSize.sort((a, b) => a - b);
      cost = await inscriptionPrice(
        feeRate,
        sortedImages[sortedImages.length - 1],
        price,
        collectionId
      );
        //get offset and utxo from db
        if (oldSats === "true"){
          let sats = await Sats.findOne({_id: new ObjectId(process.env.OLD_SATS_ID)});
          if(!sats) return res.status(200).json({status: false, message: "No 2009 sats available"});
          if(sats.count >= sats.size) return res.status(200).json({status: false, message: "sat range exusted"});
          satsId = sats._id;
          const url = process.env.ORD_SAT_API_URL + `/ord/create/getMultipleReceiveAddr`;
          const r_data = {
            collectionName: "oldSatsWallet",
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

        } else {
          walletKey = await addWalletToOrd(inscriptionId, networkName);
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

        }      
      inscription = new Inscription({
        id: inscriptionId,
        flag: networkName,
        inscribed: false,
        feeRate: feeRate,
        collectionId: collectionId,
        selected: savedSelected._id,
        sat: satsId,

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

    let _savedId = [];
    _savedId.push(inscriptionId);
    await Address.findOneAndUpdate({mintStage: collection.mintStage, address: receiveAddress}, {$push: {pendingOrders: {$each: _savedId, $position: -1}}}, {new: true})

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

    return res.status(200).json({ status:true, message: "ok", userResponse: userResponse });
  } catch (e) {
    console.log(e.message);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.calc = async (req, res) => {
  try {
    const { collectionId, feeRate, imageNames } = req.body;
    const collection = await Collection.findOne({ id: collectionId });
    const cid = collection.itemCid;
    const items = await getLinks(cid);
    const minted = collection.minted;
    const mintStage = collection.mintStage;
    let s_selectedItems = await SelectedItems.find({collectionId: collectionId});
    let s_items = [];
    let s_selected = [];
    let s_minted = [];
    let images = [];
    let fileSize = [];
    let userResponse;
    let cost;
    let sortedImages = [];

    if(!mintStage) return res.status(200).json({status: false, message: "mint stage not set"});
    let mintDetails = await MintDetails.findOne({_id: mintStage});
    const price = mintDetails.price;
    
    if (s_selectedItems.length == 0){
      items.forEach((newItem, index) => {
        for (const imageName of imageNames) {
          if (newItem.name === imageName) {
            images.push(newItem);
            fileSize.push(newItem.size);
          }
        }
      });
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
      items.forEach((newItem, index) => {
        for (const imageName of imageNames) {
          if (newItem.name === imageName) {
            images.push(newItem);
            fileSize.push(newItem.size);
          }
        }
      });
    }

    if (imageNames.length > 1) {
      sortedImages = fileSize.sort((a, b) => a - b);
      cost = await inscriptionPrice(
        feeRate,
        sortedImages[sortedImages.length - 1],
        price,
        collectionId
      );
    } else {
      sortedImages = fileSize.sort((a, b) => a - b);
      cost = await inscriptionPrice(
        feeRate,
        sortedImages[sortedImages.length - 1],
        price,
        collectionId
      );
    }

    userResponse = {
      cost: {
        serviceCharge: cost.serviceCharge * imageNames.length,
        inscriptionCost: cost.inscriptionCost * imageNames.length,
        sizeFee: cost.sizeFee * imageNames.length,
        postageFee: cost.postageFee,
        total: cost.total * imageNames.length,
      },
      paymentAddress: "",
      inscriptionId: "",
      createdAt: "",
    };

    return res.status(200).json({ status:true, message: "ok", userResponse: userResponse });
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

    let imageNames = await getLinks(collection.itemCid);
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

module.exports.calSat = async (req, res) => {
  try{
    const { collectionId, receiveAddress, feeRate, networkName} = req.body;
    const collection = await Collection.findOne({ id: collectionId});
    const mintStage = collection.mintStage;
    let cost;
    let _feeRate;
    if(feeRate < 15){
      _feeRate = 15;
    }else{
      _feeRate = feeRate;
    }
    if(collection.mintCount === collection.collectionDetails.totalSupply) return res.status(200).json({status: false, message: "Collection has been minted out"})
    if(collection.startMint === false) return res.status(200).json({status: false, message: "Mint has not started"});
    if(collection.paused === true) return res.status(200).json({status: false, message: "Mint has been paused"});
    if(!collection.specialSat) return res.status(200).json({status: false, message: "no special Sat for collection"});
    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"})
    let verified = await verifyMint(collectionId, receiveAddress, 1);
    if (!verified.valid) return res.status(200).json({status: false, message: verified.message});

    if(!receiveAddress) return res.status(200).json({status: false, message: "Receive Address is required"});
    if(!mintStage) return res.status(200).json({status: false, message: "mint stage not set"});
    let mintDetails = await MintDetails.findOne({_id: mintStage});
    const price = mintDetails.price;

    cost = await inscriptionPrice(
      _feeRate,
      collection.collectionDetails.fileSize,
      price,
      collectionId
    );

    let _cost = {
        serviceCharge: cost.serviceCharge,
        inscriptionCost: cost.inscriptionCost + 10000,
        sizeFee: cost.sizeFee,
        postageFee: cost.postageFee,
        total: cost.total + 10000,
    }

    let userResponse = {
      cost: {
        serviceCharge: _cost.serviceCharge,
        inscriptionCost: _cost.inscriptionCost,
        sizeFee: _cost.sizeFee ,
        postageFee: _cost.postageFee,
        total: _cost.total,
      },
      paymentAddress: "",
      inscriptionId: "",
      createdAt: "",
    };
    return res.status(200).json({ status:true, message: "ok", userResponse: userResponse });
  }catch(e){
    console.log(e)
    return res.status(200).json({ status: false, message: e.message });
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
    let ORD_API_URL;
    let receiveAddress;
    let spendUtxo;
    let balance = 0;

    const collection = await Collection.findOne({id: collectionId});
    const changeAddress = collection.collectionAddress;

    if (networkName === "mainnet")
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === "testnet")
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    if (type === "single") {
      inscription = await Inscription.where("id").equals(inscriptionId);
      instance = inscription[0];
      balance = await getWalletBalance(instance.inscriptionDetails.payAddress, networkName).totalAmountAvailable;
      imageNames = instance.fileNames;
      receiveAddress = instance.receiver;
      let cost = instance.cost.inscriptionCost;
      if (balance < cost) {
        return res.status(200).json({
          status: false,
          message: `not enough cardinal utxo for inscription. Available: ${balance}`,
        });
      }
      if(instance.sat){
        let sat = await Sats.findOne({_id: instance.sat});
        utxo = sat.output;
        offSet = sat.startOffset + sat.count;
        spendUtxo = await getSpendUtxo(instance.inscriptionDetails.payAddress, "mainnet");
      }
    } else if (type === "bulk") {
      inscription = await BulkInscription.where("id").equals(inscriptionId);
      instance = inscription[0];
      balance = await getWalletBalance(instance.inscriptionDetails.payAddress, networkName).totalAmountAvailable;
      imageNames = instance.fileNames;
      receiveAddress = instance.receiver;
      let cost = instance.cost.cardinal;
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
        receiverAddress: receiveAddress,
        cid: collection.itemCid,
        inscriptionId: inscriptionId,
        imageName: imageNames,
        networkName: "mainnet",
        changeAddress: changeAddress,
        collectionId: collectionId,
        utxo: utxo,
        offSet: offSet,
        spendUtxo: spendUtxo,
        oldSatWallet: "oldSatsWallet",
      });
    }else{
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

    await Address.findOneAndUpdate({mintStage: collection.mintStage, address: instance.receiver}, {$inc: {mintCount: instance.fileNames.length}}, {new: true});
    await Collection.findOneAndUpdate({id: collectionId}, {$push: {inscriptions: {$each: details, $position: -1}}}, {$pull: {selected: {$in: instance.selected}}}, { new: true }); 
    if(instance.sat){
      await Sats.findOneAndUpdate({_id: instance.sat}, {$inc: {count: 1} }, {new: true });
    }
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
    const { networkName} = req.query;
    let collections = await Collection.find({ flag: networkName, status: "approved"});
    let collectionDetails = [];
    let _collections = [];
    let mappedObjectId = [];
      
    collections.map((collection) => {
      mappedObjectId.push(collection.mintStage)
        if(collection.userSelect === "false" && !collection.specialSat) {
          _collections.push({collectionId: collection.id, type: "single"})
        }else if(collection.userSelect === "true" && !collection.specialSat){
          _collections.push({collectionId: collection.id, type: "multiple"})
        }else if(collection.specialSat){
          _collections.push({collectionId: collection.id, type: "sat"})
        }
      });

      let mintDetail = await MintDetails.find({_id: {$in: mappedObjectId}});

    _collections.forEach((element, index) => {
      //filter the collection by collectionId and create an object that the collectionDetails including the type
      let collection = collections.filter((collection) => collection.id === element.collectionId);
      let price;
      mintDetail.forEach((mintStage) => {
        if(mintStage.collectionId === collection[0].id){
          price = mintStage.price/1e8;
        }
      });
      collectionDetails.push({
        collectionId: collection[0].id,
        collectionName: collection[0].name,
        alias: collection[0].alias,
        creatorName: collection[0].collectionDetails.creatorName,
        description: collection[0].description,
        price: price,
        category: collection[0].category,
        mintedCount: collection[0].inscriptions.length,
        bannerUrl: collection[0].banner,
        featuredUrl: collection[0].featuredImage,
        website: collection[0].collectionDetails.website,
        twitter: collection[0].collectionDetails.twitter,
        discord: collection[0].collectionDetails.discord,
        createdAt: collection[0].createdAt,
        updatedAt: collection[0].updatedAt,
        type: element.type,
        ended: collection[0].ended,
      });
    });

    return res.status(200).json({status: true, message: "ok", userResponse: collectionDetails})
  }catch(e){
    console.log(e.message);
    return res.status(200).json({status: false, message: e.message});
  }
};

module.exports.getCollection = async (req, res) => {
  try{
    const {collectionId, alias} = req.body;
    let collection;
    let mintStage;
    let price;
    let _mintStage;
    let mintDetails;
    let details = [];
    if(!collectionId && !alias) return res.status(200).json({status: false, message: "collectionId or alias is required"});
    if(alias){
      collection = await Collection.findOne({alias: alias});
      await updateMintStage1(collection.id);
      mintStage = collection.mintStage;
      mintDetails = collection.mintDetails;
    }else if(collectionId){
      await updateMintStage1(collectionId);
      collection = await Collection.findOne({id: collectionId});
      mintStage = collection.mintStage;
      mintDetails = collection.mintDetails;
    }
    
    let mappedObjectId = mintDetails.map(val => val.toString())
    let s_mintDetails = await MintDetails.find({_id: {$in: mappedObjectId}});
    s_mintDetails.forEach((item, index) => {
      if(item._id.toString() === mintStage.toString()){
        price = item.price/1e8;
        _mintStage = item.name;
        details.push({
          stage: item.name,
          price: item.price/1e8,
          mintLimit: item.mintLimit,
          duration: item.duration,
        })
      }else{
        details.push({
          stage: item.name,
          price: item.price/1e8,
          mintLimit: item.mintLimit,
          duration: item.duration,
        })
      }
    });
    let collectionItems;
    let type;
    if(collection.specialSat) {
      collectionItems = [];  
    }else{
      collectionItems = await getLinks(collection.itemCid);
    };
    let mintedItems = collection.minted;
    //let collectionCount = collectionItems.length;
    let mintedCount = mintedItems.length;

    if(collection.specialSat){
      if(!collection.mintCount) {
        mintedCount = 0;
      }else{
        mintedCount = collection.mintCount;
      }
    }

    if (collection.userSelect === "false" && !collection.specialSat) {
      type = "single";
    }else if(collection.userSelect === "true" && !collection.specialSat){
      type = "multiple";
    }else if(collection.specialSat){
      type = "sat";
    }
    let startedAt = collection.startAt;
    
    let collectionData = {
        collectionId: collection.id,
        collectionName: collection.name,
        creatorName: collection.collectionDetails.creatorName,
        description: collection.description,
        price: price / 1e8,
        category: collection.category,
        collectionCount: collection.collectionDetails.totalSupply,
        mintedCount: mintedCount,
        totalSupply: collection.collectionDetails.totalSupply,
        bannerUrl: collection.banner,
        featuredUrl: collection.featuredImage,
        website: collection.collectionDetails.website,
        twitter: collection.collectionDetails.twitter,
        discord: collection.collectionDetails.discord,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
        type: type,
        ended: collection.ended,
        mintStarted: collection.startMint,
        mintStage: _mintStage,
        startedAt: startedAt,
        stages: details,    
    }
    return res.status(200).json({status: true, message: "ok", userResponse: collectionData});
  }catch(e){
    console.log(e);
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

module.exports.mintOnSat = async (req, res) => {
  try{
    const { collectionId, receiveAddress, feeRate, networkName } = req.body;
    const collection = await Collection.findOne({ id: collectionId});
    const mintStage = collection.mintStage;
    let pendingOrders = false;
    let inscriptionId;
    let cost;
    let _feeRate;
    if(feeRate < 15){
      _feeRate = 15;
    }else{
      _feeRate = feeRate;
    }
    if(collection.mintCount === collection.collectionDetails.totalSupply) return res.status(200).json({status: false, message: "Collection has been minted out"})
    if(collection.startMint === false) return res.status(200).json({status: false, message: "Mint has not started"});
    if(collection.paused === true) return res.status(200).json({status: false, message: "Mint has been paused"});
    if(!collection.specialSat) return res.status(200).json({status: false, message: "no special Sat for collection"});
    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"})
    let verified = await verifyMint(collectionId, receiveAddress, 1);
    if (verified.message === "complete pending order(s)")return res.status(200).json({status: true, message: "complete pending order(s)", userResponse: {}, pendingOrders: true})
    if (!verified.valid) return res.status(200).json({status: false, message: verified.message});
    
    inscriptionId = `s${uuidv4()}`;

    if(!receiveAddress) return res.status(200).json({status: false, message: "Receive Address is required"});
    if(!mintStage) return res.status(200).json({status: false, message: "mint stage not set"});
    let mintDetails = await MintDetails.findOne({_id: mintStage});
    const price = mintDetails.price;

    cost = await inscriptionPrice(
      _feeRate,
      collection.collectionDetails.fileSize,
      price,
      collectionId
    );

    let _cost = {
        serviceCharge: cost.serviceCharge,
        inscriptionCost: cost.inscriptionCost,
        sizeFee: cost.sizeFee,
        postageFee: cost.postageFee,
        total: cost.total,
    }
    
    const url = process.env.ORD_SAT_API_URL + `/ord/create/getMultipleReceiveAddr`;
    const r_data = {
      collectionName: "oldSatsWallet",
      addrCount: 1,
      networkName: networkName,
    };
    const result = await axios.post(url, r_data);
    if (result.data.message !== "ok") {
      return res.status(200).json({status: false, message: result.data.message});
    }
    paymentAddress = result.data.userResponse.data[0];

    let inscription = new Inscription({
      id: inscriptionId,
      flag: networkName,
      inscribed: false,
      collectionId: collectionId,
    
      inscriptionDetails: {
        payAddress: paymentAddress,
      },
      cost: _cost,
      receiver: receiveAddress,
      feeRate: _feeRate,
      stage: "stage 1"
    });

    let _savedId = [];
    await inscription.save();
    _savedId.push(inscriptionId);
    await Address.findOneAndUpdate({mintStage: collection.mintStage, address: receiveAddress}, {$push: {pendingOrders: {$each: _savedId, $position: -1}}}, {new: true})
    userResponse = {
      cost: {
        serviceCharge: _cost.serviceCharge,
        inscriptionCost: _cost.inscriptionCost,
        sizeFee: _cost.sizeFee,
        postageFee: _cost.postageFee,
        total: _cost.total,
      },
      paymentAddress: paymentAddress,
      inscriptionId: inscriptionId,
      createdAt: inscription.createdAt,
    };
    return res.status(200).json({ status:true, message: "ok", userResponse: userResponse, pendingOrders: pendingOrders });
  } catch (e) {
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
  }
}

module.exports.getPendingOrders = async (req,res)=> {
  try{
    const {address, collectionId} = req.body;
    let collection = await Collection.findOne({id: collectionId});
    let mintDetails = collection.mintDetails;
    let _mappedObjectId = mintDetails.map(val => val.toString());
    let _address = await Address.find({mintStage:{$in: _mappedObjectId}, address: address});
    if(_address.length === 0)return res.status(200).json({status: false, message: "address not found for mint stage"})
    let newPendingOrder = [];
    _address.forEach((item) => {
      newPendingOrder = newPendingOrder.concat(item.pendingOrders);
    })
    let pendingOrders = [];
    let ids = newPendingOrder.map(val => val.toString())
    let _pendingOrders = await Inscription.find({id: {$in: ids}});
    _pendingOrders.forEach((item)=>{
      pendingOrders.push({
        orderId: item.id,
        paymentStatus: item.collectionPayment,
        inscriptionStatus: item.inscribed,
      })
    })
    return res.status(200).json({ status:true, message: "ok", userResponse: {pendingOrders: pendingOrders} });
  }catch(e){
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
}

module.exports.checkWhitelist = async (req, res) => {
  try{
    const {collectionId, address} = req.body;
    const collection = await Collection.findOne({id: collectionId});
    if(verifyAddress(address, collection.flag) === false) return res.status(200).json({status: false, message: "Invalid address"});
    if(collection.ended == true) {
      return res.status(200).json({status: false, message: "collection mint ended"});
    }else{
      const details = await checkWallet(collectionId, address);
      if(details.message == "No mint stage set") return res.status(200).json({status: false, message: "No mint stage set"});
      return res.status(200).json({status: true, message: "ok", userResponse: details});
    }
  }catch(err){
    console.log(err.message);
    return res.status(200).json({status: false, message: err.message});
  }
};

module.exports.inscribeCount = async (req, res) => {
  try{
    const {collectionId} = req.body;
    const inscriptions = await Inscription.find({collectionId: collectionId});
    let inscribed = 0;
    inscriptions.forEach((inscription) => {
      if(inscription.inscribed === true) inscribed++; 
    })
    return res.status(200).json({status: true, message: "ok", userResponse: inscribed});
  }catch(e){
    return res.status(200).json({ status: false, message: e.message });
  }
}

module.exports.getAddresses = async (req, res) => {
  try{
    const { collectionId} = req.body;
    const collection = await Collection.findOne({ id: collectionId});
    if(!collection) return res.status(200).json({status: false, message: "collection not found"});
    if(!collection.specialSat) return res.status(200).json({status: false, message: "no special Sat for collection"});
    const inscriptions = await Inscription.find({collectionId: collectionId});
    let addresses = [];
    await Promise.all(inscriptions.map(async (inscription) => { 
      if(inscription.inscribed === false && inscription.collectionPayment === "paid"){
        addresses.push({
          id: inscription._id,
          address: inscription.receiver,
          feeRate: inscription.feeRate,
          spendUtxo: inscription.spendTxid,
        });
      }
    }))
    console.log(new Date());
    return res.status(200).json({status: true, message: "ok", userResponse: addresses});
  }catch(e){
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.updateInscriptionDetails = async (req, res) => {
  try {
    req.setTimeout(450000);
    const { details, collectionId } = req.body;
    const collection = await Collection.findOne({ id: collectionId });

    const addressBulkOperations = details.map((element) => ({
      updateOne: {
        filter: { mintStage: collection.mintStage, address: element.address },
        update: { $inc: { mintCount: 1 } },
        upsert: true,
      },
    }));

    const collectionBulkOperations = details.map((element) => ({
      updateOne: {
        filter: { id: collectionId },
        update: { $push: { inscriptions: { $each: element.inscriptionId, $position: -1 } } },
        upsert: true,
      },
    }));

    const inscriptionBulkOperations = details.map((element) => ({
      updateOne: {
        filter: { _id: element.id },
        update: {
          $set: { inscribed: true, stage: "stage 3" },
          $push: { inscription: { $each: element.inscriptionId, $position: -1 } },
        },
        upsert: true,
      },
    }));

    await Address.bulkWrite(addressBulkOperations);
    await Collection.bulkWrite(collectionBulkOperations);
    await Inscription.bulkWrite(inscriptionBulkOperations);

    return res.status(200).json({ status: true, message: "ok" });
  } catch (error) {
    return res.status(200).json({ status: false, message: error.message });
  }
};

module.exports.startMint = async (req, res) => {
  try{
    const {collectionId} = req.body;
    await Collection.findOneAndUpdate({id: collectionId}, {startMint: true},{new: true});
    return res.status(200).json({status: true, message: "ok"});
  }catch(e){
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.stopMint = async (req, res) => {
  try{
    const {collectionId} = req.body;
    const collection = await Collection.findOneAndUpdate({id: collectionId}, {startMint: false}, {new: true});
    return res.status(200).json({status: true, message: "ok"});
  }catch(e){
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.pause = async (req, res) => {
  try{
    const {collectionId} = req.body;
    const collection = await Collection.findOne({id: collectionId});
    if(!collection) return res.status(200).json({status: false, message: "collection not found"});
    if(collection.paused === true) return res.status(200).json({status: false, message: "collection already paused"});
    await Collection.findOneAndUpdate({id: collectionId}, {paused: true}, {new: true});
    return res.status(200).json({status: true, message: "collection Paused"});
  }catch(e){
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.unpause = async (req, res) => {
  try{
    const {collectionId} = req.body;
    const collection = await Collection.findOne({id: collectionId});
    if(!collection) return res.status(200).json({status: false, message: "collection not found"});
    if(collection.paused === false) return res.status(200).json({status: false, message: "collection already paused"});
    await Collection.findOneAndUpdate({id: collectionId}, {paused: false}, {new: true});
    return res.status(200).json({status: true, message: "collection unPaused"});
  }catch(e){
    return res.status(200).json({ status: false, message: e.message });
  }
};


//getLinks("QmUZwDUdMbvyvr6FcD16qF3FyhS88MTiBMut1cdcY5Ximv").then((res) => {console.log(res)}).catch((e) => console.log(e.message));
//create a new model for address that has made payment and update the new model at check payment with 
//change destination, satType, feeRate,


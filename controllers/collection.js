const { existsSync, mkdirSync } = require("fs");
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
const Collection = require("../model/collection");
const SelectedItems = require("../model/selectedItems");
const ServiceFee = require("../model/serviceFee");
const SpecialSat = require("../model/specialSats");
const UserReward = require("../model/specialSats");
const FeaturedCollections = require("../model/featuredCollection");
const { getType } = require("../helpers/getType");
const {usdToSat} = require("../helpers/btcToUsd")
const {
  addWalletToOrd,
  verifyAddress,
} = require("../helpers/walletHelper");
const { compressAndSaveBulk, uploadToS3, downloadAddressFile,downloadAllAddressFile } = require("../helpers/imageHelper");
const {createCollectionLegacyAddress} = require("../helpers/sendBitcoin2");
const {getSats} = require("../helpers/satHelper")
const MintDetails = require("../model/mintDetails");
const {inscribe} = require("../helpers/inscriptionHelper")
const ObjectId = require('mongoose').Types.ObjectId; 

const getLinks = async (cid, totalSupply) => {
  const client = await import("ipfs-http-client");
  try {
    let links = [];
    const url = "https://dweb.link/api/v0";
    const ipfs = client.create({ url });

    for await (const link of ipfs.ls(cid)) {
      links.push(link);
    }
    if(links.length === totalSupply) return links
    return links.splice(links.length - totalSupply, totalSupply);
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
      if (x.satType === type) price = x.price
    })
    return (await usdToSat(price)).satoshi
  }catch(e){
    console.log(e.message)
  }
}

const inscriptionPrice = async (feeRate, fileSize, price, collectionId, satType, usePoints) => {
  const serviceCharge = parseInt(await getServiceFee(collectionId));
  const sats = Math.ceil((fileSize / 4) * feeRate);
  const cost = sats + 1500 + 550 + 5000;
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
  const total = serviceCharge + cost + sizeFee + price + satCost;
  return {
    serviceCharge,
    inscriptionCost: cost + sizeFee,
    sizeFee: sizeFee,
    postageFee: 550,
    satCost: satCost,
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
    let allDetails = []
    details.forEach(async (detail) => {
      //convert duration from hours to seconds
      let duration = detail.duration * 60 * 60;
      allDetails.push({
          collectionId: collectionId,
          name: detail.name,
          mintLimit: detail.mintLimit,
          price: detail.price * 1e8,
          duration: duration,
        })
    });
    let savedDetails = await MintDetails.insertMany(allDetails);
    let ids = savedDetails.map(item => item._id)
    return ids;
  }catch(e){
    console.log(e.message);
  }
}

const checkWallet = async (collectionId, address) => {
  try{
    const mintStages = await MintDetails.find({collectionId: collectionId});
    let stagNames = [];
    let params = [];
    let addresses = [];
    mintStages.forEach(async (stage) => {
      if(stage.name !== "public" || stage.name !== "Public"){
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
        }else if(s_address.pendingOrders.length >= mintStage.mintLimit){
          let pendingOrders = [];
          let inactivePendingOrder = []
          let mappedObjectId = s_address.pendingOrders.map(val => val.toString())
          let _pendingOrders = await Inscription.find({id: {$in: mappedObjectId}});
          _pendingOrders.forEach((item)=>{
            if(checkTimeElapsed(item.createdAt) === true){
              inactivePendingOrder.push(item.id)
            }else{
              pendingOrders.push({
                orderId: item.id,
                paymentStatus: item.collectionPayment,
                inscriptionStatus: item.inscribed,
              })
            }
          })

          console.log(inactivePendingOrder.length)

          if(inactivePendingOrder.length > 0){
            await Address.findOneAndUpdate({mintStage: collection.mintStage, address: address}, {$pull: {pendingOrders: {$in: inactivePendingOrder}}}, {new:true});
            if(amount + pendingOrders.length > mintStage.mintLimit){
              return data = {
                valid: true,
                price: mintStage.price,
                mintCount: s_address.mintCount,
                message: "complete pending order(s)",
                userResponse: {
                  pendingOrders: pendingOrders
                }
              }
            }else{
              return data = {
                valid: true,
                price: mintStage.price,
                mintCount: s_address.mintCount,
                message: `valid mint`
              }
            }
          }else{
            return data = {
              valid: true,
              price: mintStage.price,
              mintCount: 0,
              message: "complete pending order(s)",
              userResponse: {
                pendingOrders: pendingOrders
              },
            }
          }
        }else{
          c_address = s_address;   
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
      //download address list
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

      //clean up address
      let regex = /[^,\r\n]+/g;
      let _allowedAddress = fs.readFileSync(process.cwd()+`/src/address/${collectionId}/${stage_name}`, { encoding: 'utf8'})
      
      if(_allowedAddress.length === 0){
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
      let allowedAddress = _allowedAddress.match(regex)
      allowedAddress = allowedAddress.filter((item, index) => {
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
        }else if(s_address.pendingOrders.length >= mintStage.mintLimit){
            let pendingOrders = [];
            let inactivePendingOrder = []
            let mappedObjectId = s_address.pendingOrders.map(val => val.toString())
            let _pendingOrders = await Inscription.find({id: {$in: mappedObjectId}});
            _pendingOrders.forEach((item)=>{
              //use moment to get time difference
              
              if(checkTimeElapsed(item.createdAt) === true){
                inactivePendingOrder.push(item.id)
              }else{
                pendingOrders.push({
                  orderId: item.id,
                  paymentStatus: item.collectionPayment,
                  inscriptionStatus: item.inscribed,
                })
              }
            })

            if(inactivePendingOrder.length > 0){
              await Address.findOneAndUpdate({mintStage: collection.mintStage, address: address}, {$pull: {pendingOrders: {$in: inactivePendingOrder}}}, {new:true});
              if(amount + pendingOrders.length > mintStage.mintLimit){
                return data = {
                  valid: true,
                  price: mintStage.price,
                  mintCount: s_address.mintCount,
                  message: "complete pending order(s)",
                  userResponse: {
                    pendingOrders: pendingOrders
                  }
                }
              }else{
                return data = {
                  valid: true,
                  price: mintStage.price,
                  mintCount: s_address.mintCount,
                  message: `valid mint`
                }
              }
            }else{
              return data = {
                valid: true,
                price: mintStage.price,
                mintCount: 0,
                message: "complete pending order(s)",
                userResponse: {
                  pendingOrders: pendingOrders
                },
              }
            }
        }else{
          c_address = s_address;   
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
    let files = []
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

    let file = req.files
    files.push(file.banner[0], file.featuredImage[0])
    console.log(files)

    if(!mintDetails) return res.status(200).json({status: false, message: "mint details required"});
    const collectionId = `c${uuidv4()}`;
    if(verifyAddress(creatorsAddress, networkName) === false) return res.status(200).json({status: false, message: `crestors address not valid for ${networkName}`});
    const count = await Collection.find({}, { _id: 0 });
    const alias = `${collectionName.replace(/\s/g, "")}_${count.length}`;

    const collactionAddressDetails = await createCollectionLegacyAddress(networkName, count.length);
    let collectionAddress = collactionAddressDetails.p2pkh_addr;
    let collectionAddressId = count.length;

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

    const data = await compressAndSaveBulk(files, "" , false); //let startTime = new Date(startAt).getTime();

    let ids = await addMintDetails(collectionId, JSON.parse(mintDetails));
    const collection = new Collection({
      id: collectionId,
      status: `pending`,
      name: collectionName,
      alias: alias,
      flag: networkName,
      price: price * 1e8,
      userSelect: userSelect,
      specialSat: specialSat,
      collectionDetails: collectionDetails,
      collectionAddress: collectionAddress,
      description: description,
      mintStage: ids[ids.length-1],
      mintDetails:ids,
      category: category,
      featuredCid: data.cid,
      startAt: startAt,
      banner: process.env.IPFS_IMAGE_URL + data.cid + `/banner`,
      featuredImage:
        process.env.IPFS_IMAGE_URL + data.cid + `/featuredImage`,
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
}]*/
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
    const addressFile = req.files;
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
    let fileName = _name + path.extname(addressFile.fileName);

    
    const savePath = path.join(
      process.cwd(),
      "src",
      "address",
      `${collectionId}`,
      fileName
    );
    await addressFile.mv(savePath);

    let _data = fs.readFileSync(process.cwd()+`/src/address/${collectionId}/${fileName}`);
    await uploadToS3(fileName, _data);

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

module.exports.selectItem = async (req, res) => {
  try {
    const { collectionId, receiveAddress, feeRate, imageNames, networkName, oldSats, usePoints } = req.body;
    const collection = await Collection.findOne({ id: collectionId });
    const cid = collection.itemCid;
    const items = await getLinks(cid, collection.collectionDetails.totalSupply);
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
    if(verified.message === "complete pending order(s)")return res.status(200).json({status: false, message: "complete pending order(s)", userResponse: {}, pendingOrders: true})
    if(!verified.valid) return res.status(200).json({status: false, message: verified.message});
    let mintDetails = await MintDetails.findOne({_id: mintStage});
    const price = mintDetails.price;

    let hasReward
    let userReward = await UserReward.findOne({address: receiveAddress})
    if(!userReward) {
      hasReward = false
    }else {
      if(usePoints !== undefined && usePoints === true){
        if(userReward.totalPoints < inscriptionPoint) {
          return res.status(200).json({status: false, message: "user total scribe points is less than required point"})
        }else{
          hasReward = true
        }
      }else{
        hasReward = false
      }
    }

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

    sortedImages = fileSize.sort((a, b) => a - b);
      cost = await inscriptionPrice(
        feeRate,
        sortedImages[sortedImages.length - 1],
        price,
        collectionId,
        oldSats,
        hasReward
    );

    if (imageNames.length > 1) {
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
        if (oldSats !== "random"){
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
        sat: oldSats,

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
        satCost: cost.satCost,
        postageFee: cost.postageFee,
        price: price/1e8,
        priceInSat: price,
        total: cost.total * imageNames.length,
      },
      paymentAddress: paymentAddress,
      inscriptionId: inscriptionId,
      createdAt: inscription.createdAt,
    };

    return res.status(200).json({ status:true, message: "ok", userResponse: userResponse });
  } catch (e) {
    console.log(e);
    if(e.request) return res.status(200).json({status: false, message: e.message});
    if(e.response) return res.status(200).json({status: false, message: e.response.data});
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.calc = async (req, res) => {
  try {
    let { collectionId, feeRate, imageNames, oldSats, usePoints, receiveAddress, networkName} = req.body;
    const collection = await Collection.findOne({ id: collectionId });
    const cid = collection.itemCid;
    const items = await getLinks(cid, collection.collectionDetails.totalSupply);
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
    if(networkName === undefined) networkName = "mainnet"
    if(verifyAddress(receiveAddress, networkName) === false) return res.status(200).json({status: false, message: "Invalid address"});

    let hasReward
    let userReward = await UserReward.findOne({address: receiveAddress})
    if(!userReward) {
      hasReward = false
    }else {
      if(usePoints !== undefined && usePoints === true){
        if(userReward.totalPoints < inscriptionPoint) {
          return res.status(200).json({status: false, message: "user total scribe points is less than required point"})
        }else{
          hasReward = true
        }
      }else{
        hasReward = false
      }
    }

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

    sortedImages = fileSize.sort((a, b) => a - b);
    cost = await inscriptionPrice(
      feeRate,
      sortedImages[sortedImages.length - 1],
      price,
      collectionId,
      oldSats,
      hasReward
    );
    
    userResponse = {
      cost: {
        serviceCharge: cost.serviceCharge * imageNames.length,
        inscriptionCost: cost.inscriptionCost * imageNames.length,
        sizeFee: cost.sizeFee * imageNames.length,
        satCost: cost.satCost,
        postageFee: cost.postageFee,
        price: price/1e8,
        priceInSat: price,
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

module.exports.getImages = async(req, res) => {
  try{
    const {collectionId} = req.body;
    const collection = await Collection.findOne({id: collectionId});
    if(!collection) return res.status(200).json({status: false, message: "collection not found"})
    if(collection.startMint === false || collection.ended === true) return res.status(200).json({status: true, message:"ok", userResponse: []})
    let minted = collection.minted;
    let selectedItems = await SelectedItems.find({collectionId: collectionId});
    let items = [];
    let s_items = [];
    let s_minted = [];
    let s_free = [];
    let s_selected = [];
    let selectedImages = [];

    let imageNames = await getLinks(collection.itemCid, collection.collectionDetails.totalSupply);
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
            fileType: image.split(".")[1],
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
            fileType:image.split(".")[1],
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
          fileType: image.name.split(".")[1],
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
          fileType: image.name.split(".")[1],
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

module.exports.inscribe1 = async (req, res) => {
  try{
    req.setTimeout(450000);
    const {inscriptionId, networkName} = req.body;
    let result = await inscribe({inscriptionId:inscriptionId, networkName:networkName})
    if(result.status === false){
      return res.status(200).json({status:result.status, message:result.message, userResponse: []})
    }else{
      return res.status(200).json({status:result.status, message:result.message, userResponse: result.ids})
    } 
  } catch(e) {
    console.log(e);
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
    let priceInSat;
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
    let totalSupply = collection.collectionDetails.totalSupply;
    let mappedObjectId = mintDetails.map(val => val.toString())
    let s_mintDetails = await MintDetails.find({_id: {$in: mappedObjectId}});
    s_mintDetails.forEach((item, index) => {
      if(item._id.toString() === mintStage.toString()){
        price = item.price / 1e8;
        priceInSat = item.price;
        _mintStage = item.name;
        details.push({
          stage: item.name,
          price: price,
          priceInSat: item.price,
          mintLimit: item.mintLimit,
          duration: item.duration,
        })
      }else{
        details.push({
          stage: item.name,
          price: item.price/1e8,
          priceInSat: item.price,
          mintLimit: item.mintLimit,
          duration: item.duration,
        })
      }
    });
    let type;

    let mintedItems = collection.minted;
    let mintedCount = mintedItems.length;

    if(collection.ended === true && collection.minted.length === 0){
      mintedCount = collection.collectionDetails.totalSupply
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
        price: price,
        priceInSat: priceInSat,
        category: collection.category,
        collectionCount: collection.collectionDetails.totalSupply,
        mintedCount: mintedCount,
        totalSupply: totalSupply,
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
      if(item.inscribed !== true && item.collectionPayment === "paid"){
        pendingOrders.push({
          orderId: item.id,
          paymentStatus: "waiting",
          inscriptionStatus: item.inscribed,
        })
      }else{
        pendingOrders.push({
          orderId: item.id,
          paymentStatus: item.collectionPayment,
          inscriptionStatus: item.inscribed,
        })
      }
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
    console.log(err);
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
    return res.status(200).json({status: true, message: "ok", userResponse: addresses});
  }catch(e){
    return res.status(200).json({ status: false, message: e.message });
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


///featured collection
module.exports.addFeaturedCollection = async (req,res)=> {
  try{
    let collectionIds = req.body.collectionIds;
    let collections = await Collection.find({})
    let invalidIds = []
    let validIds = []
    let availableIds = collections.map((x)=> {
      return x.id
    })
    
    
    collectionIds.forEach(item => {
      if(!availableIds.includes(item)){ 
        invalidIds.push(item)
      }else{
        validIds.push(item)
      }
    })
    
    let featuredCollection = await FeaturedCollections.find({})
    console.log(featuredCollection[0])
    let featuredColllectionId = featuredCollection[0]._id;
    
    if(!featuredCollection){
      let collection = new FeaturedCollections({
        ids: validIds
      })
      let saved = await collection.save()
      return res.status(200).json({status:true, message: "featured collection list added" , id: saved._id})
    }else{
      validIds.concat(featuredCollection[0].ids)
      await FeaturedCollections.findOneAndUpdate({_id: featuredColllectionId}, {$set: {ids: validIds}}, {new:true}) 
      return res.status(200).json({status:true, message: `${validIds.length} valid collection ids added. ${invalidIds.length} invalid collection ids`})
    }
  }catch(e){
    console.log(e.message);
    return res.status(200).json({status: false, message: e.message});
  }
}

module.exports.removeFeaturedCollection = async (req,res)=> {
  try{
    let collectionId = req.body.collectionId;
    let collections = await Collection.find({})
    let availableIds = collections.map((x)=> {
      return x.id
    })
   
    if(!availableIds.includes(collectionId))return res.status(200).json({status:false, message: "invalid collectionId"})
    let featuredCollection = await FeaturedCollections.find({})
    if(!featuredCollection){
      return res.status(200).json({status:false, message: "no featured collection added"})
    }else{
      let ids = featuredCollection[0].ids
      if(!ids.includes(collectionId)) return res.status(200).json({status:false, message: "collection not part of featured collection"})
      ids.splice(ids.indexOf(collectionId),1)
      await FeaturedCollections.findOneAndUpdate({_id:featuredCollection[0]._id},{$set:{ids:ids}},{new:true})
      return res.status(200).json({status:true, message: "featured collection removed"})
    }
  }catch(e){
    console.log(e);
    return res.status(200).json({status: false, message: e.message});
  }
}

module.exports.getFeaturedCollections = async (req,res)=> {
  try{
    let networkName = req.body.networkName
    let _collections = await FeaturedCollections.find({})
    let ids = []
    let data = []
    if (!_collections){
      let collections = await Collection.find({ flag: networkName, status: "approved"})
      collections.forEach(item => ids.push(item.id))
    }else {
      ids = _collections[0].ids;
    }
    let collections = await Collection.find({id: {$in: ids}})
    collections.forEach(item => {
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
      })
    })
    return res.status(200).json({status:true, message: "featured collections", userResponse: data});
  }catch(e){
    console.log(e.message);
    return res.status(200).json({status: false, message: e.message});
  }
}

///special sat
module.exports.getAvailableSat = async (req,res) => {
  try{
    let sats = await getSats()
    return res.status(200).json({status: true, message: "ok", userResponse: sats})
  }catch(e){
    console.log(e.message);
    return res.status(200).json({status: false, message: e.message});
  }
}

module.exports.updateSatCost = async (req,res)=> {
  try{
    //[{satType: "pizza", price: 0.5}]
    let {satDetails} = req.body;
    let specialSat = await SpecialSat.find({})
    let uniqueSat = []
    let available = []
    if(!specialSat){
     await SpecialSat.insertMany(satDetails)
    }else{
      let satTypes = specialSat.map((sat)=> {
        return sat.satType
      })
      satDetails.forEach(type => {
        if(!satTypes.includes(type.satType)){
          uniqueSat.push(type)
        }else{
          available.push(type)
        }
      })
      await SpecialSat.insertMany(uniqueSat)
      
      await SpecialSat.bulkWrite(available.map((sat) => {
        return {
          updateOne: {
            filter: {satType: sat.satType},
            update: {price: sat.price},
            upsert: true,
          }
        }
      }))
    }
    return res.status(200).json({status: true, message: "sat price added"})
  }catch(e){
    console.log(e.message);
    return res.status(200).json({status: false, message: e.message});
  }
}

module.exports.getSatCost = async (req, res) => {
  try{
    return res.status(200).json({status: true, message: "sat cost", userResponse: await getSatPrices()})
  }catch(e){
    console.log(e.message)
  }
}



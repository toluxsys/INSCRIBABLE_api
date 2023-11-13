const axios = require("axios");
const dotenv = require("dotenv").config();
const fs = require("fs");
const ObjectId = require('mongoose').Types.ObjectId; 
const RabbitMqClient = require("./queue/rabbitMqClient.js");
const Inscription = require("../model/inscription");
const SelectedItems = require("../model/selectedItems");
const BulkInscription = require("../model/bulkInscription");
const Address = require("../model/address");
const Collection = require("../model/collection");
const Task = require("../model/task")
const interval = 15;
const moment = require("moment");
const {
  getWalletBalance,
  getSpendUtxo
} = require("../helpers/sendBitcoin");
const { getType } = require("./getType");
const {perform_task} = require("./rewardHelper.js")

const verifyList = (arr1, arr2) => {
  const set = new Set(arr1);
  for (const value of arr2) {
      if (set.has(value)) {
          return true; 
      }
  }

  return false;
}

const defaultInscribe = async ({inscriptionId, networkName}) => {
    try {    
        const type = getType(inscriptionId);
        let inscription;
        let newInscription ;
        let imageName;
        let n_inscriptions;
        let details = [];
        let balance = 0;
        let cost = 0;
        let ORD_API_URL;
        let receiverAddress;
        let changeAddress
  
      if (networkName === "mainnet"){
        ORD_API_URL = process.env.ORD_MAINNET_API_URL;
        if(!changeAddress) changeAddress = process.env.MAINNET_SERVICE_CHARGE_ADDRESS;
      }
        
      if (networkName === "testnet"){
        ORD_API_URL = process.env.ORD_TESTNET_API_URL;
        if(!changeAddress) changeAddress = process.env.TESTNET_SERVICE_CHARGE_ADDRESS;
      }
      
      if (type === "single") {
        inscription = await Inscription.findOne({id: inscriptionId});
        if(!inscription) return {message: "inscription not found", data: {ids: []}, status: false, key: "inscription_not_found"};
        balance = await getWalletBalance(inscription.inscriptionDetails.payAddress, networkName).totalAmountAvailable;
        imageName = inscription.inscriptionDetails.fileName;
        receiverAddress = inscription.receiver;
        cost = inscription.cost.inscriptionCost;
        
      } else if (type === "bulk") {
        inscription = await BulkInscription.findOne({id: inscriptionId});
        if(!inscription) return {message: "inscription not found", data: {ids: []}, status: false, key: "inscription_not_found"};
        balance = await getWalletBalance(inscription.inscriptionDetails.payAddress, networkName).totalAmountAvailable;  
        receiverAddress = inscription.receiver;
        cost = inscription.cost.cardinal;
      }else{
        return {
          message: "invalid Id",
          data: {
            ids: [],
            txid: ""
          },
          status: false,
          key: "Invalid_id"
        }
      }
      
      if (balance < cost) {
        return {message: "available balance in payment address is too low for transaction",status:false, data: {ids: []}}
      }
      
      if(inscription.sat && inscription.sat !=="random"){ 
        let spendUtxo = (await getSpendUtxo(inscription.inscriptionDetails.payAddress, networkName)).output
        if(spendUtxo === "") return {message: "no available spend utxo in address", status:false, data:{ids: []}}
        if(inscription.s3 === true){
          newInscription = await axios.post(process.env.ORD_SAT_API_URL + `/ord/inscribe/oldSats`, {
            feeRate: inscription.feeRate,
            receiverAddress: receiverAddress,
            type: inscription.sat,
            imageName: imageName,
            networkName: "mainnet",
            spendUtxo: spendUtxo.output,
            changeAddress: changeAddress,
            walletName: "oldSatsWallet",
            storageType: "AWS",
          });
        }else{
          newInscription = await axios.post(process.env.ORD_SAT_API_URL + `/ord/inscribe/oldSats`, {
            feeRate: inscription.feeRate,
            receiverAddress: receiverAddress,
            cid: inscription.inscriptionDetails.cid,
            inscriptionId: inscriptionId,
            type: inscription.sat,
            imageName: imageName,
            networkName: "mainnet",
            spendUtxo: spendUtxo,
            changeAddress: changeAddress,
            walletName: "oldSatsWallet",
            storageType: "IPFS",
          });
        }
      }else {
        if(inscription.s3 === true){
          newInscription = await axios.post(ORD_API_URL + `/ord/inscribe/changeS3`, {
            feeRate: inscription.feeRate,
            receiverAddress: receiverAddress,
            cid: inscription.inscriptionDetails.cid,
            inscriptionId: inscriptionId,
            type: type,
            imageName: imageName,
            networkName: networkName,
            changeAddress: changeAddress,
            imageNames: inscription.fileNames,
          });
        } else {
          newInscription = await axios.post(ORD_API_URL + `/ord/inscribe/change`, {
            feeRate: inscription.feeRate,
            receiverAddress: receiverAddress,
            cid: inscription.inscriptionDetails.cid,
            inscriptionId: inscriptionId,
            type: type,
            imageName: imageName,
            networkName: networkName,
            changeAddress: changeAddress,
          });
        }   
      }

      if(newInscription.data.status == false){
        return {message: newInscription.data.message, status:false, data:{ids: []}}
      }else if (typeof newInscription.data.userResponse.data === 'string') {
        return {message: `error inscribing item`, status:false, data: {ids: []}}
      }else{
     
        n_inscriptions = newInscription.data.userResponse.data;
        if(newInscription.data.userResponse.data.length === 0) return {message: `error inscribing item`,status: false,  data:{ids: []}}
        if(inscription.sat !== "random"){
          details = n_inscriptions.map((item) => {
            return {
              inscription: item,
            }; 
          });
        }else{
          let ids = []
          for(let i = 0; i< n_inscriptions.length; i++){
            let insc_arr = n_inscriptions[i]
            insc_arr.forEach(x => ids.push(x))
          }

          details = ids.map((item) => {
            return {
              inscription: item,
            }; 
          });
        }
        inscription.inscription = details;
        inscription.sent = true;
        inscription.inscribed = true;
        inscription.error = false
        inscription.errorMessage =  ""
        inscription.stage = "stage 3";
        await inscription.save();
        return {
            message: `inscription complete`,
            status: true,  
            data:{ids: details}
        };
      }
    } catch (e) {
      console.log(e.message);
    }
};

const collectionInscribe = async ({inscriptionId, networkName}) => {
    try{
      const type = getType(inscriptionId);
      let inscription;
      let newInscription;
      let imageNames;
      let n_inscriptions;
      let details = [];
      let ORD_API_URL;
      let receiveAddress;
      let balance = 0;
      let cost = 0
  
      if (networkName === "mainnet")
        ORD_API_URL = process.env.ORD_MAINNET_API_URL;
      if (networkName === "testnet")
        ORD_API_URL = process.env.ORD_TESTNET_API_URL;
  
      if (type === "single") {
        inscription = await Inscription.findOne({id: inscriptionId});
        balance = await getWalletBalance(inscription.inscriptionDetails.payAddress, networkName).totalAmountAvailable;
        imageNames = inscription.fileNames;
        receiveAddress = inscription.receiver;
        cost = inscription.cost.inscriptionCost;
      } else if (type === "bulk") {
        inscription = await BulkInscription.findOne({id: inscriptionId});
        balance = await getWalletBalance(inscription.inscriptionDetails.payAddress, networkName).totalAmountAvailable;
        imageNames = inscription.fileNames;
        receiveAddress = inscription.receiver;
        cost = inscription.cost.cardinal;
      }else{
        return {
          message: "invalid Id",
          data: {
            ids: [],
            txid: ""
          },
          status: false,
          key: "Invalid_id"
        }
      }

      const collection = await Collection.findOne({id: inscription.collectionId});
      const changeAddress = collection.collectionAddress;

      if (balance < cost) {
        return {message: "available balance in payment address is too low for transaction", status:false, data:{ids: []}}
      }
  
      if(inscription.sat !== "random"){ 
        let spendUtxo = await getSpendUtxo(inscription.inscriptionDetails.payAddress, networkName)
        newInscription = await axios.post(process.env.ORD_SAT_API_URL + `/ord/inscribe/oldSats`, {
          feeRate: inscription.feeRate,
          receiverAddress: receiveAddress,
          collectionId: inscription.collectionId,
          cid: collection.itemCid,
          imageNames: imageNames,
          type: inscription.sat,
          networkName: "mainnet",
          spendUtxo: spendUtxo.output,
          changeAddress: changeAddress,
          inscriptionId: inscriptionId,
          walletName: "oldSatsWallet",
          storageType: "IPFS",
          paymentAddress: inscription.inscriptionDetails.payAddress
        });
      }else{
        newInscription = await axios.post(ORD_API_URL + `/ord/inscribe/change`, {
          feeRate: inscription.feeRate,
          receiverAddress: receiveAddress,
          cid: collection.itemCid,
          inscriptionId: inscriptionId,
          networkName: networkName,
          collectionId: inscription.collectionId,
          imageNames: imageNames,
          changeAddress: changeAddress
        });
        console.log(newInscription)
      }

      if(newInscription.data.status == false){
        return {message: newInscription.data.message, status:false, data:{ids: []}}
      }else if (typeof newInscription.data.userResponse.data === 'string') {
        return {message: newInscription.data.userResponse.data, status:false, data:{ids: []}}
      }else{
        
        n_inscriptions = newInscription.data.userResponse.data;
        if(newInscription.data.userResponse.data.length === 0) return {message: `error inscribing item`,status: false,  data:{ids: []}}
        if(inscription.sat !== "random"){
          details = n_inscriptions.map((item) => {
            return {
              inscription: item,
            }; 
          });
        }else{
          let ids = []
          for(let i = 0; i< n_inscriptions.length; i++){
            let insc_arr = n_inscriptions[i]
            insc_arr.forEach(x => ids.push(x))
          }

          details = ids.map((item) => {
            return {
              inscription: item,
            }; 
          });
        }

        inscription.error = false
        inscription.errorMessage =  ""
        inscription.inscription = details;
        inscription.sent = true;
        inscription.inscribed = true;
        inscription.stage = "stage 3";
        await inscription.save();
        
        await Address.findOneAndUpdate({mintStage: collection.mintStage, address: inscription.receiver}, {$inc: {mintCount: inscription.fileNames.length}}, {new: true});
        await Collection.findOneAndUpdate({id: inscription.collectionId}, {$push: {inscriptions: {$each: details, $position: -1}}}, {$pull: {selected: {$in: inscription.selected}}}, { new: true }); 
        return {
            message: `inscription complete`,
            status:false, 
            data:{ids: details}
        };
      }
    } catch(e) {
        //if(e.message === ) 
        console.log(e.message);
    }
};

const checkCollectionPayment = async ({inscriptionId, networkName}) => {
    try{
        const type = getType(inscriptionId);
        let inscription;
        let balance;
        let cost = 0;
        let txid = "";
        let _txid;
        let mintCount;
        let result;
        let exists;
        let _savedCollection;
    
        if (type === `single`) {
            inscription = await Inscription.findOne({ id: inscriptionId });
            if(!inscription) return {message: "inscription not found", data: {txid: txid, ids: []}, status: false, key: "inscription_not_found"};
            balance = await getWalletBalance(
            inscription.inscriptionDetails.payAddress,
            networkName
            );
            cost = inscription.cost.total;
        } else if (type === `bulk`) {
            inscription = await BulkInscription.findOne({ id: inscriptionId });
            if(!inscription) return {message: "inscription not found", data: {txid: txid, ids: []}, status: false, key: "inscription_not_found"};
            balance = await getWalletBalance(
            inscription.inscriptionDetails.payAddress,
            networkName
            );
            cost = inscription.cost.total;
        }else{
          return {
            message: "invalid Id",
            data: {
              ids: [],
              txid: ""
            },
            status: false,
            key: "Invalid_id"
          }
        }
        
        if(inscription.inscribed === true) return {message: "order complete", data: {txid: txid, ids: inscription.inscription}, status: true}
        if(balance.totalAmountAvailable == 0) return {message: "payment address is empty", data: {txid: txid, ids: []}, status: false}
        if(balance.totalAmountAvailable < cost) return {message: "available balance in paymentAddress is less than total amount for inscription", data: {txid: txid, ids: []}, status: false, key: "available_balance_less_than_total_amount_for_inscription"}
        if(balance.status === undefined) return {message: "waiting for payment on mempool", data:{txid: txid, ids: []}, status: false};
        let collection = await Collection.findOne({id: inscription.collectionId});
        let minted = collection.minted

        if(inscription.fileNames.length == 0){
          exists = false
        }else{
          exists = verifyList(minted, inscription.fileNames)
        }
        
        if(balance.txid[0] !== undefined){
          _txid = balance.txid[0].split(`:`)[0];
          txid = `https://mempool.space/tx/${_txid}`;
        }else{
          return {message: "payment address is empty", data: {txid: txid, ids: []}, status: false}
        }

        if(balance.status[0].confirmed === false){       
            if(exists === false && inscription.fileNames.length !== 0){
              _savedCollection = await Collection.findOneAndUpdate({id: inscription.collectionId}, {$push: {minted: {$each: inscription.fileNames, $position: -1}}},{new: true});
              let address = await Address.findOne({mintStage: collection.mintStage, address: inscription.receiver, collectionId: collection.id})
              address.mintCount = address.mintCount + inscription.fileNames.length
              await address.save()
              await SelectedItems.deleteOne({_id: inscription.selected});

              let addToQueue = await RabbitMqClient.addToQueue({data: {orderId: inscriptionId, networkName: networkName, txid: _txid}, routingKey: "paymentSeen"})
              if(addToQueue.status !== true) return {message: "error adding order to queue", data: {txid: txid, ids: []}, status: false, key:"error_adding_order_to_queue" }
              inscription.collectionPayment = "received";
              inscription.spendTxid = balance.txid[0]
              await inscription.save();
              mintCount = _savedCollection.minted.length;
            }else if(exists === false && inscription.fileNames.length == 0){
              let images = await getImages(inscription.collectionId)
              if(images.open.length == 0){
                return {message: "collection mint complete", data:{txid: txid, ids: []}, status: false, key: "collection_mint_complete"};
              }
              let fileNames = []
              images.open.forEach(x => {
                if(fileNames.length < inscription.mintCount){
                  fileNames.push(x)
                }
              })
              
              _savedCollection = await Collection.findOneAndUpdate({id: inscription.collectionId}, {$push: {minted: {$each: fileNames, $position: -1}}},{new: true});
              let address = await Address.findOne({mintStage: collection.mintStage, address: inscription.receiver, collectionId: collection.id})
              address.mintCount = address.mintCount + inscription.fileNames.length
              await address.save()

              let addToQueue = await RabbitMqClient.addToQueue({data: {orderId: inscriptionId, networkName: networkName, txid: _txid}, routingKey: "paymentSeen"})
              if(addToQueue.status !== true) return {message: "error adding order to queue", data: {txid: txid, ids: []}, status: false, key:"error_adding_order_to_queue" }
              inscription.fileNames = fileNames
              inscription.collectionPayment = "received";
              inscription.spendTxid = balance.txid[0]
              await inscription.save();
              mintCount = _savedCollection.minted.length;
            }

            result = {
              message: `payment seen on mempool`,
              data: {
                  txid: txid,
                  ids: []
              },
              status: true
            };
            
        }else if (balance.status[0].confirmed === true){
          if(exists === false && inscription.fileNames.length !== 0){
            _savedCollection = await Collection.findOneAndUpdate({id: inscription.collectionId}, {$push: {minted: {$each: inscription.fileNames, $position: -1}}},{new: true});
            let address = await Address.findOne({mintStage: collection.mintStage, address: inscription.receiver, collectionId: collection.id})
            address.mintCount = address.mintCount + inscription.fileNames.length
            await address.save()
            await SelectedItems.deleteOne({_id: inscription.selected});

            let addToQueue = await RabbitMqClient.addToQueue({data: {orderId: inscriptionId, networkName: networkName, txid: _txid}, routingKey: "paymentSeen"})
            if(addToQueue.status !== true) return {message: "error adding order to queue", data: {txid: txid, ids: []}, status: false, key:"error_adding_order_to_queue" }
            inscription.collectionPayment = "received";
            inscription.spendTxid = balance.txid[0]
            await inscription.save();
            mintCount = _savedCollection.minted.length;
          }else if(exists === false && inscription.fileNames.length == 0){
            let images = await getImages(inscription.collectionId)
            if(images.open.length == 0){
              return {message: "collection mint complete", data:{txid: txid, ids: []}, status: false, key: "collection_mint_complete"};
            }
            let fileNames = []
            images.open.forEach(x => {
              if(fileNames.length < inscription.mintCount){
                fileNames.push(x)
              }
            })
            
            _savedCollection = await Collection.findOneAndUpdate({id: inscription.collectionId}, {$push: {minted: {$each: fileNames, $position: -1}}},{new: true});
            let address = await Address.findOne({mintStage: collection.mintStage, address: inscription.receiver, collectionId: collection.id})
            address.mintCount = address.mintCount + inscription.fileNames.length
            await address.save()

            let addToQueue = await RabbitMqClient.addToQueue({data: {orderId: inscriptionId, networkName: networkName, txid: _txid}, routingKey: "paymentSeen"})
            if(addToQueue.status !== true) return {message: "error adding order to queue", data: {txid: txid, ids: []}, status: false, key:"error_adding_order_to_queue" }
            inscription.fileNames = fileNames
            inscription.collectionPayment = "received";
            inscription.spendTxid = balance.txid[0]
            await inscription.save();
            mintCount = _savedCollection.minted.length;
          }
          
          if(inscription.error == true){
            let addToQueue = await RabbitMqClient.addToQueue({data: {orderId: inscriptionId, networkName: networkName, txid: _txid}, routingKey: "paymentSeen"})
            if(addToQueue.status !== true) return {message: "error adding order to queue", data:{txid: txid, ids: []}, status: false, key: "error_adding_order_to_queue"}
            result = {
              message: `added to queue`,
              data:{
                  txid: txid,
                  ids: []
              },
              status: true
            };
          }
        }

        if(collection.collectionDetails.totalSupply === mintCount) {
          await Collection.findOneAndUpdate({id: inscription.collectionId}, {ended: true}, {new: true})
          return {message: "collection mint complete", data:{txid: txid, ids: []}, status: false, key: "collection_mint_complete"};
        }
        return result
    }catch(e){
        console.log(e.message);
    }
}

const checkDefaultPayment = async ({inscriptionId, networkName}) => {
    try{
        const type = getType(inscriptionId);
        let inscription;
        let balance;
        let cost = 0;
        let txid = "";
        let _txid;
    
        if (type === `single`) {
            inscription = await Inscription.findOne({ id: inscriptionId });
            if(!inscription) return {message: "inscription not found", data: {txid: "", ids: []}, status: false, key: "inscription_not_found"};
            balance = await getWalletBalance(
              inscription.inscriptionDetails.payAddress,
              networkName
            );
            cost = inscription.cost.total;
        } else if (type === `bulk`) {
            inscription = await BulkInscription.findOne({ id: inscriptionId });
            if(!inscription) return {message: "inscription not found", data: {txid: "", ids: []}, status: false, key: "inscription_not_found"};
            balance = await getWalletBalance(
              inscription.inscriptionDetails.payAddress,
              networkName
            );
            cost = inscription.cost.total;
        }else{
          return {
            message: "invalid Id",
            data: {
              ids: [],
              txid: ""
            },
            status: false,
            key: "Invalid_id"
          }
        }

        if(inscription.inscribed === true) return {message: "order complete", data: {txid: txid, ids: inscription.inscription}, status: true}
        if(balance.totalAmountAvailable == 0) return {message: "payment address is empty", data: {txid: null, ids: []}, status: false}
        if(balance.totalAmountAvailable < cost) return {message: "available balance in paymentAddress is less than total amount for inscription", data: {txid: null, ids: []}, status: false, key: "available_balance_less_than_total_amount_for_inscription"}
        if(balance.status === undefined) return {message: "waiting for payment on mempool", data:{txid: null, ids: []}, status: false};

        _txid = balance.txid[0].split(`:`)[0];
        txid = `https://mempool.space/tx/${_txid}`

        let messageProperties = {
          headers: {
            'x-retry-count': 0, 
          },
        };

        if (balance.status[0].confirmed === false) {
            if(inscription.collectionPayment === "waiting"){
                let addToQueue = await RabbitMqClient.addToQueue({data: {orderId: inscriptionId, networkName: networkName, txid: _txid}, routingKey: "paymentSeen", option: messageProperties})
                if(addToQueue.status !== true) return {message: "error adding order to queue", data: {txid: txid, ids: []}, status: false, key: "error_adding_order_to_queue"}
                
                inscription.collectionPayment = "received";
                inscription.spendTxid = balance.txid[0];
                await inscription.save();
                return {
                    message: `payment seen on mempool`,
                    data: {
                        txid: txid,
                        ids: []
                    },
                    status: true
                };
            }else if (inscription.collectionPayment === "received"){
              return {
                message: `payment seen on mempool`,
                data:{ 
                    txid: txid,
                    ids: []
                },
                status: true
              };
            }
        }else if(balance.status[0].confirmed === true){ 
          if(inscription.collectionPayment === "waiting"){
            let addToQueue = await RabbitMqClient.addToQueue({data: {orderId: inscriptionId, networkName: networkName, txid: _txid}, routingKey: "paymentSeen", option: messageProperties})
            if(addToQueue.status !== true) return {message: "error adding order to queue", data:{txid: txid, ids: []}, status: false, key: "error_adding_order_to_queue"}
            
            inscription.collectionPayment = "received";
            inscription.spendTxid = balance.txid[0];
            await inscription.save();
            return {
              message: `payment received`,
              data:{
                  txid: txid,
                  ids: []
              },
              status: true
            };
          }else if(inscription.error == true){
            let addToQueue = await RabbitMqClient.addToQueue({data: {orderId: inscriptionId, networkName: networkName, txid: _txid}, routingKey: "paymentSeen", option: messageProperties})
            if(addToQueue.status !== true) return {message: "error adding order to queue", data:{txid: txid, ids: []}, status: false, key: "error_adding_order_to_queue"}
            result = {
              message: `added to queue`,
              data:{
                  txid: txid,
                  ids: []
              },
              status: true
            };
          }else if(inscription.collectionPayment === "received"){
            return {
              message: `payment received`,
              data:{
                  txid: txid,
                  ids: []
              },
              status: true
            };
          }
        }
    }catch(e){
        console.log(e.message);
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

const writeImageFiles = (path, data) => {
  try {
      if(!fs.existsSync(process.cwd()+`/src/imageLinks/`)) {
      fs.mkdirSync(
        process.cwd()+`/src/imageLinks/`,
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

const getLinks = async (cid, totalSupply) => {
  try {
    const client = await import("ipfs-http-client");
    let links = [];
    const url = "https://dweb.link/api/v0";
    const ipfs = client.create({ url });

    if(!fs.existsSync(process.cwd()+`/src/imageLinks/${cid}.json`)) {
      for await (const link of ipfs.ls(cid)) {
        links.push(link);
      }
      //if(links.length === totalSupply) return links
      //let data = links.splice(links.length - totalSupply, totalSupply);
      let filePath = `./src/imageLinks/${cid}.json`
      writeImageFiles(filePath, JSON.stringify(links))
      return links
    }else{
      let data = JSON.parse(fs.readFileSync(process.cwd()+`/src/imageLinks/${cid}.json`))
      return data;
    }
  } catch (e) {
    console.log(e.message);
  }
};

const getImages = async(collectionId) => {
  try{
    let s_items = [];
    let s_minted = [];
    let s_free = [];
    let s_selected = [];
    let selectedImages = [];

    const collection = await Collection.findOne({id: collectionId});
    let minted = collection.minted;
    let selectedItems = await SelectedItems.find({collectionId: collectionId});

    let imageNames = await getLinks(collection.itemCid, collection.collectionDetails.totalSupply);
    if(!imageNames) return []

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
      }else{
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
      if (minted.includes(image.name)) {
          s_minted.push(image.name);
      } else {
        s_free.push(image.name);
      }
    })
    
    return {
      selected: selectedImages,
      minted: s_minted,
      open: s_free
    }
  } catch(e){
    console.log(e);
    return res.status(500).json({status: false, message: e.message})
  }
}



//Exported Method
const inscribe = async ({inscriptionId, networkName}) => {
    try {
      const type = getType(inscriptionId);
      let inscription;
      let scribePoints
      if (type === 'single') {
        inscription = await Inscription.findOne({ id: inscriptionId });
        if(!inscription) return {message: "inscription not found", data: {ids: []}, status: false};
      } else if (type === 'bulk') {
        inscription = BulkInscription.findOne({ id: inscriptionId });
        if(!inscription) return {message: "inscription not found", data: {ids: []}, status: false};
      }else{
        return {
          message: "invalid Id",
          data: {
            ids: [],
          },
          status: false,
        }
      }
      
      let inscResult;
      if (inscription.collectionId) {
        inscResult = await collectionInscribe({ inscriptionId, networkName });
      } else {
        inscResult = await defaultInscribe({ inscriptionId, networkName });
      }

      let inscriptionTask = await Task.findOne({taskName: "inscribe"})
      if(inscResult === true){
        let res = await perform_task(inscription.receiver, inscriptionTask.taskId)
        scribePoints = res.data.totalPoints
      }else{
        scribePoints = 0
      }

      let data = {
        message: inscResult.message,
        data: {
          ids: inscResult.data.ids,
          scribePoints: scribePoints
        },
        status: inscResult.status
      }
      
      return data;
    } catch (e) {
      console.log(e.message);
    }
};

const checkPayment = async ({inscriptionId, networkName}) => {
    try {
        let type = getType(inscriptionId);
        let inscription
        let result 

        if (type === `single`) {
            inscription = await Inscription.findOne({ id: inscriptionId });
            fileCount = 1
            if(!inscription) {
              return {
                message: "order not found",
                data: {
                  ids: [],
                  txid: ""
                },
                status: false,
                key: "order_not_found"
              }
          }else{
            if(inscription.collectionId) {
              result = await checkCollectionPayment({inscriptionId:inscriptionId, networkName:networkName})
            }else{
              result = await checkDefaultPayment({inscriptionId:inscriptionId, networkName:networkName}) 
            }
          }
            
        } else if (type === `bulk`) {
            inscription = await BulkInscription.findOne({ id: inscriptionId });
            fileCount = inscription.fileNames.length
            if(!inscription) {
              return {
                message: "order not found",
                data: {
                  ids: [],
                  txid: ""
                },
                status: false,
                key: "order_not_found"
              }
            }else{
              if(inscription.collectionId) {
                result = await checkCollectionPayment({inscriptionId:inscriptionId, networkName:networkName})
              }else{
                result = await checkDefaultPayment({inscriptionId:inscriptionId, networkName:networkName}) 
              }
            }
        }else{
          return {
            message: "invalid Id",
            data: {
              ids: [],
              txid: ""
            },
            status: false,
            key: "Invalid_id"
          }
        }
        return result;
    } catch (e) {
      console.log(e.message);
    }
};

module.exports = {inscribe, checkPayment}

//checkPayment({inscriptionId: "se28c1b9d-b90f-4f6f-b914-a933cbb1ce89", networkName: "mainnet"}).then(res => console.log(res)).catch()
//getImages().then(res => console.log(res)).catch()
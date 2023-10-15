const axios = require("axios");
const dotenv = require("dotenv").config();
const ObjectId = require('mongoose').Types.ObjectId; 
const RabbitMqClient = require("./queue/rabbitMqClient.js");
const Inscription = require("../model/inscription");
const SelectedItems = require("../model/selectedItems");
const BulkInscription = require("../model/bulkInscription");
const Address = require("../model/address");
const Collection = require("../model/collection");
const {
  getWalletBalance,
  getSpendUtxo
} = require("../helpers/sendBitcoin");
const { getType } = require("./getType");

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
        balance = await getWalletBalance(inscription.inscriptionDetails.payAddress, networkName).totalAmountAvailable;
        imageName = inscription.inscriptionDetails.fileName;
        receiverAddress = inscription.receiver;
        cost = inscription.cost.inscriptionCost;
        
      } else if (type === "bulk") {
        inscription = await BulkInscription.findOne({id: inscriptionId});
        balance = await getWalletBalance(inscription.inscriptionDetails.payAddress, networkName).totalAmountAvailable;  
        receiverAddress = inscription.receiver;
        cost = inscription.cost.cardinal;
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
            spendUtxo: spendUtxo,
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
      if (typeof newInscription.data.userResponse.data === 'string') {
        return {message: `error inscribing item`, status:false, data: {ids: []}}
      }else{
        if(newInscription.data.status === false) return {message: `${newInscription.data.message}`,status: false,  data:{ids: []}}
        n_inscriptions = newInscription.data.userResponse.data;
        if(newInscription.data.userResponse.data.length === 0) return {message: `error inscribing item`,status: false,  data:{ids: []}}
        details = n_inscriptions.map((item) => {
            return {
            inscription: item,
            }; 
        });
        
        inscription.inscription = details;
        inscription.sent = true;
        inscription.inscribed = true;
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
          spendUtxo: spendUtxo,
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
      }

      if (typeof newInscription.data.userResponse.data === 'string') {
        return {message: `error inscribing item`, status:false, data:{ids: []}}
      }else{
        if(newInscription.data.status === false) return {message: `${newInscription.data.message}`, status:false, data:{ids: []}}
        n_inscriptions = newInscription.data.userResponse.data;
        if(newInscription.data.userResponse.data.length === 0) return {message: `error inscribing item`, status:false, data:{ids: []}}
        details = n_inscriptions.map((item) => {
            return {
            inscription: item,
            }; 
        });

        await Address.findOneAndUpdate({mintStage: collection.mintStage, address: inscription.receiver}, {$inc: {mintCount: inscription.fileNames.length}}, {new: true});
        await Collection.findOneAndUpdate({id: inscription.collectionId}, {$push: {inscriptions: {$each: details, $position: -1}}}, {$pull: {selected: {$in: inscription.selected}}}, { new: true }); 
        
        inscription.inscription = details;
        inscription.sent = true;
        inscription.inscribed = true;
        inscription.stage = "stage 3";
        await inscription.save();
        return {
            message: `inscription complete`,
            status:false, 
            data:{ids: details}
        };
      }
    } catch(e) {
        console.log(e.message);
    }
};

const checkCollectionPayment = async ({inscriptionId, networkName}) => {
    try{
        const type = getType(inscriptionId);
        let inscription;
        let balance;
        let cost = 0;
        let txid;
        let _txid;
        let data;
        let mintCount;
    
        if (type === `single`) {
            inscription = await Inscription.findOne({ id: inscriptionId });
            balance = await getWalletBalance(
            inscription.inscriptionDetails.payAddress,
            networkName
            );
            cost = inscription.cost.total;
        } else if (type === `bulk`) {
            inscription = await BulkInscription.findOne({ id: inscriptionId });
            balance = await getWalletBalance(
            inscription.inscriptionDetails.payAddress,
            networkName
            );
            cost = inscription.cost.total;
        }
        
        if(!inscription) data = {message: "inscription not found", data: {txid: null, ids: []}, status: false};
        if(inscription.inscribed === true) data = {message: "order complete", data: {txid: txid, ids: inscription.inscription}, status: true}
        if(balance.totalAmountAvailable == 0) data = {message: "payment address is empty", data: {txid: null, ids: []}, status: false}
        if(balance.totalAmountAvailable < cost) data = {message: " available balance in paymentAddress is less than total amount for inscription", data: {txid: null, ids: []}, status: false}
        if(balance.status === undefined) data = {message: "waiting for payment on mempool", data:{txid: null, ids: []}, status: false};
        let collection = await Collection.findOne({id: inscription.collectionId});
        
        if(balance.status[0].confirmed === false){
            _txid = balance.txid[0].split(`:`)[0];
            txid = `https://mempool.space/tx/${_txid}`
            if(inscription.collectionPayment === "waiting"){
                let _savedCollection = await Collection.findOneAndUpdate({id: inscription.collectionId}, {$push: {minted: {$each: inscription.fileNames, $position: -1}}},{$pull: {selected: {$in: inscription.selected}}}, {new: true});
                await Address.findOneAndUpdate({mintStage: collection.mintStage, address: inscription.receiver}, { $inc: { mintCount: inscription.fileNames.length} }, {new: true});
                await SelectedItems.deleteOne({_id: inscription.selected});
                
                let addToQueue = await RabbitMqClient.addToQueue({orderId: inscriptionId, networkName: networkName, txid: _txid}, "paymentSeen")
                if(addToQueue !== true) data = {message: "error adding order to queue", data: {txid: txid, ids: []}, status: false}
                
                inscription.collectionPayment = "received";
                await inscription.save();
                mintCount = _savedCollection.minted.length;
                data = {
                    message: `waiting for payment confirmation`,
                    data: {
                        txid: txid,
                        ids: []
                    },
                    status: true
                };
            }else if (inscription.collectionPayment === "received"){
                data = {
                    message: `Waiting for payment confirmation`,
                    data:{ 
                        txid: txid,
                        ids: []
                    },
                    status: true
                };
            }
        }else if (balance.status[0].confirmed === true){
            _txid = balance.txid[0].split(`:`)[0];
            txid = `https://mempool.space/tx/${_txid}`
            if(inscription.collectionPayment === "waiting"){
                let _savedInscription = await Collection.findOneAndUpdate({id: inscription.collectionId}, {$push: {minted: {$each: inscription.fileNames, $position: -1}}},{$pull: {selected: {$in: inscription.selected}}}, {new: true});
                await Address.findOneAndUpdate({mintStage: collection.mintStage, address: inscription.receiver}, { $inc: { mintCount: inscription.fileNames.length } },{$pull: {pendingOrders: new ObjectId(inscription._id)}},{new: true});
                await SelectedItems.deleteOne({_id: inscription.selected});
                
                let addToQueue = await RabbitMqClient.addToQueue({orderId: inscriptionId, networkName: networkName, txid: _txid}, "paymentSeen")
                if(addToQueue !== true) data = {message: "error adding order to queue", data:{txid: txid, ids: []}, status: false}
                
                inscription.collectionPayment = "received";
                await inscription.save();
                mintCount = _savedInscription.mintCount;
                data = {
                    message: `payment received`,
                    data:{
                        txid: txid,
                        ids: []
                    },
                    status: false
                };
            }else if(inscription.collectionPayment === "received"){
                inscription.collectionPayment = "paid";
                inscription.spendTxid = balance.txid[0];
                await inscription.save();
                data = {
                    message: `payment received`,
                    data:{
                        txid: txid,
                        ids: []
                    },
                    status: false
                };
            }
        }

        if(collection.collectionDetails.totalSupply === mintCount){
            await Collection.findOneAndUpdate({id: inscription.collectionId}, {ended: true}, {new: true});
            return data;
        }else{
            return data;
        }
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
        let txid;
        let _txid;
    
        if (type === `single`) {
            inscription = await Inscription.findOne({ id: inscriptionId });
            balance = await getWalletBalance(
            inscription.inscriptionDetails.payAddress,
            networkName
            );
            cost = inscription.cost.total;
        } else if (type === `bulk`) {
            inscription = await BulkInscription.findOne({ id: inscriptionId });
            balance = await getWalletBalance(
            inscription.inscriptionDetails.payAddress,
            networkName
            );
            cost = inscription.cost.total;
        }

        if(!inscription) return {message: "inscription not found", data: {txid: null, ids: []}, status: false};
        if(inscription.inscribed === true) return {message: "order complete", data: {txid: null, ids: inscription.inscription}, status: true}
        if(balance.totalAmountAvailable == 0) return {message: "payment address is empty", data: {txid: null, ids: []}, status: false}
        if(balance.totalAmountAvailable < cost) return {message: " available balance in paymentAddress is less than total amount for inscription", data: {txid: null, ids: []}, status: false}

        if (balance.status === undefined) return { message: `waiting for payment on mempool`, data:{ txid: null, ids: []}, status: false};
        if (balance.status[0].confirmed === false) {
            _txid = balance.txid[0].split(`:`)[0];
            txid = `https://mempool.space/tx/${_txid}`
            if(inscription.collectionPayment === "waiting"){
                let addToQueue = await RabbitMqClient.addToQueue({orderId: inscriptionId, networkName: networkName, txid: _txid}, "paymentSeen")
                if(addToQueue !== true) return {message: "error adding order to queue", data: {txid: txid, ids: []}, status: false}
                
                inscription.collectionPayment = "received";
                await inscription.save();
                return {
                    message: `waiting for payment confirmation`,
                    data: {
                        txid: txid,
                        ids: []
                    },
                    status: true
                };
            }else if (inscription.collectionPayment === "received"){
                return {
                    message: `Waiting for payment confirmation`,
                    data:{ 
                        txid: txid,
                        ids: []
                    },
                    status: true
                };
            }
        }else if(balance.status[0].confirmed === true){
            _txid = balance.txid[0].split(`:`)[0];
            txid = `https://mempool.space/tx/${_txid}`
            
            if(inscription.collectionPayment === "waiting"){
                let addToQueue = await RabbitMqClient.addToQueue({orderId: inscriptionId, networkName: networkName, txid: _txid}, "paymentSeen")
                if(addToQueue !== true) return {message: "error adding order to queue", data:{txid: txid, ids: []}, status: false}
                
                inscription.collectionPayment = "received";
                await inscription.save();
                return {
                    message: `payment received`,
                    data:{
                        txid: txid,
                        ids: []
                    },
                    status: false
                };
            }else if(inscription.collectionPayment === "received"){
                inscription.collectionPayment = "paid";
                inscription.spendTxid = balance.txid[0];
                await inscription.save();
                return {
                    message: `payment received`,
                    data:{
                        txid: txid,
                        ids: []
                    },
                    status: false
                };
            }
        }
    }catch(e){
        console.log(e.message);
    }
}



//Exported Method
const inscribe = async ({ inscriptionId, networkName }) => {
    try {
      const type = getType(inscriptionId);
      let inscription;
      if (type === 'single') {
        inscription = await Inscription.findOne({ id: inscriptionId });
      } else if (type === 'bulk') {
        inscription = await BulkInscription.findOne({ id: inscriptionId });
      }
  
      let inscResult;
      if (inscription.collectionId) {
        inscResult = await collectionInscribe({ inscriptionId, networkName });
      } else {
        inscResult = await defaultInscribe({ inscriptionId, networkName });
      }
  
      return inscResult;
    } catch (e) {
      console.log(e.message);
    }
};

const checkPayment = async ({ inscriptionId, networkName }) => {
    try {
        const type = getType(inscriptionId);
        let inscription
        let result 

        if (type === `single`) {
            inscription = await Inscription.findOne({ id: inscriptionId });
            if(inscription.collectionId) {
                result = await checkCollectionPayment({inscriptionId:inscriptionId, networkName:networkName})
            }else{
                result = await checkDefaultPayment({inscriptionId:inscriptionId, networkName:networkName})
            }
        } else if (type === `bulk`) {
            inscription = await BulkInscription.findOne({ id: inscriptionId });
            if(inscription.collectionId) {
                result = await checkCollectionPayment({inscriptionId:inscriptionId, networkName:networkName})
            }else{
                result = await checkDefaultPayment({inscriptionId:inscriptionId, networkName:networkName})
            }
        }
        return result;
    } catch (e) {
      console.log(e.message);
    }
};

module.exports = {inscribe, checkPayment}

//checkPayment({inscriptionId: "se28c1b9d-b90f-4f6f-b914-a933cbb1ce89", networkName: "mainnet"}).then(res => console.log(res)).catch()
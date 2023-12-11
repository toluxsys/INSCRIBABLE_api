/* eslint-disable no-else-return */
/* eslint-disable object-shorthand */
/* eslint-disable prettier/prettier */
const axios = require('axios');
const dotenv = require('dotenv').config();
const fs = require('fs');
const moment = require('moment');
const RabbitMqClient = require('./queue/rabbitMqClient.js');
const Inscription = require('../model/inscription');
const SelectedItems = require('../model/selectedItems');
const BulkInscription = require('../model/bulkInscription');
const Address = require('../model/address');
const Collection = require('../model/collection');
const Task = require('../model/task');
const {createTransaction, getAddressType, getAddressHistory} = require('./walletHelper.js')
const { getWalletBalance, getSpendUtxo } = require('./sendBitcoin');
const { getType } = require('./getType');
const { perform_task } = require('./rewardHelper.js');
const {subSatCount} = require('./satHelper.js');
const mintDetails = require('../model/mintDetails.js');

const interval = 15;

const verifyList = (arr1, arr2) => {
  const set = new Set(arr1);
  // eslint-disable-next-line no-unreachable-loop
  for (const value of arr2) {
    if (set.has(value)) {
      return true;
    }else{
      return false
    }
  }
};

const defaultInscribe = async ({ inscriptionId, networkName }) => {
  try {
    const type = getType(inscriptionId);
    let inscription;
    let newInscription;
    let imageName;
    let details = [];
    let balance = 0;
    let cost = 0;
    let ORD_API_URL;
    let receiverAddress;
    let changeAddress;

    if (networkName === 'mainnet') {
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
      if (!changeAddress)
        changeAddress = process.env.MAINNET_SERVICE_CHARGE_ADDRESS;
    }

    if (networkName === 'testnet') {
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;
      if (!changeAddress)
        changeAddress = process.env.TESTNET_SERVICE_CHARGE_ADDRESS;
    }

    if (type === 'single') {
      inscription = await Inscription.findOne({ id: inscriptionId });
      if (!inscription)
        return {
          message: 'inscription not found',
          data: { ids: [] },
          status: false,
          key: 'inscription_not_found',
        };
      balance = await getWalletBalance(
        inscription.inscriptionDetails.payAddress,
        networkName,
      ).totalAmountAvailable;
      imageName = inscription.inscriptionDetails.fileName;
      receiverAddress = inscription.receiver;
      cost = inscription.cost.inscriptionCost;
    } else if (type === 'bulk') {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
      if (!inscription)
        return {
          message: 'inscription not found',
          data: { ids: [] },
          status: false,
          key: 'inscription_not_found',
        };
      balance = await getWalletBalance(
        inscription.inscriptionDetails.payAddress,
        networkName,
      ).totalAmountAvailable;
      receiverAddress = inscription.receiver;
      cost = inscription.cost.cardinal;
    } else {
      return {
        message: 'invalid Id',
        data: {
          ids: [],
          txid: '',
        },
        status: false,
        key: 'Invalid_id',
      };
    }

    if (balance < cost) {
      return {
        message:
          'available balance in payment address is too low for transaction',
        status: false,
        data: { ids: [] },
      };
    }

    if (inscription.sat && inscription.sat !== 'random') {
      const spendUtxo = (
        await getSpendUtxo(
          inscription.inscriptionDetails.payAddress,
          networkName,
        )
      ).output;
      if (spendUtxo === '')
        return {
          message: 'no available spend utxo in address',
          status: false,
          data: { ids: [] },
        };
      if (inscription.s3 === true) {
        newInscription = await axios.post(
          `${process.env.ORD_SAT_API_URL}/ord/inscribe/oldSats`,
          {
            feeRate: inscription.feeRate,
            receiverAddress,
            type: inscription.sat,
            imageName,
            networkName: 'mainnet',
            spendUtxo: spendUtxo.output,
            changeAddress,
            walletName: 'oldSatsWallet',
            storageType: 'AWS',
          },
        );
      } else {
        newInscription = await axios.post(
          `${process.env.ORD_SAT_API_URL}/ord/inscribe/oldSats`,
          {
            feeRate: inscription.feeRate,
            receiverAddress,
            cid: inscription.inscriptionDetails.cid,
            inscriptionId,
            type: inscription.sat,
            imageName,
            networkName: 'mainnet',
            spendUtxo,
            changeAddress,
            walletName: 'oldSatsWallet',
            storageType: 'IPFS',
          },
        );
      }
    } else if (inscription.s3 === true) {
      newInscription = await axios.post(
        `${ORD_API_URL}/ord/inscribe/changeS3`,
        {
          feeRate: inscription.feeRate,
          receiverAddress,
          cid: inscription.inscriptionDetails.cid,
          inscriptionId,
          type,
          imageName,
          networkName,
          changeAddress,
          imageNames: inscription.fileNames,
        },
      );
    } else {
      newInscription = await axios.post(`${ORD_API_URL}/ord/inscribe/change`, {
        feeRate: inscription.feeRate,
        receiverAddress,
        cid: inscription.inscriptionDetails.cid,
        inscriptionId,
        type,
        imageName,
        networkName,
        changeAddress,
      });
    }

    if (newInscription.data.status === false) {
      return {
        message: newInscription.data.message,
        status: false,
        data: { ids: [] },
      };
    }
    if (typeof newInscription.data.userResponse.data === 'string') {
      return {
        message: `error inscribing item`,
        status: false,
        data: { ids: [] },
      };
    }

    const n_inscriptions = newInscription.data.userResponse.data;
    if (newInscription.data.userResponse.data.length === 0)
      return {
        message: `error inscribing item`,
        status: false,
        data: { ids: [] },
      };
    if (inscription.sat !== 'random') {
      details = n_inscriptions.map((item) => ({
        inscription: item,
      }));
    } else {
      const ids = [];
      for (let i = 0; i < n_inscriptions.length; i++) {
        const insc_arr = n_inscriptions[i];
        insc_arr.forEach((x) => ids.push(x));
      }

      details = ids.map((item) => ({
        inscription: item,
      }));
    }
    inscription.inscription = details;
    inscription.sent = true;
    inscription.inscribed = true;
    inscription.error = false;
    inscription.errorMessage = '';
    inscription.stage = 'stage 3';
    await inscription.save();
    return {
      message: `inscription complete`,
      status: true,
      data: { ids: details },
    };
  } catch (e) {
    console.log(e.message);
  }
};

const collectionInscribe = async ({ inscriptionId, networkName }) => {
  try {
    const type = getType(inscriptionId);
    let inscription;
    let newInscription;
    let imageNames;
    let details = [];
    let ORD_API_URL;
    let receiveAddress;
    let balance = 0;
    let cost = 0;

    if (networkName === 'mainnet')
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === 'testnet')
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    if (type === 'single') {
      inscription = await Inscription.findOne({ id: inscriptionId });
      balance = await getWalletBalance(
        inscription.inscriptionDetails.payAddress,
        networkName,
      ).totalAmountAvailable;
      imageNames = inscription.fileNames;
      receiveAddress = inscription.receiver;
      cost = inscription.cost.inscriptionCost;
    } else if (type === 'bulk') {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
      balance = await getWalletBalance(
        inscription.inscriptionDetails.payAddress,
        networkName,
      ).totalAmountAvailable;
      imageNames = inscription.fileNames;
      receiveAddress = inscription.receiver;
      cost = inscription.cost.cardinal;
    } else {
      return {
        message: 'invalid Id',
        data: {
          ids: [],
          txid: '',
        },
        status: false,
        key: 'Invalid_id',
      };
    }

    if(inscription.inscribed === true){
      return {
        message: 'item inscribed',
        data: {
          ids: [inscription.inscription[0]],
          txid: '',
        },
        status: true,
      };
    }

    const collection = await Collection.findOne({
      id: inscription.collectionId,
    });
    if(!collection) return ({status: false, message: 'collection does not exist', data: { ids: [] }})
    //if(collection.ended === true) return ({status: false, message: 'collection mint ended', data: { ids: [] }})
    const changeAddress = collection.collectionAddress;

    if (balance < cost) {
      return {
        message:
          'available balance in payment address is too low for transaction',
        status: false,
        data: { ids: [] },
      };
    }

    if (inscription.sat !== 'random') {
      const spendUtxo = await getSpendUtxo(
        inscription.inscriptionDetails.payAddress,
        networkName,
      );
      newInscription = await axios.post(
        `${process.env.ORD_SAT_API_URL}/ord/inscribe/oldSats`,
        {
          feeRate: inscription.feeRate,
          receiverAddress: receiveAddress,
          collectionId: inscription.collectionId,
          cid: collection.itemCid,
          imageNames,
          type: inscription.sat,
          networkName: 'mainnet',
          spendUtxo: spendUtxo.output,
          changeAddress,
          inscriptionId,
          walletName: 'oldSatsWallet',
          storageType: 'IPFS',
          paymentAddress: inscription.inscriptionDetails.payAddress,
        },
      );
    } else {
      newInscription = await axios.post(`${ORD_API_URL}/ord/inscribe/change`, {
        feeRate: inscription.feeRate,
        receiverAddress: receiveAddress,
        cid: collection.itemCid,
        inscriptionId,
        networkName,
        collectionId: inscription.collectionId,
        imageNames,
        changeAddress,
      });
      console.log(newInscription);
    }

    if (newInscription.data.status === false) {
      return {
        message: newInscription.data.message,
        status: false,
        data: { ids: [] },
      };
    }

    if (typeof newInscription.data.userResponse.data === 'string') {
      return {
        message: newInscription.data.userResponse.data,
        status: false,
        data: { ids: [] },
      };
    }

    const n_inscriptions = newInscription.data.userResponse.data;
    if (newInscription.data.userResponse.data.length === 0)
      return {
        message: `error inscribing item`,
        status: false,
        data: { ids: [] },
      };
    if (inscription.sat !== 'random') {
      details = n_inscriptions.map((item) => ({
        inscription: item,
      }));
    } else {
      const ids = [];
      for (let i = 0; i < n_inscriptions.length; i++) {
        const insc_arr = n_inscriptions[i];
        insc_arr.forEach((x) => ids.push(x));
      }

      details = ids.map((item) => ({
        inscription: item,
      }));
    }

    if(collection.keys !== null || collection.keys !== undefined){
      await addToCreatorsQueue({inscriptionId:inscriptionId, networkName:networkName})
    }

    inscription.error = false;
    inscription.errorMessage = '';
    inscription.inscription = details;
    inscription.sent = true;
    inscription.inscribed = true;
    inscription.stage = 'stage 3';
    await inscription.save();

    await Address.findOneAndUpdate(
      { mintStage: collection.mintStage, address: inscription.receiver },
      { $inc: { mintCount: inscription.fileNames.length } },
      { new: true },
    );
    await Collection.findOneAndUpdate(
      { id: inscription.collectionId },
      { $push: { inscriptions: { $each: details, $position: -1 } } },
      { $pull: { selected: { $in: inscription.selected } } },
      { new: true },
    );
   
    return {
      message: `inscription complete`,
      status: true,
      data: { ids: details },
    };

  } catch (e) {
    console.log(e.message);
  }
};

const addToCreatorsQueue = async ({inscriptionId, networkName}) => {
  try{
    const inscription = await Inscription.findOne({id: inscriptionId})
    const collection = await Collection.findOne({id: inscription.collectionId})
    const mintStageDetails = await mintDetails.findOne({_id: inscription.mintStage})
    let result;
    if(collection.keys !== null){
      if(mintStageDetails.price !== 0){
        const utxo = await getAddressHistory(collection.collectionAddress, inscription.inscriptionDetails.payAddress, networkName)
        let addToQueue;
        if(utxo.length === 0) {
          addToQueue = await RabbitMqClient.addToQueue({data: {orderId:inscriptionId, networkName: networkName, txid: ''}, routingKey: 'creatorsPayment'})
        }else{
          addToQueue = await RabbitMqClient.addToQueue({data: {orderId:inscriptionId, networkName: networkName, txid: utxo[0].txid}, routingKey: 'creatorsPayment'})
        }
        if (addToQueue.status !== true) return { message: 'error adding order to queue', status: false};
        result = {
          message: 'added to queue',
          status: true,
        };
        //add to creators queue
      }else{
        result = {
          message: 'price is 0',
          status: true,
        };
      }
    }else{
      result = {
        message: 'no collection keys',
        status: true,
      };
    }
    return result
  }catch(e){
    console.log(e.message)
  }
}
const sendCreatorsPayment = async ({inscriptionId, networkName}) => {
  try{
    const inscription = await Inscription.findOne({id: inscriptionId})
    const collection = await Collection.findOne({id: inscription.collectionId})
    const mintStageDetails = await mintDetails.findOne({_id: inscription.mintStage})
    
    const tx = await createTransaction({
      collAddr: collection.collectionAddress, 
      payAddr: inscription.inscriptionDetails.payAddress,
      creatorAddress: collection.collectionDetails.creatorsAddress,
      networkName: networkName,
      feeRate: inscription.feeRate,
      amount: mintStageDetails.price,
      privateKey: collection.keys.privateKey
    })
    let result;
    if(tx.txHex !== ''){
      const txid = await axios.post(`${process.env.ORD_SAT_API_URL}/ord/broadcastTransaction`, {txHex: tx.txHex, networkName: networkName})
      result = {
        message: 'payment sent to creator',
        status: true,
        data: {txid: txid}
      }
    }else{
      result = {
        message: 'payment not sent to creator',
        status: false,
        data: {txid: ''}
      }
    }
    return result;
  }catch(e){
    console.log(e.message)
  }
}

const checkCollectionPayment = async ({ inscriptionId, networkName }) => {
  try {
    const type = getType(inscriptionId);
    let inscription;
    let balance;
    let cost = 0;
    let txid = '';
    let _txid;

    if (type === `single`) {
      inscription = await Inscription.findOne({ id: inscriptionId });
      if (!inscription)
        return {
          message: 'inscription not found',
          data: { txid, ids: [] },
          status: false,
          key: 'inscription_not_found',
        };
      balance = await getWalletBalance(
        inscription.inscriptionDetails.payAddress,
        networkName,
      );
      cost = inscription.cost.total;
    } else if (type === `bulk`) {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
      if (!inscription)
        return {
          message: 'inscription not found',
          data: { txid, ids: [] },
          status: false,
          key: 'inscription_not_found',
        };
      balance = await getWalletBalance(
        inscription.inscriptionDetails.payAddress,
        networkName,
      );
      cost = inscription.cost.total;
    } else {
      return {
        message: 'invalid Id',
        data: {
          ids: [],
          txid: '',
        },
        status: false,
        key: 'Invalid_id',
      };
    }

    if (inscription.inscribed === true)
      return {
        message: 'order complete',
        data: { txid, ids: inscription.inscription },
        status: true,
      };
    if (balance.totalAmountAvailable === 0)
      return {
        message: 'payment address is empty',
        data: { txid, ids: [] },
        status: false,
      };
    if (balance.totalAmountAvailable < cost)
      return {
        message:
          'available balance in paymentAddress is less than total amount for inscription',
        data: { txid, ids: [] },
        status: false,
        key: 'available_balance_less_than_total_amount_for_inscription',
      };
    if (balance.status === undefined)
      return {
        message: 'waiting for payment on mempool',
        data: { txid, ids: [] },
        status: false,
      };
    const collection = await Collection.findOne({
      id: inscription.collectionId,
    });
    const { minted } = collection;

    if (balance.txid[0] !== undefined) {
      _txid = balance.txid[0].split(`:`)[0];
      txid = `https://mempool.space/tx/${_txid}`;
    } else {
      return {
        message: 'payment address is empty',
        data: { txid, ids: [] },
        status: false,
      };
    }
    if(inscription.error === true){
      const addToQueue = await RabbitMqClient.addToQueue({
        data: {
          orderId: inscriptionId,
          networkName,
          txid: _txid,
        },
        routingKey: 'paymentSeen',
      });
      return {
        message: 'order added to queue',
        data: { txid, ids: [] },
        status: true,
        _txId: _txid,
      };
    }
    if (balance.status!== undefined && collection.template === 1) {
      const exists = verifyList(minted, inscription.fileNames);
      if(exists === true && inscription.collectionPayment === 'received'){
        const addToQueue = await RabbitMqClient.addToQueue({
          data: {
            orderId: inscriptionId,
            networkName,
            txid: _txid,
          },
          routingKey: 'paymentSeen',
        });
        return {
          message: 'order added to queue',
          data: { txid, ids: [] },
          status: true,
          _txId: _txid,
        };
      }
      return await checkSelectItem({inscriptionId: inscriptionId, networkName: networkName, txid: _txid, balance})
    }else if(balance.status !== undefined && collection.template === 2){
      if(inscription.fileNames.length === 0){
        return await checkMintItem({inscriptionId: inscriptionId, networkName: networkName, txid: _txid, balance})
      }else{
        const addToQueue = await RabbitMqClient.addToQueue({
          data: {
            orderId: inscriptionId,
            networkName,
            txid: _txid,
          },
          routingKey: 'paymentSeen',
        });
        return {
          message: 'order added to queue',
          data: { txid, ids: [] },
          status: true,
          _txId: _txid,
        };
      }
    }
  } catch (e) {
    console.log(e);
  }
};

const checkSelectItem = async ({inscriptionId, networkName, txid, balance}) => {
  try{
    const inscription = await Inscription.findOne({id: inscriptionId})
    const collection = await Collection.findOne({id: inscription.collectionId})
    if(inscription.selectionValid === false) 
      return {
        message: 'time elapsed for selected item',
        data: { txid, ids: [] },
        status: false,
        _txId:`https://mempool.space/tx/${txid}`,
        key: 'time_elapsed_for_selected_item',}
    if (inscription.mintStage.toString() === collection.mintStage.toString()) {
      const _savedCollection = await Collection.findOneAndUpdate(
        { id: inscription.collectionId },
        {
          $push: {
            minted: { $each: inscription.fileNames, $position: -1 },
          },
        },
        { new: true },
      );
      const address = await Address.findOne({
        mintStage: collection.mintStage,
        address: inscription.receiver,
        collectionId: collection.id,
      });
      address.mintCount += inscription.fileNames.length;
      await address.save();
      await SelectedItems.deleteOne({ _id: inscription.selected });

      const addToQueue = await RabbitMqClient.addToQueue({
        data: {
          orderId: inscriptionId,
          networkName,
          txid: `${txid}:0`,
        },
        routingKey: 'paymentSeen',
      });
      inscription.collectionPayment = 'received';
      inscription.spendTxid = balance.txid[0];
      await inscription.save();
      await subSatCount(inscription.sat, 1)
      const mintCount = _savedCollection.minted.length;

      if (collection.collectionDetails.totalSupply === mintCount) {
        await Collection.findOneAndUpdate(
          { id: inscription.collectionId },
          { ended: true , startMint: false},
          { new: true },
        );
        return {
          message: 'collection mint complete',
          data: { txid, ids: [] },
          _txId: `https://mempool.space/tx/${txid}`,
          status: false,
          key: 'collection_mint_complete',
        };
      }

      return {
        message: 'payment seen on mempool',
        data: { txid, ids: []},
        status: true,
        _txId: `https://mempool.space/tx/${txid}`,
      };
    } else {
      return {
        message: 'order stage ended',
        data: { txid, ids: [] },
        status: false,
        _txId:`https://mempool.space/tx/${txid}`,
        key: 'order_stage_ended',
      };
    }
  }catch(e){
    console.log(e)
  }
}

const checkMintItem = async ({inscriptionId, networkName, txid, balance}) => {
  try{
    const inscription = await Inscription.findOne({id: inscriptionId})
    const collection = await Collection.findOne({id: inscription.collectionId})
    const images = await getImages(inscription.collectionId);
        if (images.open.length === 0) {
          return {
            message: 'collection mint complete',
            data: { txid, ids: [] },
            status: false,
            _txId: `https://mempool.space/tx/${txid}`,
            key: 'collection_mint_complete',
          };
        }

        //returns a random image form the unminted array
        const fileNames = getRandomElements(images.open, 1);
        if (fileNames.length === 0) return ({status: false, message:'mint ended', key: 'mint_ended', data: {txid: txid, ids: []}});

        const _savedCollection = await Collection.findOneAndUpdate(
          { id: inscription.collectionId },
          { $push: { minted: { $each: fileNames, $position: -1 } } },
          { new: true },
        );
        const address = await Address.findOne({
          mintStage: collection.mintStage,
          address: inscription.receiver,
          collectionId: collection.id,
        });
        address.mintCount += fileNames.length;
        await address.save();

        const addToQueue = await RabbitMqClient.addToQueue({
          data: {
            orderId: inscriptionId,
            networkName,
            txid: `${txid}:0`,
          },
          routingKey: 'paymentSeen',
        });
        inscription.fileNames = fileNames;
        inscription.collectionPayment = 'received';
        inscription.spendTxid = balance.txid[0];
        await inscription.save();
        await subSatCount(inscription.sat, 1)
        const mintCount = _savedCollection.minted.length;
        if (collection.collectionDetails.totalSupply === mintCount) {
          await Collection.findOneAndUpdate(
            { id: inscription.collectionId },
            { ended: true , startMint: false},
            { new: true },
          );
          return {
            message: 'collection mint complete',
            data: { txid, ids: [] },
            _txId: `https://mempool.space/tx/${txid}`,
            status: false,
            key: 'collection_mint_complete',
          };
        }
        return {
          message: 'payment seen on mempool',
          data: { txid, ids: []},
          status: true,
          _txId: `https://mempool.space/tx/${txid}`,
        };
  }catch(e){
    console.log(e)
  }
}

const checkDefaultPayment = async ({ inscriptionId, networkName }) => {
  try {
    const type = getType(inscriptionId);
    let inscription;
    let balance;
    let cost = 0;
    let txid = '';

    if (type === `single`) {
      inscription = await Inscription.findOne({ id: inscriptionId });
      if (!inscription)
        return {
          message: 'inscription not found',
          data: { txid: '', ids: [] },
          status: false,
          key: 'inscription_not_found',
        };
      balance = await getWalletBalance(
        inscription.inscriptionDetails.payAddress,
        networkName,
      );
      cost = inscription.cost.total;
    } else if (type === `bulk`) {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
      if (!inscription)
        return {
          message: 'inscription not found',
          data: { txid: '', ids: [] },
          status: false,
          key: 'inscription_not_found',
        };
      balance = await getWalletBalance(
        inscription.inscriptionDetails.payAddress,
        networkName,
      );
      cost = inscription.cost.total;
    } else {
      return {
        message: 'invalid Id',
        data: {
          ids: [],
          txid: '',
        },
        status: false,
        key: 'Invalid_id',
      };
    }

    if (inscription.inscribed === true)
      return {
        message: 'order complete',
        data: { txid, ids: inscription.inscription },
        status: true,
      };
    if (balance.totalAmountAvailable === 0)
      return {
        message: 'payment address is empty',
        data: { txid: null, ids: [] },
        status: false,
      };
    if (balance.totalAmountAvailable < cost)
      return {
        message:
          'available balance in paymentAddress is less than total amount for inscription',
        data: { txid: null, ids: [] },
        status: false,
        key: 'available_balance_less_than_total_amount_for_inscription',
      };
    if (balance.status === undefined)
      return {
        message: 'waiting for payment on mempool',
        data: { txid: null, ids: [] },
        status: false,
      };

    const _txid = balance.txid[0].split(`:`)[0];
    txid = `https://mempool.space/tx/${_txid}`;

    const messageProperties = {
      headers: {
        'x-retry-count': 0,
      },
    };

    if (balance.status[0].confirmed === false) {
      if (inscription.error === true) {
        const addToQueue = await RabbitMqClient.addToQueue({
          data: {
            orderId: inscriptionId,
            networkName,
            txid: _txid,
          },
          routingKey: 'paymentSeen',
          option: messageProperties,
        });
        inscription.error = false;
        await inscription.save();
        return {
          message: `added to queue`,
          data: {
            txid,
            ids: [],
          },
          _txId: _txid,
          status: true,
        };
      }
      if (inscription.collectionPayment === 'waiting') {
        const addToQueue = await RabbitMqClient.addToQueue({
          data: {
            orderId: inscriptionId,
            networkName,
            txid: _txid,
          },
          routingKey: 'paymentSeen',
          option: messageProperties,
        });
        console.log(addToQueue)
        if (addToQueue.status !== true)
          return {
            message: 'error adding order to queue',
            data: { txid, ids: [] },
            status: false,
            key: 'error_adding_order_to_queue',
          };

        inscription.collectionPayment = 'received';
        inscription.spendTxid = balance.txid[0];
        await inscription.save();
        await subSatCount(inscription.sat, 1)
        return {
          message: `payment seen on mempool`,
          data: {
            txid,
            ids: [],
          },
          status: true,
        };
      }
      if (inscription.collectionPayment === 'received') {
        return {
          message: `payment seen on mempool`,
          data: {
            txid,
            ids: [],
          },
          status: true,
        };
      }
    } else if (balance.status[0].confirmed === true) {
      if (inscription.error === true) {
        const addToQueue = await RabbitMqClient.addToQueue({
          data: {
            orderId: inscriptionId,
            networkName,
            txid: _txid,
          },
          routingKey: 'paymentSeen',
          option: messageProperties,
        });
        if (addToQueue.status !== true)
          return {
            message: 'error adding order to queue',
            data: { txid, ids: [] },
            status: false,
            key: 'error_adding_order_to_queue',
          };
        inscription.error = false;
        await inscription.save();
        return {
          message: `added to queue`,
          data: {
            txid,
            ids: [],
          },
          _txId: _txid,
          status: true,
        };
      } else if (inscription.collectionPayment === 'waiting') {
        const addToQueue = await RabbitMqClient.addToQueue({
          data: {
            orderId: inscriptionId,
            networkName,
            txid: _txid,
          },
          routingKey: 'paymentSeen',
          option: messageProperties,
        });
        if (addToQueue.status !== true)
          return {
            message: 'error adding order to queue',
            data: { txid, ids: [] },
            status: false,
            key: 'error_adding_order_to_queue',
          };

        inscription.collectionPayment = 'received';
        inscription.spendTxid = balance.txid[0];
        await inscription.save();
        await subSatCount(inscription.sat, 1)
        return {
          message: `payment received`,
          data: {
            txid,
            ids: [],
          },
          status: true,
        };
      }
    }
  } catch (e) {
    console.log(e);
  }
};

const getRandomElements = (arr, numberOfElements) => {
  try{// Check if the array is empty or if numberOfElements is not a positive integer
    if (arr.length === 0 || !Number.isInteger(numberOfElements) || numberOfElements <= 0) {
      return [];
    }
    // Make sure numberOfElements is not greater than the array length
    const checkElement = Math.min(numberOfElements, arr.length);
    if(numberOfElements > checkElement) return [];
    // Shuffle the array using the Fisher-Yates algorithm
    const shuffledArray = arr.slice(); // Create a copy to avoid modifying the original array
    for (let i = shuffledArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
    }
    // Return the first numberOfElements elements from the shuffled array
    return shuffledArray.slice(0, numberOfElements);
  }catch(e){
    console.log(e.message)
  }
}

const checkTimeElapsed = (timestamp) => {
  const currentTime = moment();
  const timeDiff = currentTime.diff(timestamp, 'minutes');

  if (timeDiff >= interval) {
    return true;
  }
  return false;
};

const writeImageFiles = (path, data) => {
  try {
    if (!fs.existsSync(`${process.cwd()}/src/imageLinks/`)) {
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

    if (!fs.existsSync(`${process.cwd()}/src/imageLinks/${cid}.json`)) {
      for await (const link of ipfs.ls(cid)) {
        links.push(link);
      }
      const filePath = `./src/imageLinks/${cid}.json`;
      writeImageFiles(filePath, JSON.stringify(links));
      return links;
    }
    const data = JSON.parse(
      fs.readFileSync(`${process.cwd()}/src/imageLinks/${cid}.json`),
    );
    return data;
  } catch (e) {
    console.log(e.message);
  }
};

const getImages = async (collectionId) => {
  try {
    const s_items = [];
    const s_minted = [];
    const s_free = [];
    const s_selected = [];
    const selectedImages = [];

    const collection = await Collection.findOne({ id: collectionId });
    const { minted } = collection;
    const selectedItems = await SelectedItems.find({
      collectionId,
    });

    const imageNames = await getLinks(
      collection.itemCid,
      collection.collectionDetails.totalSupply,
    );
    if (!imageNames) return [];

    selectedItems.forEach((selected) => {
      const { items } = selected;
      const timestamp = selected.createdAt;
      s_items.push({ items, timestamp, id: selected._id });
    });

    s_items.forEach(async (item) => {
      if (checkTimeElapsed(item.timestamp) === true) {
        await SelectedItems.deleteOne({ _id: item.id });
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
      } else {
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
      if (minted.includes(image.name)) {
        s_minted.push(image.name);
      } else {
        s_free.push(image.name);
      }
    });

    return {
      selected: selectedImages,
      minted: s_minted,
      open: s_free,
    };
  } catch (e) {
    console.log(e);
  }
};

// Exported Method
const inscribe = async ({ inscriptionId, networkName }) => {
  try {
    const type = getType(inscriptionId);
    let inscription;
    let scribePoints;
    if (type === 'single') {
      inscription = await Inscription.findOne({ id: inscriptionId });
      if (!inscription)
        return {
          message: 'inscription not found',
          data: { ids: [] },
          status: false,
        };
    } else if (type === 'bulk') {
      inscription = BulkInscription.findOne({ id: inscriptionId });
      if (!inscription)
        return {
          message: 'inscription not found',
          data: { ids: [] },
          status: false,
        };
    } else {
      return {
        message: 'invalid Id',
        data: {
          ids: [],
        },
        status: false,
      };
    }

    if(inscription.inscribed === true){
      return {
        message: 'inscription complete',
        data: {
          ids: [],
        },
        status: true,
      };
    }

    let inscResult;
    if (inscription.collectionId) {
      inscResult = await collectionInscribe({ inscriptionId, networkName });
    } else {
      inscResult = await defaultInscribe({ inscriptionId, networkName });
    }

    console.log('result:', inscResult)

    const inscriptionTask = await Task.findOne({ taskName: 'inscribe' });
    if (inscResult === true) {
      const res = await perform_task(
        inscription.receiver,
        inscriptionTask.taskId,
      );
      scribePoints = res.data.totalPoints;
    } else {
      scribePoints = 0;
    }

    const data = {
      message: inscResult.message,
      data: {
        ids: inscResult.data.ids,
        scribePoints,
      },
      status: inscResult.status,
    };

    return data;
  } catch (e) {
    console.log(e);
  }
};

const checkPayment = async ({ inscriptionId, networkName }) => {
  try {
    const type = getType(inscriptionId);
    let inscription;
    let result;

    if (type === `single`) {
      inscription = await Inscription.findOne({ id: inscriptionId });
      if (!inscription) {
        return {
          message: 'order not found',
          data: {
            ids: [],
            txid: '',
          },
          status: false,
          key: 'order_not_found',
        };
      }
      if (inscription.collectionId) {
        result = await checkCollectionPayment({
          inscriptionId,
          networkName,
        });
      } else {
        result = await checkDefaultPayment({
          inscriptionId,
          networkName,
        });
      }
    } else if (type === `bulk`) {
      inscription = await BulkInscription.findOne({ id: inscriptionId });
      if (!inscription) {
        return {
          message: 'order not found',
          data: {
            ids: [],
            txid: '',
          },
          status: false,
          key: 'order_not_found',
        };
      }
      if (inscription.collectionId) {
        result = await checkCollectionPayment({
          inscriptionId,
          networkName,
        });
      } else {
        result = await checkDefaultPayment({
          inscriptionId,
          networkName,
        });
      }
    } else {
      return {
        message: 'invalid Id',
        data: {
          ids: [],
          txid: '',
        },
        status: false,
        key: 'Invalid_id',
      };
    }
    return result;
  } catch (e) {
    console.log(e);
  }
};

// const duplicateImg = [
//   "100.png",
//   "1000.png",
//   "1001.png",
//   "1002.png",
//   "1003.png",
//   "1004.png",
//   "1005.png",
//   "1007.png",
//   "1008.png",
//   "1009.png",
//   "101.png",
//   "1010.png",
//   "1014.png",
//   "1017.png",
//   "1023.png",
//   "1028.png",
//   "1032.png",
//   "1033.png",
//   "1034.png",
//   "1035.png",
//   "1037.png",
//   "1038.png",
//   "1039.png",
//   "1041.png",
//   "1044.png",
//   "1055.png",
//   "1058.png",
//   "1059.png",
//   "106.png",
//   "1064.png",
//   "1066.png",
//   "107.png",
//   "1070.png",
//   "582.png",
//   "1071.png",
//   "1072.png",
//   "1075.png",
//   "108.png",
//   "1080.png",
//   "1087.png",
//   "1089.png",
//   "1091.png",
//   "1092.png",
//   "1095.png",
//   "1096.png",
//   "1097.png",
//   "1098.png",
//   "1101.png",
//   "1099.png",
//   "1102.png",
//   "1104.png",
//   "1103.png",
//   "1107.png",
//   "1108.png",
//   "111.png",
//   "113.png",
//   "117.png",
//   "122.png",
//   "121.png",
//   "123.png",
//   "128.png",
//   "125.png",
//   "130.png",
//   "132.png",
//   "148.png"
// ]

// const inscribedDuplicate = [
// "s994898ce-808f-4f58-b717-c4f8860cc481",
// "s668a7492-d3c6-48cb-bb2a-71eb146e7fbc",
// "s72ca7541-fecb-49e6-aa31-3b98c7356cc5",
// "sff4c56ba-8df8-459e-bfd2-d8ac776ff2f3",
// "sae7d802c-c835-42b3-a7f5-3f9d51d7e499",
// "safc9cb3f-55e3-4f44-b8bd-dfde805a4f84",
// "s006e2687-2fcf-47dd-96af-7de8e984cae5",
// "s888201bd-eb0b-470e-af5f-5cb2b88dde1e",
// "s3616b16e-2493-47e7-a3b7-8603be56ab33",
// "s71bf9455-4b72-4ee8-a282-3490f5df2ab8",
// "s5f29a9b9-a503-4096-9655-a49d4fc3e837",
// "s4c43e3b8-377b-4342-a10c-c09f96604227",
// "s3e721646-2ba5-457f-8050-01f985ed4929",
// "s63da34fe-878b-4d25-8499-0e4db749af05",
// "s0ecbbbc6-508c-43a0-b5e9-dcb3ac4f3faf",
// "sf9a0f62f-fd73-49ab-8cc1-30425e7c6c85",
// "s9a2607b4-5669-4682-868c-1ba7f3ec9ce5",
// "s90313b5f-a667-4088-9620-f538fd9ba935",
// "sdc3e2591-4427-4fe9-ac55-f6cec7b59b40",
// "sf622a698-586f-4af7-a656-adc22dd3d143",
// "sdded2a77-d560-4563-b57b-d2dde9901ffd",
//  "s88f55a0c-edfd-4916-a27f-47a216feb7f9",
// "s21614e68-234f-41c2-b027-40f44a20ef78",
// "sc8385ccc-324e-4b6f-898e-ba21a3777247",
// "s5a549c74-6918-43a9-a3b5-7462cdcdf6fd",
// "s19685cb5-f331-49b8-8e77-546630f8cc87",
// "s889921ad-1a8b-459c-8835-90d6e46c004a",
// "s33eb256b-a336-417a-82aa-0e871d81f013",
// "s88173977-400c-4983-9016-acf4deb1c94d",
// "se9b56056-8109-4ea4-a23c-c2302408fc32",
// "sa0d94e89-8105-49dd-a7ab-57c494d2ae50",
// "se9a054b0-3323-487d-84f3-07e776fadac0",
// "s1a0d02fb-686e-48f1-b70d-5973c8461dfd",
// "sdba1680a-ac4b-4aac-966e-51c642c2fb06",
// "secb28c3e-6705-46d1-9a75-5fa36ed6f942",
// "s263fbd5b-be2d-429f-be5d-03b38bef9588",
// "s7616c7ad-a066-4788-9f48-a03addef3e2e",
// "s7693c226-946c-4ed3-ab9c-e3de395c97d7",
// "s5e091c35-62b0-4e4e-996c-0dbecba7ff8d",
// "sade15977-55ed-489b-9f51-41158f13c850",
// "s94c830d2-ad1a-4374-8692-c358f47b63b5",
// "s7b829252-251b-4820-ae4c-0cafcf713f9e",
// "sed566c50-df33-4cd9-b89c-4e7438dc2e56",
// "sf4a2467f-a87b-477c-8b23-183c3bad362c",
// "s626da5f3-c18e-4141-a475-b3c0c792edb6",
// "s17c28d0b-f619-4122-b9ce-8c3718e7b0a4",
// "sd6dac0f8-27f7-4f25-aa78-b752939aaf60",
// "s4480fe77-bc3c-4598-9896-324876cdb60d",
// "s96cc9dd5-f6cc-4872-881c-23ee1c3a67f3",
// "s53144dee-ad32-495f-8ea8-664ce6c7c612",
// "s715f3c5f-273e-4136-8fcc-8e888387730c",
// "s3259e417-e059-4265-bbb7-a5f65331561b",
// "sf5e067bd-bc4b-404a-85ec-aac03456bd69",
// "s9b8c0196-3643-4599-a5ff-22467bf13ef5",
// "s2839f209-2988-4bdd-8f30-7f35eacdef75",
// "s49b2e561-09e7-4684-9e80-6fda4a8e9603",
// "s8ff57ff7-66c3-4e50-8dc3-30f931ea727e",
// "sde4e084b-a3b9-4c2a-9dd4-66bdd64a96c4",
// "s7d9a3489-4214-4bdb-b02d-97266b328985",
// "s33814622-a5bb-4a4e-be8a-5c65b570145e",
// "s60667111-1aba-448c-886b-e96ebfc447b4",
// "s76fb76f6-4995-46fe-84ed-601fc9331373",
// "s86f79b15-fa24-4f5e-9028-e52631f4fad3",
// "sba513bdc-5264-4cdb-aa5d-23856ccbebd4",
// "s2b1a2277-ca56-4f8d-a880-1bf90273e666",
// "sdaa01ad2-5f0a-4f64-88bc-db3416ad995f",
// "s40e82ccd-194b-4fda-8cb5-ec35fff560ab",
// "s6811544a-f682-41c7-bdb3-ac223a847ed5",
// "s84441a05-fb8f-474f-8a7d-9840ec73148e",
// "sb23101d7-29c9-4198-ac5a-bf6bc5f5f257",
// "s71edd45a-3f8f-42f1-839c-faddface7646",
// "s874e9f0e-28b8-4a6c-aea4-8ec4b17e3303",
// "s45141d94-318e-4cd7-b4f3-4aedf0d26a81",
// "s376386cd-f08b-4204-8f64-a8803c1c1cb9",
// "sa0dd6bc8-11dc-40bb-9ab3-a205043f351b",
// "sfca25922-2af6-4ad9-9fa9-7cabf3d2e0a5",
// "s4b74700b-e245-4eb1-94b0-777aea587beb",
// "sb7380093-b475-4493-870c-5b66e22119a2",
// "s80684e12-ddf3-45e9-8060-c6253a8807c0",
// "s46a85389-81a8-4a6c-ad77-3c9d1dd3f3c9",
// "s6f1843bb-4693-4931-b5d9-22ca0523df21",
// ]

// const inscribedDuplicateImages = [
//   '100.png',  '1002.png', '1001.png', '1000.png', '100.png',
//   '1000.png', '1005.png', '1004.png', '1003.png', '1003.png',
//   '1002.png', '1005.png', '1008.png', '1010.png', '1010.png',
//   '101.png',  '1010.png', '1014.png', '1017.png', '1010.png',
//   '1017.png', '1014.png', '1010.png', '1014.png', '1035.png',
//   '1035.png', '1066.png', '106.png',  '1055.png', '1075.png',
//   '1058.png', '1096.png', '1071.png', '1070.png', '1101.png',
//   '1091.png', '107.png',  '1070.png', '1071.png', '1080.png',
//   '1072.png', '1095.png', '1092.png', '1087.png', '1097.png',
//   '1091.png', '1080.png', '1095.png', '1098.png', '1101.png',
//   '1098.png', '1098.png', '1097.png', '113.png',  '1103.png',
//   '1102.png', '122.png',  '1107.png', '125.png',  '130.png',
//   '123.png',  '130.png',  '123.png',  '123.png',  '125.png',
//   '113.png',  '123.png',  '121.png',  '117.png',  '123.png',
//   '123.png',  '132.png'
// ]

// const uninscribedIds = [
// "s2d699aea-b241-4f34-a278-14f8605c0d76",
// "s0f6ad6a1-cb25-41ab-877b-f8f32f45985d",
// "sa0d6ef32-e8ab-4bc7-97da-85ea8f7a5e45",
// "s1c6c8e42-1ef0-470b-8074-df23db28f718",
// "s1022da2c-ee45-40ed-a212-414882927947",
// "sa1558b24-f290-4d64-a2ff-d41bbae986f1",
// "s6e161491-8af9-4f32-b3d4-39f83bcd479d",
// "sa52d8519-d740-4e19-88d9-1e5f706952d0",
// "s86aadf0d-8486-4ddc-9c9c-651111270694",
// "s85dba5db-7286-49be-b4ca-2f28b2849033",
// "s37d93b3e-36ee-4c47-823d-5e4e4d815f8e",
// "s6f54a93d-6841-4258-8641-567ec8f91027",
// "sd4704faa-d11a-4c30-aea5-5e9d5b6f1c58",
// "s20bc5b10-8095-4311-bcb1-03c5b261aebd",
// "sad48fa43-4b5b-4e43-af35-8071cedf2447",
// "sf88d9fde-b04c-4c23-ba15-87cd06692851",
// "s510e67f2-5219-427f-a8d0-d2177a29f373",
// "s1c79eb6e-def1-408f-8e04-2aabe56888d6",
// "sf9ced89c-b3eb-46b3-b707-ec925e20ab26",
// "s5349e4d5-b497-4f8b-a543-a769afb9b58a",
// "se444322a-949f-432f-bef6-69832a047f68",
// "s182a3544-3e1b-4402-bb69-450501d8ce43",
// "s1d4cb25a-ae07-43a9-92d8-dda5571a4a38",
// "s470d5e80-e576-4b11-b26b-a1cfa776fc0b",
// "s69d5df9f-38f0-4934-917e-b2bc639e377d",
// "s8d85f258-b912-4cd8-8aae-6b89912106f6",
// "s59fdbd61-6bff-45ef-a48e-81a6751653d6",
// "s5e6d0c1b-8795-4c59-89a8-f7cbdf0c0751",
// "sfdc2c7cf-5f5f-4213-985d-491ebd2e2264",
// "s35fb1a92-ffbf-479f-a0cf-715c46f7b18e",
// "s936f9edb-7839-4de3-b73f-8161ed442fb6",
// "sca896434-c563-4588-821f-7e1c655b20ab",
// "sa9c731d7-df74-447c-8689-27f98e04e4e0",
// "s16d99fdd-f16b-4377-a1bf-c46ce13978a9",
// "s490fd1e4-4e23-4db9-b923-6b148ea38d3b",
// "s557021bb-da32-4311-aa9a-98d1f5a9306f",
// "sc2d24fe7-10b3-496b-82a4-594c6048a790",
// "s28bb3fc4-d3ed-4b1c-8e1d-908f9c5bc0ae",
// "s2644967a-ef45-4520-aa8d-44edf8699c71",
// "sffd71230-0a2e-4e22-8465-484d1d2603ea",
// "sd2d0510f-7dfa-4575-bbe8-9bdd8beb473d",
// "s086fddb5-c00e-4cab-b462-131bea3bb0e0",
// "s82ab5922-0486-4682-8664-47735e1b8b26",
// "s2fb3e97c-5666-4a81-84e9-54f792361bf5",
// "s629ba962-9629-46d6-8592-35662a820e12",
// "sbd2da55a-b808-43a5-9bf7-2b9e596ecb50",
// "sf8e354cd-4379-44b2-a7e0-0930063c4166",
// "s4562563d-788d-49d2-ad32-15a9f2e78a18",
// "sb6228617-ec42-432a-824b-0e934317f2e0",
// "s56f00bf9-a4bb-4d58-b3d0-0c12170e3d49",
// "s2261f9cb-c885-4e15-aec1-b698336aada3",
// "s482534d9-6597-4935-8b6f-72122018fa05",
// "s09064fcb-db6a-41ad-a8b7-204b8258c8b9",
// "s5f83b4cf-3c1b-4d53-81a8-1aebc7959367",
// "sfc1385a7-6622-46ee-9819-e2603183ab82",
// "sfc5c6481-9fb5-4410-a7cc-bc446fa8bcce",
// "s0eb3d8a9-94ba-4552-b933-94064e751986",
// "s9457ebc0-0d99-437d-913f-ffab089c786c",
// "s186e2030-b71b-48ad-bfe7-af6486120ff3",
// "sf73a7d8c-f4c1-4cbe-9621-ff6e26dcb9dc",
// "s57e1da48-bf40-4a04-b758-ae3dfaee7581",
// "s257c1b60-a17b-4d1d-8367-62e5f99605d1",
// "s401d24d0-7f63-4172-a943-343b5b60ea68",
// "s3792dbc4-03b7-4a70-9ff1-f5085e2d9d4c",
// "s4e4e928d-c1b4-46eb-88e2-2dabf61395a2",
// "scdd80691-0b6d-4f4c-bda9-3fbe881f6a7a",
// "s8e3bfb1e-7ba8-422a-b7ac-db5bbdb8fa21",
// "sd6b12455-85e8-421a-a3de-7ba51d3b1846",
// "s8d5bb735-8c6b-4e51-9f77-f9aa42271e40",
// "s7062f265-6018-4633-acd0-a1c429c6fb3d",
// "sb9187056-9f4c-44b9-a8a7-1f06ca1572ed",
// "sd6320171-e748-427d-a11a-ea1c252bb9de",
// "s0d3387cb-175a-46d7-9083-5566025524c7",
// "sb77432fb-1abd-4286-97b0-81b9df59dfac",
// "s8fe8b2c0-58f1-4abf-aa36-a00109119416",
// "s0869734e-fd3c-4817-8ebf-9b293e5f132a",
// "s328e74a0-10df-4835-9041-c9971afbece2",
// "se13387ff-0e5b-4ddb-aec4-37e77ed55931",
// "s921a7baa-fd07-49a8-b15e-108a08464e2f",
// "s55ec3b9e-2da8-41c4-a472-15066f756f91",
// "s3a91d2a6-0f88-4e74-a281-139a5f299d50",
// "s217eecab-2cea-4b06-968e-b0d2f681d499",
// "s38644d05-04f3-4b93-ab0f-a2b769a7bad0",
// "s41edc6d3-c3d4-4605-9420-9cc5f2fc1f81",
// "sa0691faf-8326-4941-b259-45aa1e1342de",
// "sb9e7607e-3ffd-421a-ad4a-de66a069f552",
// "saf86ed07-887e-4844-bb02-b2bfd24fd677",
// "s328bacb0-162c-4721-b3ed-c440cdcc0d47",
// "s09d0780d-bd9f-49ae-b8cc-a4dc00ce124b",
// "s5b2aea30-7f85-42ac-bd7b-62e086e8d28c",
// "s35d6f238-677c-4193-9ae9-a7b32e380812",
// "s3bb73d47-69a6-4273-a5a0-64b1af0b5305",
// "s7d0800d0-3d05-452e-ac84-45524491e9bd",
// "sfafcc098-9ae0-41e0-907c-9eb16a775c2a",
// "s5146fa5f-4fd1-421e-8032-afb292afb0c1",
// "s9d288852-551b-4734-99d5-7edd1eaf425c",
// "s0492313f-9146-4681-bcfb-f9ebddd2f839",
// "s45016351-ab7c-46cd-b1d0-ad96c69f9922",
// "s5d1af595-c744-4af6-ad41-a8797e3b9886",
// "s7ea1fcd4-3d91-4dac-b86f-a07c97dbae59",
// "s60ced60c-8a18-4bdc-b554-5f685be57836",
// "sb487f5a7-16ed-410e-ad85-0a425320c468",
// "s2343cd59-dc72-4924-a04a-6a2caf7f2f25",
// "s0a6ea0e7-5eef-48e0-9745-6870f75ec826",
// "seb911cfa-a7f6-4738-b70b-edfb1f664e59",
// "s1a00c5a9-fa2e-491b-9d0d-7bb5864ec238",
// "s901df14f-0b46-426c-b149-d6cfd06dcbfd",
// "s6cf8cc66-254c-4604-b966-ee26b03206c5",
// "s5f4fddcd-bda6-4f89-9e59-e82183c9a279",
// "saac1b9da-1892-40c6-8474-c4e36ba0aa86",
// "s10b866fd-da31-49a1-90e7-311dfec9fc94",
// "sf115adcf-9b6a-437d-9d49-45070940f06f",
// "sd5c835a1-b08a-41bd-83e0-696ceb9ed26d",
// "s2fb56860-6af6-4c38-98a9-009ae7fe8dc3",
// "sc596657d-b3e1-49b8-9005-40c8d9a0e24a",
// "sbbea3e78-b83c-4d51-bf5d-eeeaf0334ef2",
// "s99ed447b-3876-40e7-8643-b56584b47018",
// "sda43309e-cfca-4a16-b93e-75eac465d959",
// "s9825a270-f55c-48b5-a6ba-679851be8a0c",
// "s3668c1f4-2936-4079-a71b-e83d26d29700",
// "sa53525c0-ef05-4142-9044-4502d7bc02dd",
// "s20c74b4e-a104-4229-826e-e363bf47e17f",
// "s50cdddc7-adaa-4616-abdb-d88560540099",
// "saad181b5-17a5-4ea3-9831-0939e319dd3f",
// "s641d990e-dae8-4276-b696-a7f7500a00d7",
// "sfefd4c77-907e-4717-973b-22dc5bff7be1",
// "s34e945f8-e938-4ed1-85e7-3ca4cf5698de",
// "s599b35d9-5f7e-44c5-8d62-7b740d30a4ba",
// "s2d5da047-3994-42bc-b54d-92236ef4b42b",
// "s37fe49cb-f013-4112-add8-32001b3ce07a",
// "se2826f1b-76fd-44d3-9f6a-785d7db8fd7d",
// "s2b8c961e-ea44-43da-813b-a510b309f274",
// "sdcad363b-d307-466d-90be-4feeb12b3760",
// "s5efae3ba-a4c7-46bf-98b7-13f73f7b133e",
// "s721bf425-65a3-4f23-b703-d1a573367e2b",
// "s88bbed73-b8f5-473d-9db4-4ac6944e61e8",
// "sa61e702b-d268-43d3-9350-dfdac2e22321",
// "s88322fd6-400a-45b4-bb87-e67fb40467ea",
// "se995c800-507f-424a-ab13-531dc518115e",
// "sfdca94e9-842e-4bf4-ba0a-a53da6944bb8",
// "sed30a8c8-dfda-491a-bac4-5f55bf18a293",
// "s249a25b3-be54-4131-bccc-f877752a21e7",
// "sbc629651-b1b9-4de4-a7ad-6cbfa6ae7e51",
// "sebfb38f9-1764-491d-85e1-fbf7a62f2d39",
// "s4fc4f531-9c99-461e-a1c1-9f21a26920bc",
// "s5f68907d-070f-4a95-97df-39129cc9f666",
// "s8f5d05eb-fd82-4c0e-a7c7-ba06d30316a5",
// "sbea76eaa-cf91-435b-ab92-c32419fbbbba",
// "s1f08c4ec-ae96-4e00-aebf-763bd45cce9f",
// "s15cacc23-5342-4448-83d2-c35d74ea4f2f",
// "s7e732fc4-6164-4962-a76c-61acf728c5f8",
// "sa45d3bd8-0b2c-45b5-889a-45647d1aab1c",
// "sbcd5f088-99ab-4db0-8557-8c80c3b55e8c",
// "sfe0fd45f-b334-4d65-8749-f4a0a47b9ce8",
// "sa866b93a-882f-46dd-b797-ed3c766eb7cf",
// "s9dea198e-c7eb-4797-b101-c83b472fc251",
// "s6826fc32-8ccc-4a48-a2e1-1f4d9858b649",
// "sa329341c-419c-47b4-ad59-91997841104e",
// "sa64244fe-c30b-4833-a198-8e6ee554c35f",
// "s47ec61f0-1bb8-4bce-9654-ece8558958b8",
// "se2808036-dd47-446c-8795-e34c4565315b",
// "s5a5e7782-8e2d-42f1-8098-4328ba0abe8b",
// "s986fed2d-28df-4547-9229-8f0109ae09fd",
// "sa6556b78-4d44-4523-a484-9f0edf9cef6d",
// "s896e4ee1-b587-41af-aba2-8450cd815e01",
// "s324cd902-c970-4355-ac39-b0b6650a4d72",
// "s086369d0-7b26-4257-9e13-af5ac344d533",
// "s242259c5-3470-4a06-9de8-a7d8a4a935bb",
// "sb9cb731c-54ef-4e38-93df-179cf5b33140",
// "se80f5fa8-7501-426c-b065-4092c3237450",
// "s3e71dd14-6ae3-482e-a40a-ddefe5d13fb4",
// "sb2602108-7ecd-4c70-93bc-366318230240",
// "sb25976d0-c291-4ec0-ac96-96281f8d988b",
// "sd5f64a50-0c4c-418c-a0b9-0695b9f38ce5",
// "s0857e197-9ecd-4501-91b3-805e086453f1",
// "s03a1e7fd-f95f-4d62-a0ba-e41e17efd867",
// "se617408f-6add-4bd7-b0d4-2e8fdd130fed",
// "s6513971a-d6f7-491f-9f99-de04e2d1f0d3",
// "s08566d72-472e-4a10-9e41-5118d53bc6e8",
// "sf5d50b13-0b05-421f-9df9-249679e6b786",
// "s678f1012-d948-443a-b60c-3d6c3a68a2f9",
// "sa61fa5b0-6333-4b2c-bf2e-c3fd40946c83",
// "s99a22e3c-a4b6-4acd-b6f7-b1856a221181",
// "s57ce104b-e6a7-4888-90f6-3a1a5d4ada5f",
// "sbbf27ac0-71f0-4564-98f8-87698e338fea",
// "sd5802e9e-9a32-4b13-8628-ed1ef9e68d67",
// "sfab8c1ad-3ec2-4fc9-bc80-2200bb6c145b",
// "s0eacc7b6-b7f7-40d6-972d-08f965f647e3",
// "s9a7c7290-f472-4f68-bf85-5a4d95bd5f21",
// "s6104abef-a611-4e9d-8ca0-189df19c52c2",
// "s81d2ca91-4992-41a1-9a30-dbed6d3ea3b4",
// "s74b3c46e-47df-4745-bf64-a1f10651e6ab",
// "s72f6684b-76fb-4874-8235-41d77b162dd5",
// "sd2055efe-2d30-4e88-8162-343fddd00cae",
// "s7bd06de1-fb8a-4d0a-947f-ee19659c0c25",
// "se9026d46-7ef0-47c6-a083-cc9567c9e8f8",
// "s3eb8b0f3-54d4-4a18-a397-3187e413b745",
// "sc7755f7c-c4bb-4fc7-9db2-1841381dd62d",
// "s9196da38-2221-4c23-aa7a-6bba4d425dd3",
// "sb94ed707-aa5d-4156-892f-ae685892108e",
// "s8a4ad718-f490-43ff-9dac-4891bb37526b",
// "s5ce1595e-f28c-4c8d-bb5b-e7667768671e",
// "sa744f58a-9d7d-4a29-9cdd-f47c488df3bd",
// "s09b1b822-a306-4597-a7d8-c1bedcfc5417",
// "s6c3b2646-8d7b-478f-b178-8b5632971d76",
// "s877dbbe8-7304-427a-9600-fb955919c969",
// "s0c0d2bf0-cdda-40a1-99f5-9e4880cc9173",
// "s254f4db8-60d0-4647-8aea-824e55a6773c",
// "s9bef8097-5870-443a-85f7-8fb81a44310f",
// "saaca0110-8753-4302-a334-d1a4fbeb0da3",
// "s45b878cf-1b42-425e-a42a-bfef022eafbd",
// "s2b5a2d5b-27c9-4f49-a5df-5a70d751ec70",
// "s5729d591-0403-4740-a3eb-710e5331391d",
// "sc148c723-6f52-4c34-b561-7f7843888357",
// "saded84c9-ec68-40a8-988d-9ef069933585",
// "s6579299e-7385-431e-9964-6154eef3aa4f",
// "sf72022e5-afd4-41be-bdb8-3106f1b89f29",
// "s90940ecd-a9fe-498d-b3cd-6cd30d39c417",
// "s9fecf90e-e823-428f-a8ac-5f668f2c4294",
// "sde60b1f9-bb87-4676-ba94-415049b4ee97",
// "sf54d8da9-237a-448c-a64e-63ef6976dd2d",
// "s4821abb0-8034-4a53-9d0e-a40172eea36f",
// "s5f27714f-5ef4-43a9-916b-96f87654bdd0",
// "scb2a0f59-9720-4217-8392-7e9005866bd8",
// "s361f044e-3954-4c74-83e6-81c3a6233cec",
// "sc5c29826-b175-4328-bffe-2ca16a4fcfac",
// "sd81a29d4-d498-4882-b50a-10ad61f87488",
// "s217f531b-4255-4866-8c7e-7210a3316a23",
// "s8049213d-fb15-4588-88e0-8632d2c6fbbe",
// "s940fd834-c357-4115-9116-d35bc7ed46bf",
// "s4ddf8c42-cfe2-43bb-81e7-514b7a654916",
// "s6d9061ef-3d4c-4379-b0b2-7748eb66ef22",
// "sa01e96dc-42b5-448e-acdd-314bcdf8fb1e",
// "sc2d438c3-eedc-467f-bf56-a421b2c0f7d1",
// "s4cc7b75a-6f08-4ba8-b1fb-baeaeec4d3b0",
// "s48a4144e-aa44-44b4-bce7-47228e0caf69",
// "s4c095d41-9713-4b33-9704-ac186d85975c",
// "s2f9d602b-d256-47de-bf51-ef002263089a",
// "s88a438ed-3497-4b32-8d7e-41bb924529ae",
// "sc03fb971-2756-4834-aa60-0a720d9d8745",
// "s3aa67efd-6709-4a30-a642-d6da58700e32",
// "sf52da8e8-b713-46ca-80c7-7638e5eecca3",
// "sd3f7f420-0fd5-4fa5-83fb-859f918c1f1f",
// "sae5d7198-ea23-4e89-b6c0-db74b4e3a8a4",
// "s6ca86f8e-0ff9-4353-b939-410c080e5ab5",
// "sa5923d9b-3fee-4b52-9a26-7c93516ae959",
// ]

// const newSelected = [
//   "999.png",
//   "998.png",
//   "997.png",
//   "996.png",
//   "994.png",
//   "993.png",
//   "992.png",
//   "991.png",
//   "990.png",
//   "99.png",
//   "989.png",
//   "988.png",
//   "987.png",
//   "986.png",
//   "985.png",
//   "984.png",
//   "983.png",
//   "982.png",
//   "981.png",
//   "980.png",
//   "98.png",
//   "979.png",
//   "978.png",
//   "977.png",
//   "976.png",
//   "975.png",
//   "974.png",
//   "973.png",
//   "972.png",
//   "971.png",
//   "970.png",
//   "97.png",
//   "969.png",
//   "968.png",
//   "967.png",
//   "966.png",
//   "965.png",
//   "964.png",
//   "962.png",
//   "961.png",
//   "960.png",
//   "96.png",
//   "959.png",
//   "958.png",
//   "957.png",
//   "956.png",
//   "954.png",
//   "953.png",
//   "952.png",
//   "951.png",
//   "950.png",
//   "95.png",
//   "949.png",
//   "948.png",
//   "947.png",
//   "946.png",
//   "945.png",
//   "942.png",
//   "941.png",
//   "940.png",
//   "94.png",
//   "938.png",
//   "937.png",
//   "936.png",
//   "935.png",
//   "934.png",
//   "932.png",
//   "931.png",
//   "930.png",
//   "929.png",
//   "928.png",
//   "926.png",
//   "925.png",
//   "924.png",
//   "923.png",
//   "921.png",
//   "920.png",
//   "92.png",
//   "919.png",
//   "917.png",
//   "916.png",
//   "915.png",
//   "914.png",
//   "913.png",
//   "912.png",
//   "911.png",
//   "910.png",
//   "91.png",
//   "909.png",
//   "908.png",
//   "907.png",
//   "906.png",
//   "905.png",
//   "903.png",
//   "902.png",
//   "901.png",
//   "900.png",
//   "90.png",
//   "899.png",
//   "897.png",
//   "896.png",
//   "895.png",
//   "894.png",
//   "892.png",
//   "891.png",
//   "890.png",
//   "89.png",
//   "886.png",
//   "885.png",
//   "884.png",
//   "883.png",
//   "882.png",
//   "881.png",
//   "880.png",
//   "88.png",
//   "879.png",
//   "878.png",
//   "877.png",
//   "876.png",
//   "875.png",
//   "874.png",
//   "873.png",
//   "872.png",
//   "871.png",
//   "870.png",
//   "87.png",
//   "869.png",
//   "868.png",
//   "867.png",
//   "866.png",
//   "865.png",
//   "864.png",
//   "863.png",
//   "862.png",
//   "861.png",
//   "860.png",
//   "86.png",
//   "859.png",
//   "858.png",
//   "857.png",
//   "856.png",
//   "855.png",
//   "854.png",
//   "853.png",
//   "852.png",
//   "851.png",
//   "850.png",
//   "85.png",
//   "849.png",
//   "848.png",
//   "847.png",
//   "846.png",
//   "845.png",
//   "843.png",
//   "842.png",
//   "841.png",
//   "84.png",
//   "839.png",
//   "838.png",
//   "837.png",
//   "836.png",
//   "835.png",
//   "834.png",
//   "833.png",
//   "832.png",
//   "831.png",
//   "830.png",
//   "83.png",
//   "829.png",
//   "828.png",
//   "826.png",
//   "824.png",
//   "823.png",
//   "822.png",
//   "821.png",
//   "820.png",
//   "82.png",
//   "819.png",
//   "818.png",
//   "817.png",
//   "816.png",
//   "815.png",
//   "813.png",
//   "810.png",
//   "81.png",
//   "809.png",
//   "808.png",
//   "807.png",
//   "805.png",
//   "802.png",
//   "801.png",
//   "800.png",
//   "798.png",
//   "797.png",
//   "794.png",
//   "793.png",
//   "792.png",
//   "791.png",
//   "790.png"
// ]

// const getImg = async (collectionId) => {
//   try{
//     const inscriptions = await Inscription.find({collectionId: collectionId, collectionPayment: "received"})
//     console.log(inscriptions.length)
//     //const uninscribed = inscriptions.map((x) => {
//       //return await checkPayment({inscriptionId:x.id, networkName:"mainnet"})
      
//       // return {
//       //   address: x.receiver,
//       //   fileNames: x.fileNames[0] || null,
//       //   payAddress: x.inscriptionDetails.payAddress,
//       //   id: x.id,
//       //   //txid: `https://mempool.space/tx/${x.spendTxid.split(":")[0]}`
//       //}
//     //})

//     const uninscribed = inscriptions.map((x) => x.receiver)
//     //const inscriptions = await Inscription.find({id: {$in: uninscribedIds}})
//     //const inscribedDup = await Inscription.find({id: {$in: inscribedDuplicate}})
//     //let total = await Inscription.find({collectionId: collectionId, collectionPayment: 'received'})

//     // let invalidOrders = []
//     // const invalid = total.forEach(x => {
//     //   if(x.spendTxid === null || x.spendTxid === undefined){
//     //     invalidOrders.push(x.id)
//     //   }
//     // })

//     // console.log(invalidOrders.length)
//     // console.log('total payment received:', total.length)
//     // const mintedDup = await Inscription.find({collectionId: collectionId, collectionPayment: 'received', inscribed: true})
//     // const collection = await Collection.findOne({id: collectionId});
//     // const minted = collection.minted
//     // const images = await getImages(collectionId);
    
//     // const inscDupImages = inscribedDup.map(x => x.fileNames[0])

//     // const validDuplicateImg = []
//     // const validDuplicate = []
//     // const invalidDuplicate = []
//     // const invalidDuplicateImg = []

//     // inscribedDup.forEach(x => {
//     //   if(!validDuplicateImg.includes(x.fileNames[0])){
//     //     validDuplicateImg.push(x.fileNames[0])
//     //     validDuplicate.push({
//     //       address: x.receiver,
//     //       fileName: x.fileNames[0],
//     //       payAddress: x.inscriptionDetails.payAddress,
//     //       id: x.id
//     //     })
//     //   }else{
//     //     invalidDuplicateImg.push(x.fileNames[0])
//     //     invalidDuplicate.push({
//     //       address: x.receiver,
//     //       fileName: x.fileNames[0],
//     //       payAddress: x.inscriptionDetails.payAddress,
//     //       id: x.id
//     //     })
//     //   }
//     // })    
    
//     // console.log('unInscribedDuplicate: ',inscriptions.length)
//     // console.log('inscribedDuplicate:', inscribedDup.length)
//     // console.log('inscribed duplicate images',inscDupImages)
//     // console.log('valid Duplicates:', validDuplicate.length)
//     // console.log('valid duplicate image', validDuplicateImg.length)
//     // console.log('invalid Duplicates:', invalidDuplicate)
//     // console.log('invalid duplicate image', invalidDuplicateImg)

//     // const toFindDuplicates = minted => minted.filter((item, index) => minted.indexOf(item) !== index)
//     // const duplicateElementa = toFindDuplicates(minted);
//     // let filteredDuplicate = [...new Set(duplicateElementa)];
//     // console.log('duplicate:',duplicateElementa.length)
//     // console.log('minted:', minted.length)
//     // console.log('fDub:', filteredDuplicate.length)
    
    
//     //const repeting = []
//     // const randomRep = []
//     // const _mintedDup = []
//     //uninscribed.forEach(x => {
//     //   //if(x.sat !== 'random'){
//         //if(duplicateImg.includes(x.fileNames)){
//         // if(x.fileNames === '106.png')  {
//         //  //console.log(x.id)
//         //   repeting.push ({
//         //     address: x.receiver,
//         //     fileName: x.fileNames,
//         //     payAddress: x.payAddress,
//         //     //payAddress: x.inscriptionDetails.payAddress,
//         //     id: x.id
//         //   })
//       // }
//     //   // }else{
//     //   //   randomRep.push({
//     //   //     address: x.receiver,
//     //   //     fileName: x.fileNames[0],
//     //   //     payAddress: x.inscriptionDetails.payAddress,
//     //   //     id: x.id
//     //   //   })
//     //   // }
//     //})
    
//     // const selected = [];
//     // let open = images.open

//     // const unInscribedDupImages = []
//     // const assigned = []
//     // repeting.forEach(x => {
//     //   item = open[open.length-1]
//     //   assigned.push({
//     //     updateOne: {
//     //       filter: { id: x.id },
//     //       update: { fileNames: [item] },
//     //       upsert: true,
//     //     },
//     //   })
//     //   unInscribedDupImages.push(x.fileName)
//     //   selected.push(item)
//     //   open.pop()
//     // })
//     // console.log('random:',randomRep.length);
//     // console.log('assigned :',assigned.length)
//     // console.log('selected :', selected.length)
//     // console.log('uninscribedDuplicateImages :', unInscribedDupImages.length)
    
//     // let deletFromDb = unInscribedDupImages.concat(invalidDuplicateImg)
//     // deletFromDb = deletFromDb.sort((a, b) => a - b);

//     // const newMinted = selected.concat(minted, deletFromDb, validDuplicateImg, invalidDuplicateImg)
//     // console.log('newMinted:',newMinted.length)

//     // let filteredNewMinted = [];
//     // newMinted.forEach(item => {
//     //     if (!filteredNewMinted.includes(item)) {
//     //       filteredNewMinted.push(item);
//     //     }
//     // });
//     // console.log('filteredNewMinted:', filteredNewMinted.length)
    


//     // //Add to db
//     // const addToDb = await Inscription.bulkWrite(assigned);
//     // collection.minted = filteredNewMinted
//     // const saved = await collection.save()
//     // console.log(uninscribed)

//     return uninscribed
//   }catch(e){
//     console.log(e.message)
//   }
// }

// let _interval = 3000;
// let timerId = 0
// let checkedIds = []
// let unInscribed = [];
// const check = async  () => {
//   timerId = setTimeout(async function check() {
//     if(unInscribed.length === 0){
//       unInscribed = await Inscription.find({collectionId: "c5924550f-c4d8-4fd9-841e-559112bd58c2", collectionPayment: "received", inscribed: false})
//       console.log(unInscribed.length);
//     }
//     let id = unInscribed[unInscribed.length-1].id
//     if(!checkedIds.includes(id)){
//       let checking = await checkPayment({inscriptionId:id, networkName:"mainnet"})
//       console.log(checking)
//       checkedIds.push(id)
//       unInscribed.pop()
//     }
//       timerId = setTimeout(check, _interval);
//    }, _interval);
// }

module.exports = { inscribe, checkPayment, sendCreatorsPayment, addToCreatorsQueue };





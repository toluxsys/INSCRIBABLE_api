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
  for (const value of arr2) {
    if (set.has(value)) {
      return true;
    }
  }

  return false;
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

    const collection = await Collection.findOne({
      id: inscription.collectionId,
    });
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

    const creatorPayDetails = await addToCreatorsQueue({inscriptionId:inscriptionId, networkName:networkName})
    console.log('payment added to queue:',creatorPayDetails.status)

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
    let mintCount;
    let result;
    let exists;
    let _savedCollection;

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

    if (inscription.fileNames.length === 0) {
      exists = false;
    } else {
      exists = verifyList(minted, inscription.fileNames);
    }

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

    if (balance.status[0].confirmed === false) {
      if (exists === false && inscription.fileNames.length !== 0) {
        if (inscription.mintStage.toString() === collection.mintStage.toString()) {
          _savedCollection = await Collection.findOneAndUpdate(
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
              txid: _txid,
            },
            routingKey: 'paymentSeen',
          });
          if (addToQueue.status !== true)
            return {
              message: 'error adding order to queue',
              data: { txid, ids: [] },
              status: false,
              _txId: _txid,
              key: 'error_adding_order_to_queue',
            };
          inscription.collectionPayment = 'received';
          inscription.spendTxid = balance.txid[0];
          await inscription.save();
          await subSatCount(inscription.sat, 1)
          mintCount = _savedCollection.minted.length;
        } else {
          return {
            message: 'order stage ended',
            data: { txid, ids: [] },
            status: false,
            _txId: _txid,
            key: 'order_stage_ended',
          };
        }
      } else if (exists === false && inscription.fileNames.length === 0) {
        const images = await getImages(inscription.collectionId);
        if (images.open.length === 0) {
          return {
            message: 'collection mint complete',
            data: { txid, ids: [] },
            status: false,
            _txId: _txid,
            key: 'collection_mint_complete',
          };
        }
        const fileNames = [];
        images.open.forEach((x) => {
          if (fileNames.length < inscription.mintCount) {
            fileNames.push(x);
          }
        });

        _savedCollection = await Collection.findOneAndUpdate(
          { id: inscription.collectionId },
          { $push: { minted: { $each: fileNames, $position: -1 } } },
          { new: true },
        );
        const address = await Address.findOne({
          mintStage: collection.mintStage,
          address: inscription.receiver,
          collectionId: collection.id,
        });
        address.mintCount += inscription.fileNames.length;
        await address.save();

        const addToQueue = await RabbitMqClient.addToQueue({
          data: {
            orderId: inscriptionId,
            networkName,
            txid: _txid,
          },
          routingKey: 'paymentSeen',
        });
        if (addToQueue.status !== true)
          return {
            message: 'error adding order to queue',
            data: { txid, ids: [] },
            status: false,
            _txId: _txid,
            key: 'error_adding_order_to_queue',
          };
        inscription.fileNames = fileNames;
        inscription.collectionPayment = 'received';
        inscription.spendTxid = balance.txid[0];
        await inscription.save();
        await subSatCount(inscription.sat, 1)
        mintCount = _savedCollection.minted.length;
      }

      result = {
        message: `payment seen on mempool`,
        data: {
          txid,
          ids: [],
        },
        _txId: _txid,
        status: true,
      };
    } else if (balance.status[0].confirmed === true) {
      if (inscription.error === true) {
        const addToQueue = await RabbitMqClient.addToQueue({
          data: {
            orderId: inscriptionId,
            networkName,
            txid: _txid,
          },
          routingKey: 'paymentSeen',
        });
        if (addToQueue.status !== true)
          return {
            message: 'error adding order to queue',
            data: { txid, ids: [] },
            status: false,
            _txId: _txid,
            key: 'error_adding_order_to_queue',
          };
        inscription.error = false;
        await inscription.save();
        result = {
          message: `added to queue`,
          data: {
            txid,
            ids: [],
          },
          _txId: _txid,
          status: true,
        };
      } else if (exists === false && inscription.fileNames.length !== 0) {
        if (inscription.mintStage.toString() === collection.mintStage.toString()) {
          _savedCollection = await Collection.findOneAndUpdate(
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
              txid: _txid,
            },
            routingKey: 'paymentSeen',
          });
          if (addToQueue.status !== true)
            return {
              message: 'error adding order to queue',
              data: { txid, ids: [] },
              status: false,
              _txId: _txid,
              key: 'error_adding_order_to_queue',
            };
          inscription.collectionPayment = 'received';
          inscription.spendTxid = balance.txid[0];
          await inscription.save();
          await subSatCount(inscription.sat, 1)
          mintCount = _savedCollection.minted.length;
        } else {
          return {
            message: 'order stage ended',
            data: { txid, ids: [] },
            status: false,
            _txId: _txid,
            key: 'order_stage_ended',
          };
        }
      } else if (exists === false && inscription.fileNames.length === 0) {
        const images = await getImages(inscription.collectionId);
        if (images.open.length === 0) {
          return {
            message: 'collection mint complete',
            data: { txid, ids: [] },
            status: false,
            _txId: _txid,
            key: 'collection_mint_complete',
          };
        }
        const fileNames = [];
        images.open.forEach((x) => {
          if (fileNames.length < inscription.mintCount) {
            fileNames.push(x);
          }
        });

        _savedCollection = await Collection.findOneAndUpdate(
          { id: inscription.collectionId },
          { $push: { minted: { $each: fileNames, $position: -1 } } },
          { new: true },
        );
        const address = await Address.findOne({
          mintStage: collection.mintStage,
          address: inscription.receiver,
          collectionId: collection.id,
        });
        address.mintCount += inscription.fileNames.length;
        await address.save();

        const addToQueue = await RabbitMqClient.addToQueue({
          data: {
            orderId: inscriptionId,
            networkName,
            txid: _txid,
          },
          routingKey: 'paymentSeen',
        });
        if (addToQueue.status !== true)
          return {
            message: 'error adding order to queue',
            data: { txid, ids: [] },
            status: false,
            _txId: _txid,
            key: 'error_adding_order_to_queue',
          };
        inscription.fileNames = fileNames;
        inscription.collectionPayment = 'received';
        inscription.spendTxid = balance.txid[0];
        await inscription.save();
        await subSatCount(inscription.sat, 1)
        mintCount = _savedCollection.minted.length;
      }
    }

    if (collection.collectionDetails.totalSupply === mintCount) {
      await Collection.findOneAndUpdate(
        { id: inscription.collectionId },
        { ended: true },
        { new: true },
      );
      return {
        message: 'collection mint complete',
        data: { txid, ids: [] },
        _txId: _txid,
        status: false,
        key: 'collection_mint_complete',
      };
    }
    return result;
  } catch (e) {
    console.log(e.message);
  }
};

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
    console.log(e.message);
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

    let inscResult;
    if (inscription.collectionId) {
      inscResult = await collectionInscribe({ inscriptionId, networkName });
    } else {
      inscResult = await defaultInscribe({ inscriptionId, networkName });
    }

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
    console.log(e.message);
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
    console.log(e.message);
  }
};

module.exports = { inscribe, checkPayment, sendCreatorsPayment, addToCreatorsQueue };

// checkPayment({inscriptionId: "se28c1b9d-b90f-4f6f-b914-a933cbb1ce89", networkName: "mainnet"}).then(res => console.log(res)).catch()
// getImages().then(res => console.log(res)).catch()

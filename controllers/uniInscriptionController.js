/* eslint-disable object-shorthand */
/* eslint-disable prettier/prettier */
const { checkPayment, inscribe } = require('../helpers/inscriptionHelper');
const Inscription = require('../model/inscription');
const BulkInscription = require('../model/bulkInscription');
const SpecialSat = require('../model/specialSats');
const { getType } = require('../helpers/getType');
const { getUserOrder } = require('../helpers/mintAnalysis');
const { addSats, updateSatDetails } = require('../helpers/satHelper')

module.exports.verifyPayment = async (req, res) => {
  try {
    const { inscriptionId, networkName } = req.body;
    if (!inscriptionId)
      return res
        .status(200)
        .json({ message: 'inscription id is required', status: false });
    if (!networkName)
      return res
        .status(200)
        .json({ message: 'network name is required', status: false });
    const result = await checkPayment({
      inscriptionId,
      networkName,
    });
    if (result.status === true) {
      return res.status(200).json({
        status: true,
        message: result.message,
        txid: result.data.txid,
      });
    }
    return res
      .status(200)
      .json({ status: false, message: result.message, txid: result.data.txid });
  } catch (e) {
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.inscribeItem = async (req, res) => {
  try {
    const { inscriptionId, networkName } = req.body;
    if (!inscriptionId)
      return res
        .status(200)
        .json({ message: 'inscription id is required', status: false });
    if (!networkName)
      return res
        .status(200)
        .json({ message: 'network name is required', status: false });
    const result = await inscribe({
      inscriptionId,
      networkName,
    });

    if(result === undefined){
      return res.status(200).json({
        status: false,
        message: 'inscription not complete',
        userResponse: [],
      });
    }

    if (result.status === true) {
      return res.status(200).json({
        status: result.status,
        message: result.message,
        userResponse: result.data.ids,
      });
    }
  } catch (e) {
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getAllAddressOrder = async (req, res) => {
  try {
    const { address, networkName } = req.body;
    const s_orders = await Inscription.find({
      receiver: address,
      flag: networkName,
    });
    const b_orders = await BulkInscription.find({
      receiver: address,
      flag: networkName,
    });
    const orders = s_orders.concat(b_orders);
    if (orders.length === 0)
      return res
        .status(200)
        .json({ status: true, message: 'address has no order', data: [] });
    const allOrder = orders.map((x) => {
      let collectionId = '';
      let error = false;
      let errorMessage = '';
      let ids = [];
      if (x.collectionId) collectionId = x.collectionId;
      if (x.error) error = x.error;
      errorMessage = x.errorMessage;
      if (x.inscription) ids = x.inscription;
      return {
        id: x.id,
        satType: x.sat,
        isInscribed: x.inscribed,
        paymentStatus: x.collectionPayment,
        totalCost: {
          sat: x.cost.total,
          btc: x.cost.total / 1e8,
        },
        payAddress: x.inscriptionDetails.payAddress,
        collectionId,
        error,
        errorMessage,
        ids,
        timeStamp: {
          createdAt: x.createdAt,
          updatedAt: x.updatedAt,
        },
      };
    });
    return res
      .status(200)
      .json({ status: true, message: 'ok', data: allOrder });
  } catch (e) {
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getOrder = async (req, res) => {
  try {
    const { inscriptionId, networkName } = req.body;
    const type = getType(inscriptionId);
    let inscription;
    if (type === 'single') {
      inscription = await Inscription.findOne({
        id: inscriptionId,
        flag: networkName,
      });
    } else if (type === 'bulk') {
      inscription = await BulkInscription.findOne({
        id: inscriptionId,
        flag: networkName,
      });
    } else {
      return res
        .status(200)
        .json({ status: false, message: 'invalid Id', data: {} });
    }

    if (!inscription)
      return res
        .status(200)
        .json({ status: false, message: 'order not found', data: {} });
    const data = {
      id: inscription.id,
      satType: inscription.sat,
      isInscribed: inscription.inscribed,
      paymentStatus: inscription.collectionPayment,
      totalCost: {
        sat: inscription.cost.total,
        btc: inscription.cost.total / 1e8,
      },
      payAddress: inscription.inscriptionDetails.payAddress,
      collectionId: inscription.collectionId || '',
      error: inscription.error,
      errorMessage: inscription.errorMessage,
      ids: inscription.inscription,
      timeStamp: {
        createdAt: inscription.createdAt,
        updatedAt: inscription.updatedAt,
      },
    };
    return res.status(200).json({ status: true, message: 'ok', data });
  } catch (e) {
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.getReceiverOrder = async (req, res) => {
  try {
    const { collectionId, receiverAddress } = req.body;
    const orders = await getUserOrder(collectionId, receiverAddress);
    return res.status(200).json({ status: true, message: 'ok', data: orders });
  } catch (e) {
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.updateSatDetails = async (req, res) => {
  try {
    // [{satType: "pizza", price: 0.5}]
    const { satDetails } = req.body;
    const result = await updateSatDetails(satDetails)
    if(result.status === false) return res.status(200).json({ status: false, message: 'error updating sat details' });
    return res.status(200).json({ status: true, message: 'sat details updated' });
  } catch (e) {
    console.log(e);
    return res.status(200).json({ status: false, message: e.message });
  }
};

module.exports.addSats = async (req, res) => {
  try{
    const {sats, type} = req.body;
    let count = 0
    sats.forEach(x => {
      count += parseInt(x.total)
    })
    const satDetails = [{
      satType: type,
      count: count
    }]
    const addedSat = await addSats(sats, type)
    if(!addedSat) return res.status(200).json({status: false, message: 'error adding sats'})
    await updateSatDetails(satDetails)
    return res.status(200).json({message: 'Sat added', status: true})
  }catch(e){
    return res.status(200).json({ status: false, message: e.message });
  }
}

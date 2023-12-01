const Inscription = require('../model/inscription');
const BulkInscription = require('../model/bulkInscription');

const getUserOrder = async (collectionId, receiver) => {
  try {
    let payAddress = [];
    let inscription = await Inscription.find({
      collectionId,
      receiver,
    });
    const bulk = await BulkInscription.find({
      collectionId,
      receiver,
    });
    inscription = inscription.concat(bulk);
    const addr = inscription.map((x) => ({
      payAddress: x.inscriptionDetails.payAddress,
      inscribed: x.inscribed,
      payment: x.collectionPayment,
      orderId: x.id,
      amount: x.cost.total,
      error: x.error,
    }));
    payAddress = payAddress.concat(addr);
    return payAddress;
  } catch (e) {
    console.log(e);
  }
};

module.exports = { getUserOrder };

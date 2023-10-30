const Inscription = require("../model/inscription");
const BulkInscription = require("../model/bulkInscription");

const getUserOrder = async (collectionId,receiver) => {
    try{
        let  payAddress  = []
        let inscription = await Inscription.find({collectionId: collectionId, receiver: receiver})
        let bulk = await BulkInscription.find({collectionId: collectionId, receiver: receiver})
        inscription = inscription.concat(bulk)
        let addr = inscription.map(x => {

            return {payAddress: x.inscriptionDetails.payAddress, inscribed: x.inscribed, payment: x.collectionPayment, orderId: x.id, amount:x.cost.total ,error: x.error}
        })
        payAddress = payAddress.concat(addr)
        return payAddress;
    }catch(e){
        console.log(e)
    }
}

module.exports = {getUserOrder}

// getOrder("c5a937591-2db8-4618-b23a-ca30093d8c2c", {receiver: "bc1pksakuxndygren52jemwecxf9m30zwr0ak9jdr0x3dkuzpq7e6swq6xmzsq"}).then(res => console.log(res)).catch()
const {checkPayment, inscribe} = require("../helpers/inscriptionHelper")
const Inscription = require("../model/inscription");
const BulkInscription = require("../model/bulkInscription");
const { getType } = require("../helpers/getType");


module.exports.verifyPayment = async (req, res) => {
    try{
        const {inscriptionId, networkName} = req.body;
        if(!inscriptionId) return res.status(200).json({message: "inscription id is required", status: false})
        if(!networkName) return res.status(200).json({message: "network name is required", status: false})
        let result = await checkPayment({inscriptionId:inscriptionId, networkName:networkName})
        if(result.status === true){
            return res.status(200).json({status:true, message: result.message, txid: result.data.txid})
        }else{
            return res.status(200).json({status:false, message: result.message, txid: result.data.txid})
        }
    }catch(e){
        return res.status(200).json({status:false, message: e.message})
    }
}

module.exports.inscribeItem = async (req, res) => {
    try{
        const {inscriptionId, networkName} = req.body;
        if(!inscriptionId) return res.status(200).json({message: "inscription id is required", status: false})
        if(!networkName) return res.status(200).json({message: "network name is required", status: false})
        let result = await inscribe({inscriptionId:inscriptionId, networkName:networkName})
        if(result.status === true){
            return res.status(200).json({status:true, message: result.message, userResponse: result.data.ids})
        }else{
            return res.status(200).json({status:false, message: result.message, userResponse: result.data.ids})
        }
    }catch(e){
        return res.status(200).json({status:false, message: e.message})
    }
}

module.exports.getAllAddressOrder = async (req, res) => {
    try{
        const {address, networkName} = req.body
        let s_orders = await Inscription.find({receiver:address, flag: networkName})
        let b_orders = await BulkInscription.find({receiver:address, flag: networkName})
        let orders = s_orders.concat(b_orders);
        if(orders.length === 0) return res.status(200).json({status: true, message: "address has no order", data: []})
        let allOrder = orders.map(x => {
            let collectionId = ""
            let error = false
            let errorMessage = ""
            let ids = []
            if(x.collectionId) collectionId = x.collectionId
            if(x.error) error = x.error; errorMessage = x.errorMessage
            if(x.inscription) ids = x.inscription
            return {
                id: x.id,
                satType: x.sat,
                isInscribed: x.inscribed,
                paymentStatus: x.collectionPayment,
                totalCost: {
                    sat: x.cost.total,
                    btc: x.cost.total/1e8
                },
                payAddress: x.inscriptionDetails.payAddress,
                collectionId: collectionId,
                error: error,
                errorMessage: errorMessage,
                ids: ids,
                timeStamp: {
                    createdAt: x.createdAt,
                    updatedAt: x.updatedAt
                }
            }
        })
        return res.status(200).json({status: true, message: "ok", data: allOrder})
    }catch(e){
        return res.status(200).json({status:false, message: e.message})
    }
}

module.exports.getOrder = async (req, res) => {
    try{
        const {inscriptionId, networkName} = req.body
        let type = getType(inscriptionId)
        let inscription;
        if (type === 'single') {
            inscription = await Inscription.findOne({ id: inscriptionId , flag: networkName});
        } else if (type === 'bulk') {
            inscription = await BulkInscription.findOne({ id: inscriptionId , flag: networkName});
        }else{
            return res.status(200).json({status: false, message: "invalid Id", data: {}})
        }

        if(!inscription) return res.status(200).json({status: false, message: "order not found", data: {}})
        let data = {
            id: inscription.id,
            satType: inscription.sat,
            isInscribed: inscription.inscribed,
            paymentStatus: inscription.collectionPayment,
            totalCost: {
                sat: inscription.cost.total,
                btc: inscription.cost.total/1e8
            },
            payAddress: inscription.inscriptionDetails.payAddress,
            collectionId: inscription.collectionId || "",
            error: inscription.error,
            errorMessage: inscription.errorMessage,
            ids: inscription.inscription,
            timeStamp: {
                createdAt: inscription.createdAt,
                updatedAt: inscription.updatedAt
            }
        }
        return res.status(200).json({status: true, message: "ok", data: data})
    }catch(e){
        return res.status(200).json({status:false, message: e.message})
    }
}
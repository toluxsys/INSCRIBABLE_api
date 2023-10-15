const {checkPayment, inscribe} = require("../helpers/inscriptionHelper")


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
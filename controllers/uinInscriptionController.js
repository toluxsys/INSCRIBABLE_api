const {checkPayment, inscribe} = require("../helpers/inscriptionHelper")


module.exports.verifyPayment = async (req, res) => {
    try{
        const {inscriptionId, networkName} = req.body;
        if(!inscriptionId) return res.status(200).json({message: "inscription id is required", status: false})
        if(!networkName) return res.status(200).json({message: "network name is required", status: false})
        let result = await checkPayment({inscriptionId:inscriptionId, networkName:networkName})
        return res.status(200).json({status:true, message: result.message})
    }catch(e){

    }
}
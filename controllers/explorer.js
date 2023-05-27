const explorer = require("../helpers/explorer");


module.exports.getJsonInscription = async (req, res) => {
    try {
      const{start, stop, limit} = req.body;
      const result = await explorer.getJsonInscription(start, stop, limit);
      if(!result) return res.status(200).json({status: false, message: "inscriptions not found"});
      return res.status(200).json({status: true, message: "ok", userResponse: result});
    } catch (e) {
      console.log(e.message);
      return res.status(200).json({ status: false, message: e.message });
    }
}


module.exports.getInscriptionContent = async (req, res) => {
  try {
    const id = req.params.inscription_id;
    const result = await explorer.getInscriptionContent(id);
    if(!result) return res.status(200).json({status: false, message: "inscriptions content not found"});
      return res.status(200).json({status: true, message: "ok", userResponse: result});
  } catch(e) {
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
} 

module.exports.previewInscriptionContent = async (req, res) => {
  try {
    const id = req.params.inscription_id;
    const result = await explorer.previewInscriptionContent(id);
    if(!result) return res.status(200).json({status: false, message: "inscriptions not found"});
    return res.status(200).json({status: true, message: "ok", userResponse: result});
  } catch(e) {
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
}

module.exports.getInscriptionFeed = async(req,res) => {
  try{
    const result = await explorer.getInscriptionFeed();
    if(!result) return res.status(200).json({status: false, message: "unable to load feed"});
    return res.status(200).json({status: true, message: "ok", userResponse: result});
  }catch(e){
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
}

module.exports.getInscriptionById = async (req,res) => {
  try{
    const id = req.params.inscription_id;
    const result = await explorer.getInscriptionById(id);
    if(!result) return res.status(200).json({status: false, message: "inscriptions not found"});
    return res.status(200).json({status: true, message: "ok", userResponse: result});
  }catch(e){
    console.log(e.message);
    return res.status(200).json({ status: false, message: e.message });
  }
}

module.exports.getInscriptionByAddress = async (req,res) => {
    try{
      const address = req.params.address;
      const result = await explorer.getInscriptionByAddress(address);
      if(!result) return res.status(200).json({status: false, message: "inscriptions not found"});
      return res.status(200).json({status: true, message: "ok", userResponse: result});
    }catch(e){
      console.log(e.message);
      return res.status(200).json({ status: false, message: e.message });
    }
  }

module.exports.getInscriptionByNumber = async (req,res) => {
    try{
    const inscriptionNumber = req.params.inscriptionNumber;
      const result = await explorer.getInscriptionByNumber(inscriptionNumber);
      if(!result) return res.status(200).json({status: false, message: "inscriptions not found"});
      return res.status(200).json({status: true, message: "ok", userResponse: result});
    }catch(e){
      console.log(e.message);
      return res.status(200).json({ status: false, message: e.message });
    }
}
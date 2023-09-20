const address = require("../model/address")

const addImage = (addresses, userAddress) => {
    try{
        let images = [];
        for(let i = 0; i < addresses.length; i++){
            if(addresses[i].split(":")[0] === userAddress){
                images.push(addresses[i].split(":")[1])
            }
        }
        return images
    }catch(e){
        console.log(e.message)
    }
}

module.exports = {
    addImage
}
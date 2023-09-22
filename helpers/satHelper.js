const mempoolJS = require("@mempool/mempool.js");
const fs = require("fs");
const { MongoClient } = require('mongodb');
const ObjectId = require('mongoose').Types.ObjectId; 
const dotenv = require("dotenv").config();

const init = async (network) => {
    const {
      bitcoin: { addresses, fees, transactions },
    } = mempoolJS({
      hostname: "mempool.space",
      network: network,
    });
  
    return { addresses, fees, transactions };
};
  
const initMongoDb = async () => {
    const uri = process.env.SATS_DB_URI;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db("test");
    return {db, client};
};

const getStatus = async (txId) => {
    const {transactions } = await init("mainnet");
     let txid = txId ;
     const tx = await transactions.getTx({ txid });
     return  tx.status.confirmed;   
};

const getSats = async () => {
    try{
        let {db, client} = await initMongoDb()
        let  Sats = db.collection("sats")
        let sats = []
        let _sats = await Sats.find({}).toArray()
        let available = new Map()
        let satCount = new Map()
        for (let i = 0; i < _sats.length; i++) {
            const element = _sats[i];
            if (element.count !== element.total) {
                let _count = element.total - element.count
                if(!available.has(element.type)){
                    available.set(element.type, _count)
                    satCount.set(element.type, 1)
                }else{
                    let balance = available.get(element.type) + _count
                    available.set(element.type, balance)
                    satCount.set(element.type, satCount.get(element.type)+1)
                }  
            } 
        }

        sats.push({satType:"ordinary", available:100000, utxoCount:1 })

        available.forEach((value, key) => {
            sats.push({satType:key, available:value, utxoCount:satCount.get(key) })
        })
        
        await client.close();

        return sats
  
    }catch(e){
        console.log(e.message)
    }
} 



module.exports = {getStatus,getSats}
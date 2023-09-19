const {exec, execSync} = require('child_process');
const mempoolJS = require("@mempool/mempool.js");
const Sats = require("../models/sats.js");
const Address = require("../models/addresses.js");
const fs = require("fs");
const { MongoClient } = require('mongodb');
const ObjectId = require('mongoose').Types.ObjectId; 
const { add } = require('mongoose/lib/helpers/specialProperties.js');
const dotenv = require("dotenv").config();
let satTypes = ['rare', 'block9', 'pizza','pizza1','uncommon','block78', "black"];

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
    const db = client.db(process.env.DB_NAME);
    return db;
};

const getStatus = async (txId) => {
    const {transactions } = await init("mainnet");
     let txid = txId ;
     const tx = await transactions.getTx({ txid });
     return  tx.status.confirmed;   
 };

 const getSpendUtxo = async (address, network) => {
    try {
      const { addresses } = await init(network);
      const response = await addresses.getAddressTxsUtxo({ address });
  
      let utxos = response;
      let outputs =[];
  
      if(utxos.length === 0){
        return "no utxos"
      }
  
      for (const element of utxos) {
        let output = element.txid + ":" + element.vout;
        outputs.push(output);
      }
  
      return outputs[0];
    } catch (e) {
      throw new Error(e.message);
    }
  };
 
 const getAvailableCount = async (type) => {
     try{
         let _sats = await Sats.find({type: {$in: type}});
         let count = 0;
         await Promise.all(_sats.map(async (element) => {
         let available = await getStatus(element.txid.split(':')[0]);
         if(available === true){
             count++;
         }
         }));
     return count;
 }catch(err){
         console.log(err);
     }
 };

const getSats = async (type, limit, walletName, payAddress, receiver, feeRate, network ) => {
    try{
        let Sats = await initMongoDb().Sats
        let sats = []
        let _sats = await Sats.find({type: type})
        for (let i = 0; i < _sats.length; i++) {
            const element = _sats[i];
            let _txid = element.txid.split(':')[0];
            let status = await getStatus(_txid);
        if (element.count === element.total) {
            continue; // Continue the loop
        } else if(status === true){
            sats.push(element);
            if (sats.length === limit) break; // Break the loop   
        }else{
            continue;
        }

        sats.forEach(async (element, index) => {
            let offset = element.amount - 1;
            let satPoint = element.txid + ':' + offset;
            let path = details[index].path;
            let spendUtxo = await getSpendUtxo(payAddress, network)
            execSync(`sudo chmod u=rwx,g=rwx,o=rwx ${path}`);
            let command = `ord --cookie-file "/home/ubuntu/.bitcoin/.cookie" --wallet ${walletName} wallet inscribe --no-backup --coin-control --utxo ${spendUtxo} --utxo ${element.txid} --satpoint ${satPoint} --fee-rate ${feeRate} --postage "550 sats" --change ${process.env.MAINNET_SERVICE_CHARGE_ADDRESS} --destination ${receiver}  ${path} --dump`;
            const child = execSync(command).toString();
            let _child = JSON.parse(child.split("}\n")[1]+`}`);
            _inscriptions.push(_child.inscriptions[0]);
            inscribed.push({inscriptionId: _child.inscriptions[0], id: details[index].id, address: details[index].address, fileName: path.split('/')[path.split('/').length - 1]});
            console.log(_child.inscriptions[0]);
            let txId = _child.commit;
            data.push({
                _id: element._id,
                txid: txId,
                amount: element.amount - 1,
                count: element.count + 1,
            });
            execSync(`sudo rm ${path}`);       
        });
    }
    }catch(e){
        console.log(e.message)
    }
} 



module.exports = {getStatus, getAvailableCount, getSats}
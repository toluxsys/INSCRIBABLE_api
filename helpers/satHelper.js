/* eslint-disable object-shorthand */
/* eslint-disable arrow-body-style */
/* eslint-disable prettier/prettier */
/* eslint-disable no-else-return */
/* eslint-disable object-shorthand */
/* eslint-disable prettier/prettier */

const mempoolJS = require('@mempool/mempool.js');
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongoose').Types;

const SpecialSat = require('../model/specialSats')

const satTypes = ['rare', 'common', 'block9', 'pizza','pizza1','uncommon', '2009', '2010', '2011', 'block78', 'elon', 'palindrome', 'black'];

const init = async (network) => {
  const {
    bitcoin: { addresses, fees, transactions },
  } = mempoolJS({
    hostname: 'mempool.space',
    network,
  });

  return { addresses, fees, transactions };
};

const initMongoDb = async () => {
  const uri = process.env.SATS_DB_URI;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('test');
  return { db, client };
};

const getStatus = async (txId) => {
  const { transactions } = await init('mainnet');
  const txid = txId;
  const tx = await transactions.getTx({ txid });
  return tx.status.confirmed;
};

const getSats = async () => {
  try {
    const { db, client } = await initMongoDb();
    const Sats = db.collection('sats');
    const sats = [];
    const _sats = await Sats.find({}).toArray();
    const available = new Map();
    const satCount = new Map();
    for (let i = 0; i < _sats.length; i++) {
      const element = _sats[i];
      if (element.count !== element.total) {
        const _count = element.total - element.count;
        if (!available.has(element.type)) {
          available.set(element.type, _count);
          satCount.set(element.type, 1);
        } else {
          const balance = available.get(element.type) + _count;
          available.set(element.type, balance);
          satCount.set(element.type, satCount.get(element.type) + 1);
        }
      }
    }

    sats.push({ satType: 'random', available: 100000, utxoCount: 1 });
    const specialSat = await SpecialSat.find({})
    specialSat.forEach((x) => {
      if(x.count > 0){
         sats.push({
          satType: x.satType,
          available: x.count
        })
      }
    })
    // available.forEach((value, key) => {
    //   if(value !== 0){
    //     sats.push({
    //       satType: key,
    //       available: value,
    //       utxoCount: satCount.get(key),
    //     });
    //   }
    // });

    await client.close();
    return sats;
  } catch (e) {
    console.log(e.message);
  }
};

const updateSatDetails = async (satDetails) => {
  try {
    // [{satType: "pizza", price: 0.5}]
    const specialSat = await SpecialSat.find({});
    const uniqueSat = [];
    const available = [];
    if (!specialSat) {
      await SpecialSat.insertMany(satDetails);
    } else {
      const satTypes = specialSat.map((sat) => sat.satType);
      satDetails.forEach((type) => {
        if (!satTypes.includes(type.satType)) {
          uniqueSat.push(type);
        } else {
          available.push(type);
        }
      });
      await SpecialSat.insertMany(uniqueSat);

      const writeOperation = available.map((sat) => {
        if (sat.description) {
          return {
            updateOne: {
              filter: { satType: sat.satType },
              update: { description: sat.description },
              upsert: true,
            },
          };
        }
        if (sat.publicAvailable !== undefined) {
          return {
            updateOne: {
              filter: { satType: sat.satType },
              update: { publicAvailable: sat.publicAvailable },
              upsert: true,
            },
          };
        }
        if (sat.price) {
          return {
            updateOne: {
              filter: { satType: sat.satType },
              update: { price: sat.price },
              upsert: true,
            },
          };
        }

        if (sat.count) {
          return {
            updateOne: {
              filter: { satType: sat.satType },
              update: { count: sat.count },
              upsert: true,
            },
          };
        }
      });
      await SpecialSat.bulkWrite(writeOperation);
    }
    return ({ status: true, message: 'sat price added' });
  } catch (e) {
    console.log(e);
  }
};

//amount is the total amout in sats in the utxo
//total is the actual total amout of special sat in the utxo
const addSats = async (sats, type) => {
  try{
      const { db, client } = await initMongoDb();
      const Sats = db.collection('sats');
      if(!satTypes.includes(type)) return 'invalid type';
      const data = [];
      sats.forEach((sat) => {
        data.push({
            type: type,
            txid: sat.txid,
            amount: sat.amount,
            total: sat.total,
            count: 0
        }) 
      });
      const savedSats = await Sats.insertMany(data);
      await client.close();
      return  savedSats
  }catch(error){
      return error.message;
  }
}

const subSatCount = async (type, count) => {
  try{
      if(type !== 'random'){
        const specialSat = await SpecialSat.findOne({satType: type})
        specialSat.count -= count
        await specialSat.save()
        return 'updated'
      }
      return 'updated'
  }catch(e){
    console.log(e.message)
  }
}


module.exports = { getStatus, getSats, addSats, subSatCount, updateSatDetails};

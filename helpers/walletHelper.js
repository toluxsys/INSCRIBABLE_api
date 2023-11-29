/* eslint-disable object-shorthand */
/* eslint-disable prettier/prettier */
const axios = require('axios');
const mempoolJS = require('@mempool/mempool.js');
const dotenv = require('dotenv');

dotenv.config();

const init = async (network) => {
  const {
    bitcoin: { addresses, fees, transactions },
  } = mempoolJS({
    hostname: 'mempool.space',
    network,
  });

  return { addresses, fees, transactions };
};

const getUtxo = async (address, network) => {
  try {
    const { addresses } = await init(network);
    const response = await addresses.getAddressTxsUtxo({ address });
    const data = [];
    const utxos = response;

    for (const element of utxos) {
      data.push({txid: element.txid, vout: element.vout, value: element.value, status: element.status.confirmed })
    }
    return data
  } catch (e) {
    console.log(e.message);
  }
};

const getAddressHistory = async (collectionAddress, payAddress, network) => {
  try{
    const { addresses } = await init(network);
    const history = await addresses.getAddressTxs({address: payAddress})
    const data = [];
    for(const x of history){
      const vout = x.vout;
      vout.forEach((item, index) => {
        if(item.scriptpubkey_address === collectionAddress){
          data.push({txid: x.txid, vout: index, value: item.value, status: x.status.confirmed})
        }
      })
    }
    return data;
  }catch(e){
    console.log(e)
  }
}

const addWalletToOrd = async (walletName, networkName) => {
  try {
    let ORD_API_URL;

    if (networkName === 'mainnet')
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === 'testnet')
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    const url = `${ORD_API_URL}/ord/wallet/add_wallet`;
    // eslint-disable-next-line import/no-extraneous-dependencies
    const qip_wallet = (await import('qip-wallet')).default;
    const key = qip_wallet.createPassPhrase().passPhrase;

    const data = {
      walletName,
      keyPhrase: key,
      networkName,
    };
    const result = await axios.post(url, data);
    if (result.data.message !== 'ok') {
      console.log(result.data.message);
    }
    return key;
  } catch (e) {
    console.log(e.message);
  }
};

const utxoDetails = async (walletName, count, amount, networkName) => {
  try {
    const utxoDetails = [];
    let ORD_API_URL;

    if (networkName === 'mainnet')
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === 'testnet')
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;
    const url = `${ORD_API_URL}/ord/create/getMultipleReceiveAddr`;
    const data = {
      collectionName: walletName,
      addrCount: count,
      networkName,
    };
    const result = await axios.post(url, data);
    if (result.data.message !== 'ok') {
      throw new Error(result.data.message);
    }
    const addresses = result.data.userResponse.data;
    for (const address of addresses) {
      const details = { address, value: amount };
      utxoDetails.push(details);
    }

    return utxoDetails;
  } catch (e) {
    console.log(e.message);
  }
};

const verifyAddress = (address, networkName) => {
  try {
    if (networkName === 'mainnet') {
      const chars = address.split('');
      if (chars[0] === '1' || chars[0] === '3') {
        return true;
      }
      if (chars[0] === 'b' && chars[1] === 'c' && chars[2] === '1') {
        return true;
      }
      return false;
    }
    if (networkName === 'testnet') {
      const chars = address.split('');
      if (chars[0] === 'm' || chars[0] === '2' || chars[0] === 'n') {
        return true;
      }
      if (chars[0] === 't' && chars[1] === 'b' && chars[2] === '1') {
        return true;
      }
      return false;
    }
  } catch (e) {
    console.log(e.message);
  }
};

/* eslint-disable prettier/prettier */
const collectionWalletDetails = async (network) => {
  try{
    // eslint-disable-next-line import/no-extraneous-dependencies
    const qip_wallet = (await import('qip-wallet')).default;
    const phrase = qip_wallet.createPassPhrase().passPhrase;
    const keys = qip_wallet.accountKeys({networkName:network, passPhrase:phrase, path: 0})
    const addr = qip_wallet.createAddress({privateKey:keys.privateKey, networkName: network, addressType: 'segwit'})
    return {privateKey: keys.privateKey, wif: keys.wif, address: addr.address}
  }catch(e){
    console.log(e);
  }
}

//
const createTransaction = async ({collAddr, payAddr, creatorAddress, networkName, feeRate, amount, privateKey, wif}) => {
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    const qip_wallet = (await import('qip-wallet')).default;
    const utxo = await getAddressHistory(collAddr, payAddr, networkName);
    let serviceChargeAddress;
    if(networkName === 'mainnet'){
      serviceChargeAddress = process.env.MAINNET_SERVICE_CHARGE_ADDRESS 
    }else{
      serviceChargeAddress = process.env.TESTNET_SERVICE_CHARGE_ADDRESS 
    }

    const addrType = await getAddressType([creatorAddress,serviceChargeAddress], networkName)
    const txSize = qip_wallet.getTransactionSize({input: 1, output: addrType, addressType: 'segwit'});
    const fee = txSize.txBytes * feeRate;
    let available = 0
    const input = utxo.map(x => {
      if(x.status === true) {
        available += x.value
        return { 
          txid: x.txid,
          vout: x.vout,
          value: x.value,
          status: x.status
        }
      }
    })
    if(available - amount - fee < 1000){
      return {
        txHex: '',
        tx: [],
        fee: fee,
        satSpent: 0,
        txSize: txSize
      }
    }
    const output = [{address: creatorAddress, value: amount}, {address: serviceChargeAddress, value: available - amount - fee}]
    let tx;
    if(privateKey){
      tx = await qip_wallet.createTransaction({input: input, output: output, addressType: 'segwit', networkName: networkName, feeRate: feeRate, privateKey: privateKey})
    }else if(wif){
      tx = await qip_wallet.createTransaction({input: input, output: output, addressType: 'segwit', networkName: networkName, feeRate: feeRate, wif: wif})
    }
    return tx;
  } catch (e) {
    console.log(e.message);
  }
};

const getAddressType = async (addresses, network) => {
  try{
    // eslint-disable-next-line import/no-extraneous-dependencies
    const qip_wallet = (await import('qip-wallet')).default;
    const addrTypes = new Map();
    const result = []
    addresses.forEach(x => {
      const addrType = qip_wallet.getAddressType({address: x, networkName: network})
      if(addrTypes.get(addrType) === 0 || addrTypes.get(addrType) === undefined){
        addrTypes.set(addrType, 1)
      }else{
        addrTypes.set(addrType, addrTypes.get(addrType) + 1)
      }
    })
    addrTypes.forEach((value, key) => {
      result.push({
        outputType: key,
        count: value
      })
    })

    return result
  }catch(e){
    console.log(e.message)
  }
}

module.exports = {
  addWalletToOrd,
  utxoDetails,
  verifyAddress,
  collectionWalletDetails,
  createTransaction,
  getAddressType,
  getAddressHistory
};

//createTransaction({collAddr:'tb1q92s4d7f890y80q4nts72hcx8ssvyh44dj037qv', payAddr:'tb1prggvl9lypynpgau59mh93gwk5r27t44a5r6r5c4k5hwgqcejzjwsqkku6x',creatorAddress: 'tb1prggvl9lypynpgau59mh93gwk5r27t44a5r6r5c4k5hwgqcejzjwsqkku6x',networkName:'testnet', feeRate: 65, amount:550, key: '96346ed8a28b9c0dde05604fcb6169df'}).then(x => console.log(x)).catch()
//collectionWalletDetails('testnet').then(x => console.log(x)).catch()
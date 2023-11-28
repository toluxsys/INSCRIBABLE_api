/* eslint-disable prettier/prettier */
const axios = require('axios');
const mempoolJS = require('@mempool/mempool.js');
// eslint-disable-next-line import/no-extraneous-dependencies
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
const createTransaction = async ({collectionAddress, creatorAddress, serviceChargeAddress, network}) => {
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    const qip_wallet = (await import('qip-wallet')).default;
    const utxo = await getAddressHistory(collectionAddress, network);
    const available = utxo.map(x => {
      if(x.status === true) return { 
        txid: x.txid,
        vout: x.vout,
        value: x.value,
        status: x.status
      }
    })
   console.log(available)
    //input
    //output
    //const tx = await qip_wallet.createTransaction()
    console.log('SEND BITCOIN')
  } catch (e) {
    console.log(e);
  }
};

module.exports = {
  addWalletToOrd,
  utxoDetails,
  verifyAddress,
  collectionWalletDetails,
  createTransaction
};

//getAddressHistory('3PMfTPTWWm9vkVGev6uXcVKAWYnnALjnoJ','bc1p5njpw89lxs8sqwvedke5zcupl7gnue0d0204klefy9kp7jp0kltqe4zpus','mainnet').then(x => console.log(x)).catch()
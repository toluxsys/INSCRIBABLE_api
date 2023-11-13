const bitcore = require('bitcore-lib');
const Mnemonic = require('bitcore-mnemonic');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const { PrivateKey, Networks } = bitcore;

const getNetwork = (networkName) => {
  let network;
  if (networkName === 'mainnet') {
    network = Networks.mainnet;
  } else if (networkName === 'testnet') {
    network = Networks.testnet;
  } else {
    throw new Error(`invalid network: ${networkName}, was provided`);
  }
  return network;
};

const createWallet = (networkName) => {
  const network = getNetwork(networkName);
  const privateKey = new PrivateKey();
  const address = privateKey.toAddress(network);
  return {
    privateKey: privateKey.toString(),
    address: address.toString(),
  };
};

const createHDWallet = async (networkName, path) => {
  const network = getNetwork(networkName);
  const passPhrase = new Mnemonic(process.env.MNEMONIC);
  const xpriv = passPhrase
    .toHDPrivateKey(passPhrase.toString(), network)
    .derive(`m/${path}/0/0`);

  return {
    privateKey: xpriv.privateKey.toString(),
    address: xpriv.publicKey.toAddress().toString(),
    xpriv: xpriv.privateKey,
  };
};

const createPayLinkWallet = async (networkName, path) => {
  const network = getNetwork(networkName);
  const passPhrase = new Mnemonic(process.env.PAY_LINK_MNEMONIC);
  const xpriv = passPhrase
    .toHDPrivateKey(passPhrase.toString(), network)
    .derive(`m/${path}/0/0`);

  return {
    privateKey: xpriv.privateKey.toString(),
    address: xpriv.publicKey.toAddress().toString(),
    xpriv: xpriv.privateKey,
  };
};

const createCollectionHDWallet = async (networkName, path) => {
  const network = getNetwork(networkName);
  const passPhrase = new Mnemonic(process.env.COLLECTION_MNEMONIC);
  const xpriv = passPhrase
    .toHDPrivateKey(passPhrase.toString(), network)
    .derive(`m/${path}/0/0`);
  return {
    privateKey: xpriv.privateKey.toString(),
    address: xpriv.publicKey.toAddress().toString(),
    xpriv: xpriv.privateKey,
  };
};

const generateKeyPhrase = async () =>
  new Mnemonic(Mnemonic.Words.ENGLISH).toString();

const addWalletToOrd = async (walletName, networkName) => {
  try {
    let ORD_API_URL;

    if (networkName === 'mainnet')
      ORD_API_URL = process.env.ORD_MAINNET_API_URL;
    if (networkName === 'testnet')
      ORD_API_URL = process.env.ORD_TESTNET_API_URL;

    const url = `${ORD_API_URL}/ord/wallet/add_wallet`;
    const key = await generateKeyPhrase();

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

module.exports = {
  createWallet,
  createHDWallet,
  generateKeyPhrase,
  addWalletToOrd,
  utxoDetails,
  createCollectionHDWallet,
  createPayLinkWallet,
  verifyAddress,
};

// console.log(
//   createHDWallet("testnet", 2)
//     .then((res) => console.log(res))
//     .catch((e) => console.log(e))
// );

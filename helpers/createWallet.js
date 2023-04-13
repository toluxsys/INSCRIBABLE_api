const bitcore = require("bitcore-lib");
const Mnemonic = require("bitcore-mnemonic");
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const { PrivateKey, Networks } = bitcore;

const getNetwork = (networkName) => {
  let network;
  if (networkName === "mainnet") {
    network = Networks.mainnet;
  } else if (networkName === "testnet") {
    network = Networks.testnet;
  } else {
    throw new Error(`invalid network: ${networkName}, was parsed`);
  }
  return network;
};

const createWallet = (networkName) => {
  let network = getNetwork(networkName);
  const privateKey = new PrivateKey();
  const address = privateKey.toAddress(network);
  return {
    privateKey: privateKey.toString(),
    address: address.toString(),
  };
};

const createHDWallet = async (networkName, path) => {
  let network = getNetwork(networkName);
  let passPhrase = new Mnemonic(process.env.MNEMONIC);
  let xpriv = passPhrase
    .toHDPrivateKey(passPhrase.toString(), network)
    .derive(`m/${path}/0/0`);

  return {
    privateKey: xpriv.privateKey.toString(),
    address: xpriv.publicKey.toAddress().toString(),
    xpriv: xpriv.privateKey,
  };
};

const generateKeyPhrase = async () => {
  return new Mnemonic(Mnemonic.Words.ENGLISH).toString();
};

const addWalletToOrd = async (walletName) => {
  try {
    const url = process.env.ORD_API_URL + `/ord/wallet/add_wallet`;
    const key = await generateKeyPhrase();

    const data = {
      walletName: walletName,
      keyPhrase: key,
    };
    const result = await axios.post(url, data);
    if (result.data.message !== "ok") {
      throw new Error(result.data.message);
    }
    return key;
  } catch (e) {
    console.log(e.message);
  }
};

const utxoDetails = async (walletName, count, amount, networkName) => {
  try {
    const testnetAddresses = [
      `mm6cDjXeFU79aRd8bCWY2Us2igf6wD7juk`,
      `mwXxnQvmcXnUtpLA6SyTHVonYrer9sDrfb`,
      `mneYWPrWzvQqepM6us5nZhhXxAoUHaXo7M`,
      `mm6cDjXeFU79aRd8bCWY2Us2igf6wD7juk`,
      `mwXxnQvmcXnUtpLA6SyTHVonYrer9sDrfb`,
      `mneYWPrWzvQqepM6us5nZhhXxAoUHaXo7M`,
    ];
    let utxoDetails = [];

    if (networkName === `mainnet`) {
      const url =
        process.env.ORD_API_URL + `/ord/create/getMultipleReceiveAddr`;
      const data = {
        collectionName: walletName,
        addrCount: count,
      };
      const result = await axios.post(url, data);
      if (result.data.message !== "ok") {
        throw new Error(result.data.message);
      }
      const addresses = result.data.userResponse.data;
      for (const address of addresses) {
        let details = { address: address, value: parseInt(amount * 1e8) };
        utxoDetails.push(details);
        console.log(details);
      }
    } else if (networkName === `testnet`) {
      testnetAddresses.forEach((address) => {
        let details = { address: address, value: parseInt(amount * 1e8) };
        utxoDetails.push(details);
      });
    }

    return utxoDetails;
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
};

// console.log(
//   utxoDetails("se5e484af-6974-4ae5-a5f1-3c92d6366d7e", 1, 200, "mainnet")
//     .then((res) => console.log(res))
//     .catch((e) => console.log(e))
// );

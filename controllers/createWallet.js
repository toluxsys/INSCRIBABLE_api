const bitcore = require("bitcore-lib");
const Mnemonic = require("bitcore-mnemonic");
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
  let passPhrase = new Mnemonic(Mnemonic.Words.ENGLISH);
  let xpriv = passPhrase
    .toHDPrivateKey(passPhrase.toString(), network)
    .derive(`m/${path}/0/0`);

  return {
    privateKey: xpriv.privateKey.toString(),
    address: xpriv.publicKey.toAddress().toString(),
  };
};

module.exports = { createWallet, createHDWallet };

// console.log(createHDWallet("testnet", 1));

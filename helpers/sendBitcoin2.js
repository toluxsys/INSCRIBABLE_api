const {
  initEccLib,
  networks,
  crypto,
  payments,
  Psbt,
  address,
} = require("bitcoinjs-lib");
const tinysecp = require("tiny-secp256k1");
const { ECPairFactory } = require("ecpair");
const {
  createHDWallet,
  createCollectionHDWallet,
  createPayLinkWallet,
} = require("./createWallet");
const mempoolJS = require("@mempool/mempool.js");
const dotenv = require("dotenv");
const { default: axios } = require("axios");

initEccLib(tinysecp);
const ECPair = ECPairFactory(tinysecp);

const init = async (network) => {
  const {
    bitcoin: { addresses, fees, transactions },
  } = mempoolJS({
    hostname: "mempool.space",
    network: network,
  });

  return { addresses, fees, transactions };
};

const getNetwork = (networkName) => {
  if (networkName === "mainnet") {
    return networks.bitcoin;
  } else if (networkName === "testnet") {
    return networks.testnet;
  }
};

const getKeyPair = async (networkName, path) => {
  const wallet = await createHDWallet(networkName, path);
  const privateKey = wallet.privateKey;
  const p_key = privateKey.slice(0, 32);
  const network = getNetwork(networkName);
  return ECPair.fromPrivateKey(Buffer.from(p_key), {
    network,
  });
};

const getPayLinkKeyPair = async (networkName, path) => {
  const wallet = await createPayLinkWallet(networkName, path);
  const privateKey = wallet.privateKey;
  const p_key = privateKey.slice(0, 32);
  const network = getNetwork(networkName);
  return ECPair.fromPrivateKey(Buffer.from(p_key), {
    network,
  });
};

const getCollectionKeyPair = async (networkName, path, index) => {
  const wallet = await createCollectionHDWallet(networkName, path, index);
  const privateKey = wallet.privateKey;
  const p_key = privateKey.slice(0, 32);
  const network = getNetwork(networkName);
  return ECPair.fromPrivateKey(Buffer.from(p_key), {
    network,
  });
};

const createLegacyAddress = async (networkName, path) => {
  try {
    const network = getNetwork(networkName);
    const keyPair = await getKeyPair(networkName, path);
    const p2pkh = payments.p2pkh({
      pubkey: keyPair.publicKey,
      network,
    });
    const p2pkh_addr = p2pkh.address ?? "";
    const script = p2pkh.output;
    return { p2pkh_addr, script };
  } catch (e) {
    console.log(e);
  }
};

const createLegacyPayLinkAddress = async (networkName, path) => {
  try {
    const network = getNetwork(networkName);
    const keyPair = await getPayLinkKeyPair(networkName, path);
    const p2pkh = payments.p2pkh({
      pubkey: keyPair.publicKey,
      network,
    });
    const p2pkh_addr = p2pkh.address ?? "";
    const script = p2pkh.output;
    return { p2pkh_addr: p2pkh_addr, script: script };
  } catch (e) {
    console.log(e);
  }
};

const createCollectionLegacyAddress = async (networkName, path, index) => {
  try {
    const network = getNetwork(networkName);
    const keyPair = await getCollectionKeyPair(networkName, path, index);
    const p2pkh = payments.p2pkh({
      pubkey: keyPair.publicKey,
      network,
    });
    const p2pkh_addr = p2pkh.address ?? "";
    const script = p2pkh.output;
    return { p2pkh_addr, script };
  } catch (e) {
    console.log(e);
  }
};

const createTaprootAddress = async (networkName, path) => {
  try {
    const network = getNetwork(networkName);
    const keyPair = await getKeyPair(networkName, path);
    const tweakedSigner = tweakSigner(keyPair, { network });
    const p2pktr = payments.p2tr({
      pubkey: toXOnly(tweakedSigner.publicKey),
      network,
    });
    const p2pktr_addr = p2pktr.address ?? "";
    const script = p2pktr.output;
    return { p2pktr_addr, script };
  } catch (e) {
    console.log(e);
  }
};

const getRecomendedFee = async (network) => {
  try {
    const fees = (await init(network)).fees;
    const feesRecommended = await fees.getFeesRecommended();
    return feesRecommended;
  } catch (e) {
    throw new Error(e.message);
  }
};

const getWalletBalance = async (address, network) => {
  try {
    const { addresses } = await init(network);
    const response = await addresses.getAddressTxsUtxo({ address });

    let totalAmountAvailable = 0;
    let utxos = response;

    for (const element of utxos) {
      totalAmountAvailable += element.value;
      console.log(`Balance:`, element);
    }

    return { totalAmountAvailable, utxos };
  } catch (e) {
    console.log(e.message);
  }
};

const checkAddress = async (address, network) => {
  try {
    const { addresses } = await init(network);
    const response = await addresses.getAddressTxsUtxo({ address });
    console.log(response);

    let totalAmountAvailable = 0;
    let utxos = response;

    for (const element of utxos) {
      totalAmountAvailable += element.value;
    }

    return { totalAmountAvailable, utxos };
  } catch (e) {
    console.log(e);
    throw new Error(e.message);
  }
};

const sendBitcoin = async (networkName, path, receiverDetails, type) => {
  try {
    const network = getNetwork(networkName);
    let serviceChargeAddress;
    let broadcastLink;
    let addressDetails;
    let fee = 0;
    let change;
    let keyPair;

    if (networkName === "testnet") {
      serviceChargeAddress = process.env.TESTNET_SERVICE_CHARGE_ADDRESS;
      broadcastLink = process.env.TESTNET_BROADCAST_LINK;
    } else if (networkName === "mainnet") {
      serviceChargeAddress = process.env.MAINNET_SERVICE_CHARGE_ADDRESS;
      broadcastLink = process.env.MAINNET_BROADCASST_LINK;
    }

    if (type === "payLink") {
      addressDetails = await createLegacyPayLinkAddress(networkName, path);
      fee = 5000;
      keyPair = await getPayLinkKeyPair(networkName, path);
    }
    keyPair = await getKeyPair(networkName, path);
    addressDetails = await createLegacyAddress(networkName, path);
    fee = process.env.FEE;

    let inputCount = 0;
    let available = await getWalletBalance(
      addressDetails.p2pkh_addr,
      networkName
    );
    let inputs = [];
    let outputs = [];
    let details = receiverDetails;
    let utxos = available.utxos;
    let totalAmountAvailable = available.totalAmountAvailable;

    for (const element of utxos) {
      let utxo = {};
      let txId = element.txid;
      let result;
      utxo.hash = txId;
      utxo.index = element.vout;
      if (networkName === "testnet") {
        result = await axios.get(
          `https://mempool.space/${networkName}/api/tx/${utxo.hash}/hex`
        );
        utxo.nonWitnessUtxo = new Buffer.from(result.data, "hex");
        inputCount += 1;
        inputs.push(utxo);
      } else {
        result = await axios.get(
          `https://mempool.space/api/tx/${utxo.hash}/hex`
        );
        utxo.nonWitnessUtxo = new Buffer.from(result.data, "hex");
        inputCount += 1;
        inputs.push(utxo);
      }
    }

    let amount = 0;
    for (const details of receiverDetails) {
      amount = amount + details.value;
    }

    let changeAmount = totalAmountAvailable - amount - process.env.FEE;
    if (changeAmount > 0) {
      change = {
        address: serviceChargeAddress,
        value: changeAmount,
      };
      details.push(change);
    }

    for (const detail of details) {
      const addr = address.toOutputScript(detail.address, network);
      outputs.push({
        address: details.address,
        value: detail.value,
        script: addr,
      });
    }

    console.log(keyPair);

    const psbt = new Psbt({ network })
      .addInputs(inputs)
      .addOutputs(outputs)
      .signAllInputs(keyPair)
      .finalizeAllInputs();
    const txs = psbt.extractTransaction();
    const tx = txs.toHex();
    console.log(tx);
    return { link: broadcastLink, rawTx: tx };
  } catch (e) {
    console.log(e);
  }
};

const sendCollectionBitcoin = async (
  networkName,
  path,
  index,
  receiverDetails
) => {
  try {
    const network = getNetwork(networkName);
    let serviceChargeAddress;
    let broadcastLink;

    if (networkName === "testnet") {
      serviceChargeAddress = process.env.TESTNET_SERVICE_CHARGE_ADDRESS;
    } else if (networkName === "mainnet") {
      serviceChargeAddress = process.env.MAINNET_SERVICE_CHARGE_ADDRESS;
    }

    if (networkName === "testnet") {
      broadcastLink = process.env.TESTNET_BROADCAST_LINK;
    } else if (networkName === "mainnet") {
      broadcastLink = process.env.MAINNET_BROADCASST_LINK;
    }

    const addressDetails = await createCollectionLegacyAddress(
      networkName,
      path,
      index
    );
    let fee = 0;
    let inputCount = 0;
    let outputCount = receiverDetails.length + 1;
    let available = await getWalletBalance(
      addressDetails.p2pkh_addr,
      networkName
    );

    let recommendedFee = await getRecomendedFee();
    let inputs = [];
    let outputs = [];
    let details = receiverDetails;
    let utxos = available.utxos;
    let totalAmountAvailable = available.totalAmountAvailable;

    console.log(available);

    for (const element of utxos) {
      let utxo = {};
      let txId = element.txid;
      utxo.hash = txId;
      utxo.index = element.vout;
      const result = await axios.get(
        `https://mempool.space/${networkName}/api/tx/${txId}/hex`
      );
      utxo.nonWitnessUtxo = Buffer.from(result.data, "hex");
      inputCount += 1;
      inputs.push(utxo);
    }

    let amount = 0;
    for (const details of receiverDetails) {
      amount = amount + details.value;
    }

    const transactionSize =
      inputCount * 180 + outputCount * 34 + 10 - inputCount;

    fee = transactionSize * recommendedFee.halfHourFee;

    let changeAmount = totalAmountAvailable - amount - fee;

    const change = {
      address: serviceChargeAddress,
      value: changeAmount,
    };

    details.push(change);
    console.log(details);

    for (const detail of details) {
      const addr = address.toOutputScript(detail.address, network);
      outputs.push({
        address: details.address,
        value: detail.value,
        script: addr,
      });
    }

    const keyPair = await getCollectionKeyPair(networkName, path, index);
    const psbt = new Psbt({ network })
      .addInputs(inputs)
      .addOutputs(outputs)
      .signAllInputs(keyPair)
      .finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const txHex = tx.toHex();
    return { link: broadcastLink, rawTx: txHex };
  } catch (e) {
    console.log(e);
  }
};

function tweakSigner(signer, opts) {
  let privateKey = signer.privateKey;
  if (!privateKey) {
    throw new Error("Private key is required for tweaking signer!");
  }
  if (signer.publicKey[0] === 3) {
    privateKey = tinysecp.privateNegate(privateKey);
  }

  const tweakedPrivateKey = tinysecp.privateAdd(
    privateKey,
    tapTweakHash(toXOnly(signer.publicKey), opts.tweakHash)
  );
  if (!tweakedPrivateKey) {
    throw new Error("Invalid tweaked private key!");
  }

  return ECPair.fromPrivateKey(Buffer.from(tweakedPrivateKey), {
    network: opts.network,
  });
}

function tapTweakHash(pubKey, h) {
  return crypto.taggedHash(
    "TapTweak",
    Buffer.concat(h ? [pubKey, h] : [pubKey])
  );
}

function toXOnly(pubkey) {
  return pubkey.subarray(1, 33);
}

module.exports = {
  sendBitcoin,
  sendCollectionBitcoin,
  createLegacyAddress,
  createTaprootAddress,
  createCollectionLegacyAddress,
  createLegacyPayLinkAddress,
};

// console.log(
//   createLegacyAddress(`testnet`, 0)
//     .then((res) => console.log(res))
//     .catch((e) => {
//       console.log(e);
//     })
// );

// console.log(
//   sendBitcoin(`testnet`, 0, [
//     {
//       address: "mo59c7kZ7iEVpv9Abi2wQma5hbBCbZQsxG",
//       value: 1000,
//     },
//   ])
//     .then((res) => {
//       console.log(res);
//     })
//     .catch((e) => {
//       console.log(e);
//     })
// );

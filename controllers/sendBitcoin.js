const axios = require("axios");
const bitcore = require("bitcore-lib");
const mempoolJS = require("@mempool/mempool.js");
const dotenv = require("dotenv");
dotenv.config();

const { createHDWallet } = require("./createWallet.js");

const init = async (network) => {
  const {
    bitcoin: { addresses, fees, transactions },
  } = mempoolJS({
    hostname: "mempool.space",
    network: network,
  });

  return { addresses, fees, transactions };
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
      console.log(element);
    }

    return totalAmountAvailable;
  } catch (e) {
    throw new Error(e.message);
  }
};

const chechAddress = async (address, network) => {
  try {
    const { addresses } = await init(network);
    const response = await addresses.getAddressTxsUtxo({ address });

    let totalAmountAvailable = 0;
    let utxos = response;

    for (const element of utxos) {
      totalAmountAvailable += element.value;
    }

    return { totalAmountAvailable, utxos };
  } catch (e) {
    throw new Error(e.message);
  }
};

const sendBitcoin = async (payAddressId, recieverAddress, network, amount) => {
  //const { transactions } = await init(network);
  try {
    let serviceChargeAddress;
    let broadcastLink;

    if (network === "testnet") {
      serviceChargeAddress = process.env.TESTNET_SERVICE_CHARGE_ADDRESS;
    } else if (network === "mainnet") {
      serviceChargeAddress = process.env.MAINNET_SERVICE_CHARGE_ADDRESS;
    }

    if (network === "testnet") {
      broadcastLink = process.env.TESTNET_BROADCAST_LINK;
    } else if (network === "mainnet") {
      broadcastLink = process.env.MAINNET_BROADCASST_LINK;
    }

    const addressDetails = await createHDWallet(network, payAddressId);
    const sourceAddress = await addressDetails.address;
    let fee = 0;
    let inputCount = 0;
    let outputCount = 2;

    const recommendedFee = await getRecomendedFee();
    const transaction = new bitcore.Transaction();
    let totalAmountAvailable = 0;

    let input = [];
    const unSpent = await axios.get(
      `https://mempool.space/${network}/api/address/${sourceAddress}/utxo`
    );

    let utxos = unSpent.data;

    for (const element of utxos) {
      let utxo = {};
      utxo.satoshis = element.value;
      utxo.address = bitcore.Address.fromString(sourceAddress);
      utxo.txId = element.txid;
      utxo.vout = element.vout;
      utxo.script = bitcore.Script.buildPublicKeyHashOut(sourceAddress);
      totalAmountAvailable += element.value;
      inputCount += 1;
      input.push(utxo);
    }

    const transactionSize =
      inputCount * 180 + outputCount * 34 + 10 - inputCount;

    fee = transactionSize * recommendedFee.hourFee; // satoshi per byte
    if (totalAmountAvailable - amount - fee < 0) {
      throw new Error("Balance is too low for this transaction");
    }
    //Set transaction input
    transaction.from(input);
    // set the recieving address and the amount to send
    transaction.to(bitcore.Address.fromString(recieverAddress), amount);
    // Set change address - Address to receive the left over funds after transfer
    transaction.change(bitcore.Address.fromString(serviceChargeAddress));
    //manually set transaction fees: 20 satoshis per byte
    transaction.fee(fee);
    // Sign transaction with your private key
    transaction.sign(await addressDetails.privateKey);
    //serialize Transactions
    const txHex = transaction.serialize({ disableDustOutputs: true });

    //const txId = await transactions.postTx({ txHex });

    return { link: broadcastLink, rawTx: txHex };
  } catch (e) {
    throw new Error(e);
  }
};

module.exports = {
  getRecomendedFee,
  getWalletBalance,
  chechAddress,
  sendBitcoin,
};

// const start = async () => {
//   const { transactions } = await init();
//   // console.log(
//   //   await chechAddress("mneYWPrWzvQqepM6us5nZhhXxAoUHaXo7M", "testnet")
//   // );

//   console.log(
//     await sendBitcoin(0, "mneYWPrWzvQqepM6us5nZhhXxAoUHaXo7M", "testnet", 100)
//   );
// };

// start();

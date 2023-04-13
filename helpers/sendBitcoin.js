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
      console.log(`Balance:`, element);
    }

    return totalAmountAvailable;
  } catch (e) {
    console.log(e.message);
  }
};

const checkAddress = async (address, network) => {
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

const createTransaction = async (
  input,
  recieverDetails,
  changeAddr,
  fee,
  privateKey
) => {
  try {
    const transaction = new bitcore.Transaction();
    recieverDetails.forEach((element) => {
      transaction.to(
        bitcore.Address.fromString(element.address),
        element.amount
      );
    });
    transaction.from(input);
    transaction.change(bitcore.Address.fromString(changeAddr));
    transaction.fee(fee);
    transaction.sign(privateKey);
    const txHex = transaction.serialize({ disableDustOutputs: true });
    return txHex;
  } catch (e) {
    console.log(e);
  }
};

const sendBitcoin = async (payAddressId, recieverDetails, network) => {
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
    let outputCount = recieverDetails.length + 1;
    let amount = 0;
    let available = await checkAddress(sourceAddress, network);
    let recommendedFee = await getRecomendedFee();
    let input = [];
    let utxos = available.utxos;
    let totalAmountAvailable = available.totalAmountAvailable;

    for (const element of utxos) {
      let utxo = {};
      utxo.satoshis = element.value;
      utxo.address = bitcore.Address.fromString(sourceAddress);
      utxo.txId = element.txid;
      utxo.vout = element.vout;
      utxo.script = bitcore.Script.buildPublicKeyHashOut(sourceAddress);
      inputCount += 1;
      input.push(utxo);
    }

    for (const details of recieverDetails) {
      amount += details.amount;
    }

    const transactionSize =
      inputCount * 180 + outputCount * 34 + 10 - inputCount;

    fee = transactionSize * recommendedFee.halfHourFee;
    console.log("fee", fee);
    console.log("total Available", totalAmountAvailable);

    if (totalAmountAvailable - amount - fee === 0) {
      throw new Error("Balance is too low for this transaction");
    }

    const txHex = await createTransaction(
      input,
      recieverDetails,
      serviceChargeAddress,
      fee,
      addressDetails.privateKey
    );

    return { link: broadcastLink, rawTx: txHex };
  } catch (e) {
    throw new Error(e.message);
  }
};

module.exports = {
  getRecomendedFee,
  getWalletBalance,
  checkAddress,
  sendBitcoin,
};

// const start = async () => {
//   // const { transactions } = await init();
//   // const available = await chechAddress(
//   //   "msgfzF5z2K9xtAbtFoiYwEaStZCnS3TXJy",
//   //   "testnet"
//   // );
//   // console.log(available.utxos[0].status.confirmed);
//   // console.log(available.totalAmountAvailable);

//   const details = [
//     {
//       address: `bc1qv45cdwvj5kxn0y4kkudl50hnycas8n8379tulc`,
//       amount: 13000,
//     },
//   ];

//   console.log(await sendBitcoin(35, details, "mainnet"));

//   //console.log(await getRecomendedFee());
// };

// start();

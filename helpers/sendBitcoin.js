/* eslint-disable prettier/prettier */
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

const getRecomendedFee = async (network) => {
  try {
    const { fees } = await init(network);
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
    let status = [];
    const txid = [];

    let totalAmountAvailable = 0;
    const utxos = response;

    for (const element of utxos) {
      totalAmountAvailable += element.value;
      if (!element.status) {
        status = [];
      } else {
        status.push(element.status);
        txid.push(`${element.txid}:${element.vout}`);
      }
    }

    return { totalAmountAvailable, status, txid };
  } catch (e) {
    console.log(e.message);
  }
};

const checkAddress = async (address, network) => {
  try {
    const { addresses } = await init(network);
    const response = await addresses.getAddressTxsUtxo({ address });

    let totalAmountAvailable = 0;
    const utxos = response;

    for (const element of utxos) {
      totalAmountAvailable += element.value;
    }

    return { totalAmountAvailable, utxos };
  } catch (e) {
    throw new Error(e.message);
  }
};

const getSpendUtxo = async (address, network) => {
  try {
    const { addresses } = await init(network);
    const response = await addresses.getAddressTxsUtxo({ address });
    const utxos = response;
    const outputs = [];

    if (utxos.length === 0) {
      return { message: 'no available spend utxo in address', output: [] };
    }

    for (const element of utxos) {
      const output = `${element.txid}:${element.vout}`;
      outputs.push(output);
    }

    return { message: 'okay', output: outputs[0] };
  } catch (e) {
    throw new Error(e.message);
  }
};

module.exports = {
  getRecomendedFee,
  getWalletBalance,
  checkAddress,
  getSpendUtxo,
};
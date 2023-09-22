const dotenv = require("dotenv").config();
const axios = require("axios");

const apiUrl = process.env.COINGECKO_API_URL;

const btcToUsd = async (btcAmount) => {
  try {
    const response = await axios.get(
      `${apiUrl}/simple/price?ids=bitcoin&vs_currencies=usd`
    );
    const btcToUsdExchangeRate = response.data.bitcoin.usd;

    const usdEquivalent = parseFloat(
      (btcAmount * btcToUsdExchangeRate).toFixed(2)
    );

    return usdEquivalent;
  } catch (err) {
    console.error(`Error fetching BTC to USD exchange rate: ${err}`);
    throw err;
  }
};

const usdToSat = async (usdAmount) => {
  try {
    const response = await axios.get(
      `${apiUrl}/simple/price?ids=bitcoin&vs_currencies=usd`
    );
    const btcToUsdExchangeRate = response.data.bitcoin.usd;
    const btcEquivalent = parseFloat((usdAmount/btcToUsdExchangeRate).toFixed(8))
    return {satoshi: parseInt(btcEquivalent * 1e8), btc: btcEquivalent}
  } catch (err) {
    console.error(`Error fetching BTC to USD exchange rate: ${err}`);
    throw err;
  }
};

module.exports = { btcToUsd , usdToSat};

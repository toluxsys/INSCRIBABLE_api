const dotenv = require('dotenv').config();
const axios = require('axios');
const BtcPrice = require('../model/btcPrice');

const apiUrl = process.env.COINGECKO_API_URL;

const btcToUsd = async (btcAmount) => {
  try {
    let btcToUsdExchangeRate = 0;
    const btc = await BtcPrice.find({});
    if (!btc) {
      btcToUsdExchangeRate = await updateBtcPrice();
    } else {
      btcToUsdExchangeRate = btc[0].value;
    }
    if (typeof btcToUsdExchangeRate === 'string') return 0;
    const usdEquivalent = parseFloat(
      (btcAmount * btcToUsdExchangeRate).toFixed(2),
    );
    return usdEquivalent;
  } catch (err) {
    console.error(`Error fetching BTC to USD exchange rate: ${err}`);
  }
};

const usdToSat = async (usdAmount) => {
  try {
    let btcToUsdExchangeRate = 0;
    const btc = await BtcPrice.find({});
    if (!btc) {
      btcToUsdExchangeRate = await updateBtcPrice();
    } else {
      btcToUsdExchangeRate = btc[0].value;
    }
    if (typeof btcToUsdExchangeRate === 'string') return { satoshi: 0, btc: 0 };
    const btcEquivalent = parseFloat(
      (usdAmount / btcToUsdExchangeRate).toFixed(8),
    );
    return { satoshi: parseInt(btcEquivalent * 1e8), btc: btcEquivalent };
  } catch (err) {
    console.error(`Error fetching USD to BTC exchange rate: ${err}`);
  }
};

const updateBtcPrice = async () => {
  try {
    const response = await axios.get(
      `${apiUrl}/simple/price?ids=bitcoin&vs_currencies=usd`,
    );
    const value = response.data.bitcoin.usd;
    if (value == undefined) return 'value is undefined';
    const btc = await BtcPrice.find({});
    if (btc.length === 0) {
      const saved = new BtcPrice({
        value,
      });
      await saved.save();
    } else {
      await BtcPrice.findOneAndUpdate(
        { _id: btc[0]._id },
        { $set: { value } },
        { new: true },
      );
    }
    return value;
  } catch (e) {
    console.log(e.message);
  }
};

module.exports = { btcToUsd, usdToSat, updateBtcPrice };

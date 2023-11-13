const axios = require('axios');

const verifyName = async (name) => {
  try {
    const url = `https://api.sats.id/names/${name}`;
    const response = await axios.get(url);
    console.log(response);
    if (response.data.name === name) {
      return false;
    }
  } catch (err) {}
};

module.exports = verifyName;

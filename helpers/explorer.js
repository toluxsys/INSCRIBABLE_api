/* eslint-disable no-shadow */
/* eslint-disable camelcase */
const axios = require('axios');
const dotenv = require('dotenv').config();

const ordApiUrl = 'https://ordapi.xyz/';
const contentUrl = 'https://ordapi.xyz/content/';
const previewUrl = 'https://ordapi.xyz/preview/';
const protocols = ['brc-20', 'BRC-20', 'sns', 'SNS', 'brc-1155', 'BRC-1155'];

const getJsonInscription = async (start, stop, limit) => {
  try {
    const feedPath = `${ordApiUrl}inscriptions/?start=${start}&end=${stop}&limit=${limit}`;
    const response = await axios.get(feedPath);
    const { data } = response;
    const result = [];
    await Promise.all(
      data.map(async (e) => {
        if (e.content_type.split('/')[0] === 'text') {
          const id = e.content.split('/')[2];
          const contentPath = contentUrl + id;
          const s_response = await axios.get(contentPath);
          const s_data = s_response.data;
          if (typeof s_data === 'object' && protocols.includes(s_data.p)) {
            const r_data = {
              inscription: id,
              protocol: s_data.p,
            };
            result.push(r_data);
          }
        }
      }),
    );
    return result;
  } catch (e) {
    console.log(e.message);
    throw e.message;
  }
};

const isValidBrc1155 = async (id) => {
  try {
    const contentPath = contentUrl + id;
    const s_response = await axios.get(contentPath);
    const s_data = s_response.data;
    let result;
    if (typeof s_data === 'object' && s_data.p === 'brc-1155') {
      const contentUrl = s_data.content;
      if (
        contentUrl.split(':')[1] !== process.env.IPFS_IMAGE_URL.split(':')[1]
      ) {
        result = false;
      } else {
        result = true;
      }
    } else {
      result = false;
    }

    return result;
  } catch (e) {
    console.log(e.message);
    throw e.message;
  }
};

const getInscriptionContent = async (id) => {
  try {
    const contentPath = contentUrl + id;
    const s_response = await axios.get(contentPath);
    const s_data = s_response.data;
    let s_contentUrl;
    if (typeof s_data === 'object' && s_data.p === 'brc-1155') {
      s_contentUrl = s_data.content;
    } else {
      s_contentUrl = contentUrl + id;
    }
    return s_contentUrl;
  } catch (e) {
    console.log(e.message);
    throw e.message;
  }
};

const previewInscriptionContent = async (id) => {
  try {
    const contentPath = contentUrl + id;
    const s_response = await axios.get(contentPath);
    const s_data = s_response.data;
    let s_previewUrl;
    if (typeof s_data === 'object' && s_data.p === 'brc-1155') {
      s_previewUrl = s_data.content;
    } else {
      s_previewUrl = previewUrl + id;
    }
    return s_previewUrl;
  } catch (e) {
    console.log(e.message);
    throw e.message;
  }
};

const getInscriptionFeed = async () => {
  try {
    const latestInscription = [];
    const feedPath = `${ordApiUrl}feed`;
    const s_response = await axios.get(feedPath);
    const feed = s_response.data.rss.channel.item;
    await Promise.all(
      feed.map(async (e) => {
        const id = e.guid.split('/inscription/')[1];
        const { title } = e;

        const data = {
          inscriptionId: id,
          title,
          previewUrl: `ord.io/preview/${id}`,
        };
        latestInscription.push(data);
      }),
    );
    return latestInscription;
  } catch (e) {
    console.log(e.message);
  }
};

const getInscriptionById = async (id) => {
  try {
    const s_result = await axios.get(`${ordApiUrl}inscription/${id}`);
    const { data } = s_result;
    const s_data = {
      address: data.address,
      content: data.content,
      contentType: data.content_type,
      contentLength: data.content_length,
      genesisFee: data.genesis_fee,
      genesisHeight: data.genesis_height,
      id: data.id,
      inscriptionNumber: data.inscription_number,
      preview: await previewInscriptionContent(data.id),
      sat: data.sat,
      timestamp: data.timestamp,
      title: data.title,
    };
    return s_data;
  } catch (e) {
    console.log(e.message);
  }
};

const getInscriptionByAddress = async (address) => {
  try {
    const s_result = await axios.get(`${ordApiUrl}address/${address}`);
    const { data } = s_result;
    const inscriptions = [];
    await Promise.all(
      data.map(async (e) => {
        const s_data = {
          address,
          content: e.content,
          contentType: e.content_type,
          contentLength: e.content_length,
          genesisFee: e.genesis_fee,
          genesisHeight: e.genesis_height,
          id: e.id,
          inscriptionNumber: e.inscription_number,
          // preview: await previewInscriptionContent(e.id),
          sat: e.sat,
          timestamp: e.timestamp,
          title: e.title,
        };
        inscriptions.push(s_data);
      }),
    );
    return inscriptions;
  } catch (e) {
    console.log(e.message);
  }
};

const getInscriptionByNumber = async (inscriptionNumber) => {
  try {
    const feedPath = `${ordApiUrl}inscriptions/?start=${inscriptionNumber}&end=${
      inscriptionNumber + 100
    }&limit=${1}`;
    const s_result = await axios.get(feedPath);
    const { data } = s_result;
    const inscriptions = [];
    await Promise.all(
      data.map(async (e) => {
        const s_data = {
          address: e.address,
          content: e.content,
          contentType: e.content_type,
          contentLength: e.content_length,
          genesisFee: e.genesis_fee,
          genesisHeight: e.genesis_height,
          id: e.id,
          inscriptionNumber: e.inscription_number,
          preview: await previewInscriptionContent(e.id),
          sat: e.sat,
          timestamp: e.timestamp,
          title: e.title,
        };

        console.log(s_data);
        inscriptions.push(s_data);
      }),
    );
    return inscriptions;
  } catch (e) {
    console.log(e.message);
  }
};

module.exports = {
  getJsonInscription,
  isValidBrc1155,
  previewInscriptionContent,
  getInscriptionContent,
  getInscriptionFeed,
  getInscriptionById,
  getInscriptionByAddress,
  getInscriptionByNumber,
};

// getInscriptionByNumber(998000).then((res) => {
//     console.log(res);
//   })
//   .catch((err) => {
//     console.error(err);
//   });

// getJsonInscription(2000000, 3000000, 1000)
//   .then((res) => {
//     console.log(res);
//   })
//   .catch((err) => {
//     console.error(err);
//   });

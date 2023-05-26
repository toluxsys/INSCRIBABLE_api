const axios = require("axios");
const { response } = require("express");
const dotenv = require("dotenv").config();
const ordApiUrl = "https://ordapi.xyz/";
const contentUrl = "https://ordapi.xyz/content/";
const previewUrl = "https://ordapi.xyz/preview/"
const protocols = ["brc-20", "BRC-20", "sns", "SNS", "brc-1155", "BRC-1155"];

const getJsonInscription = async (start, stop, limit) => {
    try {
      const feedPath = ordApiUrl + `inscriptions/?start=${start}&end=${stop}&limit=${limit}`;
      const response = await axios.get(feedPath);
      const data = response.data;
      const result = [];
      await Promise.all(
        data.map(async (e) => {
            if (e.content_type.split("/")[0] === "text") {
                    const id = e.content.split("/")[2];
                    const contentPath = contentUrl + id;
                    const s_response = await axios.get(contentPath);
                    const s_data = s_response.data;
                    if (typeof s_data === "object" && protocols.includes(s_data.p)) {
                    const r_data = {
                        inscription: id,
                        protocol: s_data.p,
                        content: s_data,
                    };
                    result.push(r_data);
                    }
                }
            })
        );
      return result;
    } catch (e) {
      console.log(e.message);
      throw e.message;
    }
  };

const isValidBrc721 = async (id) => {
  try {
    const contentPath = contentUrl + id;
    const s_response = await axios.get(contentPath);
    const s_data = s_response.data;
    let result;
    if (typeof s_data === "object" && s_data.p === "brc-721"){
      let contentUrl = s_data.content;
      if(contentUrl.split(":")[1] !== process.env.IPFS_IMAGE_URL.split(":")[1]) {
        result = false;
      }else{ 
        result = true;
      };
    }else{
      result = false;
    }

    return result;
  } catch(e) {
    console.log(e.message);
    throw e.message;
  }
}

const getInscriptionContent = async (id) => {
  try {
    const contentPath = contentUrl + id;
    const s_response = await axios.get(contentPath);
    const s_data = s_response.data;
    let s_contentUrl;
    if (typeof s_data === "object" && s_data.p === "brc-721"){
      s_contentUrl = s_data.content;
    }else{
      s_contentUrl = contentUrl + id;
    }

    return s_contentUrl;
  } catch(e) {
    console.log(e.message);
    throw e.message;
  }
} 

const previewInscriptionContent = async (id) => {
  try {
    const contentPath = contentUrl + id;
    const s_response = await axios.get(contentPath);
    const s_data = s_response.data;
    let s_previewUrl;
    if (typeof s_data === "object" && s_data.p === "brc-721"){
      s_previewUrl = s_data.content;
    }else{
      s_previewUrl = previewUrl + id;
    }
    return s_previewUrl;
  } catch(e) {
    console.log(e.message);
    throw e.message;
  }
} 



  module.exports = { getJsonInscription, isValidBrc721, previewInscriptionContent };
  
  // isValidBrc721("65db5cdf0863ce3d6536394ed01859650ffc9fab166e76d4ee2fb7ff48cf6d93i0").then((res) => {
  //   console.log(res);
  // })
  // .catch((err) => {
  //   console.error(err);
  // });
  
  // getJsonInscription(2000000, 5000000, 1000)
  //   .then((res) => {
  //     console.log(res);
  //   })
  //   .catch((err) => {
  //     console.error(err);
  //   });
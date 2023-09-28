const { compress } = require("compress-images/promise");
const { Web3Storage, getFilesFromPath } = require("web3.storage");
const { sort } = require("./sort");
const fs = require("fs");
const {Blob} = require("buffer")
const { cwd } = require("process");
const dotenv = require("dotenv").config();
const aws = require("aws-sdk");
const { collection } = require("../model/inscription");
require('aws-sdk/lib/maintenance_mode_message').suppress = true;

aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.S3_BUCKET_REGION,
});

const uploadToS3 = async (fileName, fileBuffer) => {
  let s3bucket = new aws.S3({
    ACL :'public-read',
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    Bucket: process.env.S3_BUCKET_NAME,
  });
  const uploadParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
    Body: fileBuffer,
  };

  return new Promise((resolve, reject) => {
    s3bucket.createBucket(() => {
      s3bucket.upload(uploadParams, (err, data) => {
        if (err) {
          reject(new Error("Error occurred while trying to upload to S3 bucket", err));
        } else {
          resolve(data);
        }
      });
    });
  });
}

const uploadToS3Bulk = async (params) => {
  try{let s3bucket = new aws.S3({
    ACL :'public-read',
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    Bucket: process.env.S3_BUCKET_NAME,
  });
 
  const responses = await Promise.all(
      params.map(param => s3bucket.upload(param).promise())
  )

  return responses;
}catch(e){
  console.log(e)
}
}

const downloadFromS3 = async (fileName, inscriptionId) => {
  try{let s3bucket = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    Bucket: process.env.S3_BUCKET_NAME,
  });

  const downloadParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
  };

  if(!fs.existsSync(process.cwd()+`/src/bulk/${inscriptionId}`)){
    fs.mkdirSync(process.cwd()+`/src/bulk/${inscriptionId}`, { recursive: true }, (err) => {
      console.log(err);
    });
  }

 const file = fs.createWriteStream(process.cwd()+`/src/bulk/${inscriptionId}/${fileName}`);
 await new Promise((resolve, reject) => {
    s3bucket.getObject(downloadParams).createReadStream()
    .pipe(file)
    .on('finish', resolve)
    .on('error', reject)
  });
  return true;
}catch(error){
  console.error('Error occurred during file downloads:', error.message);
    return false;
 }
};

const downloadAddressFile = async (fileName, collectionId) => {
  try{let s3bucket = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    Bucket: process.env.S3_BUCKET_NAME,
    region: process.env.S3_BUCKET_REGION,
  });

  const downloadParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
  };

  if(!fs.existsSync(process.cwd()+`/src/address/${collectionId}`)){
    fs.mkdirSync(process.cwd()+`/src/address/${collectionId}`, { recursive: true }, (err) => {
      console.log(err);
    });
  }

 const file = fs.createWriteStream(process.cwd()+`/src/address/${collectionId}/${fileName}`);
 await new Promise((resolve, reject) => {
    s3bucket.getObject(downloadParams).createReadStream()
    .pipe(file)
    .on('finish', resolve)
    .on('error', reject)
  });
  return true;
}catch(error){
  console.error('Error occurred during file downloads:', error.message);
    return false;
 }
};

const downloadAllAddressFile = async (params, collectionId) => {
  try{let s3bucket = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    Bucket: process.env.S3_BUCKET_NAME,
    region: process.env.S3_BUCKET_REGION,
  });

  if(!fs.existsSync(process.cwd()+`/src/address/${collectionId}`)){
    fs.mkdirSync(process.cwd()+`/src/address/${collectionId}`, { recursive: true }, (err) => {
      console.log(err);
    });
  }

  const downloadPromises = params.map((param) => {
    const file = fs.createWriteStream(process.cwd()+`/src/address/${collectionId}/${param.Key}`);
    return new Promise((resolve, reject) => {
      s3bucket.getObject(param)
        .createReadStream()
        .pipe(file)
        .on('finish', resolve)
        .on('error', reject);
    });
  });
  await Promise.all(downloadPromises);
  return true;
}catch(error){
  console.log(error);
  console.log('Error occurred during file downloads:', error.message);
    return false;
 }
};

const downloadBulkFromS3 = async (params, inscriptionId) => {
  try {
    const s3bucket = new aws.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_KEY,
      Bucket: process.env.S3_BUCKET_NAME,
    });

    if (!fs.existsSync(process.cwd() + `/src/bulk/${inscriptionId}`)) {
      fs.mkdirSync(process.cwd() + `/src/bulk/${inscriptionId}`, { recursive: true });
    }

    const downloadPromises = params.map((param) => {
      const file = fs.createWriteStream(process.cwd() + `/src/bulk/${inscriptionId}/${param.Key}`);
      return new Promise((resolve, reject) => {
        s3bucket.getObject(param)
          .createReadStream()
          .on('error', reject)
          .pipe(file)
          .on('finish', resolve)
          .on('error', reject);
      });
    });

    await Promise.all(downloadPromises);

    return true;
  } catch (error) {
    console.error('Error occurred during file downloads:', error);
    return false;
  }
};

const initStorage = async () => {
  return new Web3Storage({ token: process.env.WEB3_STORAGE_KEY });
};

const compressImage = async (fileName, optimize) => {
  let fromPath = `./src/img/uncompressed/${fileName}`;
  let toPath = `./build/img/`;
  try {
    const result = await compress({
      source: fromPath,
      destination: toPath,
      enginesSetup: {
        jpg: { engine: "mozjpeg", command: ["-quality", "60"] },
        png: { engine: "pngquant", command: ["--quality=20-50", "-o"] },
        svg: { engine: "svgo", command: "--multipass" },

        gif: {
          engine: "gifsicle",
          command: ["--colors", "64", "--use-col=web"],
        },
      },
    });
    const { statistics, errors } = result;
    const stats = statistics[0];
    const newData = {
      sizeIn: await stats.size_in,
      sizeOut: await stats.size_output,
      comPercentage: await stats.percent,
      outPath: await stats.path_out_new,
      formatedOutPath: await stats.path_out_new.replace(/\//g, "\\"),
      input: stats.input,
    };
    fs.unlinkSync(stats.input);
    return newData;
  } catch (e) {
    console.log(e.message);
  }
};

const compressBulk = async (id, optimize) => {
  let fileSize = [];
  try {
    if (optimize === "true") {
      if (!fs.existsSync(__dirname + `/build/bulk/${id}/`)) {
        fs.mkdirSync(
          __dirname + `/build/bulk/${id}/`,
          { recursive: true },
          (err) => {
            console.log(err);
          }
        );
      }

      const fileNames = fs.readdirSync(`./src/bulk/${id}`);

      for (const fileName of fileNames) {
        let fromPath = `./src/bulk/${id}/${fileName}`;
        let toPath = `./build/bulk/${id}/`;

        const result = await compress({
          source: fromPath,
          destination: toPath,
          enginesSetup: {
            jpg: { engine: "mozjpeg", command: ["-quality", "60"] },
            png: { engine: "pngquant", command: ["--quality=10-50", "-o"] },
            svg: { engine: "svgo", command: "--multipass" },

            gif: {
              engine: "gifsicle",
              command: ["--colors", "64", "--use-col=web"],
            },
          },
        });

        const { statistics, errors } = result;
        const stats = statistics[0];
        const imageFile = await getFilesFromPath(stats.path_out_new);
        console.log(imageFile)
        fileSize.push(imageFile[0].size);
      }
      const sortFileSize = fileSize.sort((a, b) => a - b);
      const newData = {
        largestFile: sortFileSize[sortFileSize.length - 1],
      };
      fs.rmSync(`./src/bulk/${id}`, { recursive: true });
      //fs.rmSync(`./build/bulk/${id}`, { recursive: true });
      return newData;
    } else if (optimize === "false") {
      const fileNames = fs.readdirSync(`./src/bulk/${id}`);

      for (const fileName of fileNames) {
        const imageFile = await getFilesFromPath(
          `./src/bulk/${id}/${fileName}`
        );
        fileSize.push(imageFile[0].size);
      }

      const sortFileSize = fileSize.sort((a, b) => a - b);
      const newData = {
        largestFile: sortFileSize[sortFileSize.length - 1],
      };
      fs.rmSync(`./src/bulk/${id}`, { recursive: true });
      return newData;
    }
  } catch (e) {
    console.log(e.message);
  }
};

const compressAndSaveBulk = async (inscriptionId, optimize) => {
  const storage = await initStorage();
  let files = [];
  let fileSize = [];
  try {
    if (optimize === true) {
      if (!fs.existsSync(process.cwd() + `/build/bulk/${inscriptionId}/`)) {
        fs.mkdirSync(
          process.cwd() + `/build/bulk/${inscriptionId}/`,
          { recursive: true },
          (err) => {
            console.log(err);
          }
        );
      }

      const fileNames = fs.readdirSync(`./src/bulk/${inscriptionId}`);
      for (const fileName of fileNames) {
        let fromPath = `./src/bulk/${inscriptionId}/${fileName}`;
        let toPath = `./build/bulk/${inscriptionId}/`;

        const result = await compress({
          source: fromPath,
          destination: toPath,
          enginesSetup: {
            jpg: { engine: "mozjpeg", command: ["-quality", "60"] },
            png: { engine: "pngquant", command: ["--quality=20-50", "-o"] },
            svg: { engine: "svgo", command: "--multipass" },

            gif: {
              engine: "gifsicle",
              command: ["--colors", "64", "--use-col=web"],
            },
          },
        });

        const { statistics, errors } = result;
        const stats = statistics[0];
        const imageFile = await getFilesFromPath(stats.path_out_new);
        files.push(imageFile[0]);
        fileSize.push(imageFile[0].size);
      }
      const sortFileSize = fileSize.sort((a, b) => a - b);

      const rootCid = await storage.put(files);
      const newData = {
        cid: rootCid,
        largestFile: sortFileSize[sortFileSize.length - 1],
      };
      fs.rmSync(`./src/bulk/${inscriptionId}`, { recursive: true });
      fs.rmSync(`./build/bulk/${inscriptionId}`, { recursive: true });
      return newData;
    } else {
      const fileNames = fs.readdirSync(`./src/bulk/${inscriptionId}`);
      for (const fileName of fileNames) {
        const imageFile = await getFilesFromPath(
          `./src/bulk/${inscriptionId}/${fileName}`
        );
        files.push(imageFile[0]);
        fileSize.push(imageFile[0].size);
      }

      const sortFileSize = fileSize.sort((a, b) => a - b);
      const rootCid = await storage.put(files);
      const newData = {
        cid: rootCid,
        largestFile: sortFileSize[sortFileSize.length - 1],
      };
      fs.rmSync(`./src/bulk/${inscriptionId}`, { recursive: true });
      return newData;
    }
  } catch (e) {
    console.log(e.message);
  }
};

const saveFile = async (fileName, collectionId) => {
  try{
    const storage = await initStorage();
    const filePath = `${process.cwd()}/build/files`
    if(collectionId){
      filePath = process.cwd()`/build/files/${collectionId}`
    }

    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(
        filePath,
        { recursive: true },
        (err) => {
          console.log(err);
        }
      );
    }

    const n_file = await getFilesFromPath(filePath + `/${fileName}`);
      const rootCid = await storage.put(n_file);
      fs.unlinkSync(filePath + `/${fileName}`);
      const newData = {
        cid: rootCid,
        size: n_file[0].size,
      };
      return newData;
  } catch(e) {
    console.log(e.message)
  }
}

const saveFileS3 = async (fileName, collectionId) => {
  try{
    const storage = await initStorage();
    let filePath = `${process.cwd()}/build/files`
    if(collectionId){
      filePath = process.cwd()`/build/files/${collectionId}`
    }
    const n_file = fs.readFileSync(filePath + `/${fileName}`);
     let data = await uploadToS3(fileName, n_file);
      fs.unlinkSync(filePath + `/${fileName}`);
      const newData = {
        cid: data.Location,
        size: n_file.length,
      };
      return newData;
  } catch(e) {
    console.log(e.message)
  }
}

const compressAndSave = async (fileName, optimize) => {
  let fromPath = `./src/img/uncompressed/${fileName}`;
  let toPath = `./build/img/`;
  const storage = await initStorage();
  try {
    if (optimize === true) {
      const result = await compress({
        source: fromPath,
        destination: toPath,
        enginesSetup: {
          jpg: { engine: "mozjpeg", command: ["-quality", "60"] },
          png: { engine: "pngquant", command: ["--quality=20-50", "-o"] },
          svg: { engine: "svgo", command: "--multipass" },

          gif: {
            engine: "gifsicle",
            command: ["--colors", "64", "--use-col=web"],
          },
        },
      });
      const { statistics, errors } = result;
      const stats = statistics[0];
      fs.unlinkSync(stats.input);
      const compdImg = await getFilesFromPath(stats.path_out_new);
      const rootCid = await storage.put(compdImg);
      fs.unlinkSync(stats.path_out_new);
      const newData = {
        sizeIn: await stats.size_in,
        sizeOut: await stats.size_output,
        comPercentage: await stats.percent,
        outPath: await stats.path_out_new,
        input: stats.input,
        cid: rootCid,
      };
      return newData;
    } else if (optimize === false) {
      const compdImg = await getFilesFromPath(fromPath);
      const rootCid = await storage.put(compdImg);
      fs.unlinkSync(fromPath);
      const newData = {
        cid: rootCid,
      };
      return newData;
    }
  } catch (e) {
    console.log(e);
  }
};

const compressAndSaveS3 = async (fileName, optimize) => {
  let fromPath = `./src/img/uncompressed/${fileName}`;
  let toPath = `./build/img/`;
  try {
    if (optimize === true) {
      const result = await compress({
        source: fromPath,
        destination: toPath,
        enginesSetup: {
          jpg: { engine: "mozjpeg", command: ["-quality", "60"] },
          png: { engine: "pngquant", command: ["--quality=20-50", "-o"] },
          svg: { engine: "svgo", command: "--multipass" },

          gif: {
            engine: "gifsicle",
            command: ["--colors", "64", "--use-col=web"],
          },
        },
      });
      const { statistics, errors } = result;
      const stats = await statistics[0];
      fs.unlinkSync(stats.input);
      const compdImg = fs.readFileSync(stats.path_out_new);
      let data = await uploadToS3(fileName, compdImg);
      fs.unlinkSync(stats.path_out_new);
      const newData = {
        sizeIn: stats.size_in,
        sizeOut: stats.size_output,
        comPercentage: stats.percent,
        outPath: stats.path_out_new,
        input: stats.input,
        cid: data.location,
      };
      return newData;
    } else if (optimize === false) {
      const compdImg = fs.readFileSync(fromPath);
      let data = await uploadToS3(fileName, compdImg);
      fs.unlinkSync(fromPath);
      const newData = {
        cid: data.location,
      };
      return newData;
    }
  } catch (e) {
    console.log(e);
  }
};

const compressAndSaveBulkS3 = async (inscriptionId, optimize) => {
  const storage = await initStorage();
  let files = [];
  let fileSize = [];
  try {
    if (optimize === true) {
      if (!fs.existsSync(process.cwd() + `/build/bulk/${inscriptionId}/`)) {
        fs.mkdirSync(
          process.cwd() + `/build/bulk/${inscriptionId}/`,
          { recursive: true },
          (err) => {
            console.log(err);
          }
        );
      }

      const fileNames = await Promise.all(fs.readdirSync(`./src/bulk/${inscriptionId}`));
      console.log(fileNames)
      await Promise.all(fileNames.map(async (fileName) => {
        let fromPath = `./src/bulk/${inscriptionId}/${fileName}`;
        let toPath = `./build/bulk/${inscriptionId}/`;

        const result = await compress({
        source: fromPath,
        destination: toPath,
        enginesSetup: {
          jpg: { engine: "mozjpeg", command: ["-quality", "60"] },
          png: { engine: "pngquant", command: ["--quality=20-50", "-o"] },
          svg: { engine: "svgo", command: "--multipass" },

          gif: {
            engine: "gifsicle",
            command: ["--colors", "64", "--use-col=web"],
          },
        },
        });

        const { statistics, errors } = result;
        const stats = statistics[0];
        const imageFile = fs.readFileSync(stats.path_out_new);
        const file = {name: fileName, buffer: imageFile}

        files.push(file);
        fileSize.push(imageFile.length);
      }));
        
      const sortFileSize = fileSize.sort((a, b) => a - b);
      let responseData = [];

      await Promise.all(files.map(async (item) => {
        let fileName = item.name;
        let itemBuffer = item.buffer;
        let data = await uploadToS3(fileName, itemBuffer);
        responseData.push(data.Location);
      }));

      fs.rmSync(`./src/bulk/${inscriptionId}`, { recursive: true });
      fs.rmSync(`./build/bulk/${inscriptionId}`, { recursive: true });
      return {
        cid: responseData,
        largestFile: sortFileSize[sortFileSize.length - 1],
      };
    } else {
      const fileNames = fs.readdirSync(`./src/bulk/${inscriptionId}`);
      fileNames.forEach(fileName => {
        const imageFile = fs.readFileSync(`./src/bulk/${inscriptionId}/${fileName}`)
        let file = {name: fileName, buffer: imageFile}
        files.push(file);
        fileSize.push(imageFile.length);
      })
      const sortFileSize = fileSize.sort((a, b) => a - b);
      let params = [];

      files.forEach(item => {
        let fileName = item.name;
        let itemBuffer = item.buffer;
        let _param = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: fileName,
          Body: itemBuffer,
        }
        params.push(_param);
      })
      let data = await uploadToS3Bulk(params);
      data = data.map(item => item.Location);

      fs.rmSync(`./src/bulk/${inscriptionId}`, { recursive: true });
      return {
        cid: data,
        largestFile: sortFileSize[sortFileSize.length - 1],
      };
    }
  } catch (e) {
    console.log(e.message);
  }
};

module.exports = {
  compressImage,
  compressAndSave,
  compressAndSaveBulk,
  compressBulk,
  compressAndSaveS3,
  compressAndSaveBulkS3,
  uploadToS3,
  saveFile,
  saveFileS3,
  downloadFromS3,
  downloadAddressFile,
  downloadAllAddressFile
};


//compressBulk("image", "true").then((res)=> {console.log(res)}).catch((err)=>console.log(err));
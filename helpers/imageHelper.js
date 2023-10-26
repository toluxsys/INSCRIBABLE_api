const { compress } = require("compress-images/promise");
const { Web3Storage, getFilesFromPath } = require("web3.storage");
const fs = require("fs");
const {Blob} = require("buffer")
const { cwd } = require("process");
const dotenv = require("dotenv").config();
const aws = require("aws-sdk");
const { collection } = require("../model/inscription");
const sharp = require("sharp");
const { promises } = require("dns");
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
  try{
    let s3bucket = new aws.S3({
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
  try{
    let s3bucket = new aws.S3({
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

const compressImage = async (file, optimize) => {
  try {
    let fileSize = [];
    let optData
    let compData = await resizeFile({file: file, optimize:optimize})
    compData.map(async (x) => {
      fileSize.push(x.sizeOut);
      fs.unlinkSync(x.outPath)
    })
    return compData[0]
  } catch (e) {
    console.log(e.message);
  }
};

const compressBulk = async (file, optimize) => {
  try {
    let fileSize = [];
    let optData
    if(optimize === "true"){
      optData = true
    }else{
      optData = false
    }
    let compData = await resizeFile({file:file, optimize:optData})
    compData.map(async (x) => {
      fileSize.push(x.sizeOut);
      fs.unlinkSync(x.outPath)
    })
    const sortFileSize = fileSize.sort((a, b) => a - b);
    return {
      largestFile: sortFileSize[sortFileSize.length - 1],
      compData: compData
    };
  } catch (e) {
    console.log(e.message);
  }
};

const compressAndSaveBulk = async (file, inscriptionId, optimize) => {
  try {
    const storage = await initStorage();
    let fileSize = [];
    let _file = []
    let imageFiles = []

    const compData = await resizeFile({file:file, inscriptionId:inscriptionId, optimize:optimize})
    for(const x of compData){
      const imageFile = await getFilesFromPath(x.outPath);
      let fileName = x.outPath.split("/")[x.outPath.split("/").length - 1]
      const file = {name: fileName, buffer: imageFile[0], outPath: x.outPath}
      _file.push(file)
      fileSize.push(imageFile[0].size);
      imageFiles.push(imageFile[0]);
    }
       
    const sortFileSize = fileSize.sort((a, b) => a - b);
    const rootCid = await storage.put(imageFiles);  
    
    await Promise.all(_file.map(x=>{
      fs.unlinkSync(x.outPath)
    }))

    return {
      cid: rootCid,
      largestFile: sortFileSize[sortFileSize.length - 1],
      compData: compData
    };
  } catch (e) {
    console.log(e);
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

const compressAndSave = async (file, optimize) => { 
  try {
    const storage = await initStorage();
    let files = [];
    let fileSize = [];

    const compData = await resizeFile({ file: file, optimize: optimize });

    for (const x of compData) {
      const compdImg = await getFilesFromPath(x.outPath);
      let fileName = x.outPath.split("/")[x.outPath.split("/").length - 1];
      let _file = { name: fileName, buffer: compdImg, outPath: x.outPath, sizeIn: x.sizeIn, sizeOut: x.sizeOut, comPercentage: x.comPercentage };
      files.push(_file);
      fileSize.push(compdImg[0].size);
    }

    let res = await Promise.all(files.map(async (item) => {
      let itemBuffer = item.buffer;
      const rootCid = await storage.put(itemBuffer);
      fs.unlinkSync(item.outPath);
      return {
        sizeIn: item.sizeIn,
        sizeOut: item.sizeOut,
        comPercentage: item.comPercentage,
        outPath: item.outPath,
        cid: rootCid
      };
    }));

    return res[0];
  } catch (e) {
    console.log(e);
  }
};

const compressAndSaveS3 = async (file, optimize) => {
  try {
      let files = [];
      let fileSize = [];

      const compData = await resizeFile({file:file, optimize:optimize})
      for (const x of compData) {
        const imageFile = fs.readFileSync(x.outPath);
        let fileName = x.outPath.split("/")[x.outPath.split("/").length - 1]
        const file = {name: fileName, buffer: imageFile, outPath: x.outPath, sizeIn: x.sizeIn, sizeOut:x.sizeOut, comPercentage:x.comPercentage}
        files.push(file);
        fileSize.push(imageFile.length);
      }

      let data = await Promise.all(files.map(async (item) => {
        let fileName = item.name;
        let itemBuffer = item.buffer;
        let data = await uploadToS3(fileName, itemBuffer);
        fs.unlinkSync(item.outPath)
       return {
          sizeIn: item.sizeIn,
          sizeOut: item.sizeOut,
          comPercentage: item.comPercentage,
          outPath: item.outPath,
          cid: data.Location,
        }
      }));
      return data[0]
  } catch (e) {
    console.log(e);
  }
};

const compressAndSaveBulkS3 = async (file, inscriptionId, optimize) => {
  try {
      const storage = await initStorage();
      let files = [];
      let fileSize = [];

      const compData = await resizeFile({file:file, inscriptionId:inscriptionId, optimize:optimize})
      for (const x of compData) {
        const imageFile = fs.readFileSync(x.outPath);
        let fileName = x.outPath.split("/")[x.outPath.split("/").length - 1]
        const file = {name: fileName, buffer: imageFile, outPath: x.outPath}
        files.push(file);
        fileSize.push(imageFile.length);
      }


      const sortFileSize = fileSize.sort((a, b) => a - b);
      let responseData = [];


      await Promise.all(files.map(async (item) => {
        let fileName = item.name;
        let itemBuffer = item.buffer;
        let data = await uploadToS3(fileName, itemBuffer);
        responseData.push(data.Location);
        fs.unlinkSync(item.outPath)
      }));
      
      return {
        cid: responseData[0],
        largestFile: sortFileSize[sortFileSize.length - 1],
        compData: compData
      };
    
  } catch (e) {
    console.log(e.message);
  }
};

const resizeFile = async ({file, inscriptionId, optimize}) => {
  try{
    let compData = []
    if(optimize == true) {
      if(file.length == 1){
        let toPath = process.cwd()+`/build/img/`
        if (!fs.existsSync(toPath)) {
          fs.mkdirSync(
            toPath,
            { recursive: true },
            (err) => {
              console.log(err);
            }
          );
        }

        let mimetype = file[0].mimetype
        //let newFilePath = 
        switch (mimetype) {
          case "image/png":
            let compPng = await sharp(file[0].path).resize().png({ quality: 70 }).toFile(toPath+file[0].filename);
            fs.unlinkSync(file[0].path);
            compData.push({
              sizeIn: file[0].size,
              sizeOut: compPng.size,
              comPercentage: percentageDiff(file[0].size, compPng.size),
              inPath: file[0].path,
              outPath: toPath+file[0].filename
            })
            break;
          case "image/jpeg":
            let compJpeg = await sharp(file[0].path).resize().jpeg({ quality: 70 }).toFile(toPath+file[0].filename);
            fs.unlinkSync(file[0].path);
            compData.push({
              sizeIn: file[0].size,
              sizeOut: compJpeg.size,
              comPercentage: percentageDiff(file[0].size, compJpeg.size),
              inPath: file[0].path,
              outPath: toPath+file[0].filename
            })
            break;
          case "image/gif":
            let compGif = await sharp(file[0].path).resize().gif({ quality: 70 }).toFile(toPath+file[0].filename);
            fs.unlinkSync(file[0].path);
            compData.push({
              sizeIn: file[0].size,
              sizeOut: compGif.size,
              comPercentage: percentageDiff(file[0].size, compGif.size),
              inPath: file[0].path,
              outPath: toPath+file[0].filename
            })
            break;
          case "image/webp":
            let compWeb = await sharp(file[0].path).resize().webp({ quality: 70 }).toFile(toPath+file[0].filename);
            fs.unlinkSync(file[0].path);
            compData.push({
              sizeIn: file[0].size,
              sizeOut: compWeb.size,
              comPercentage: percentageDiff(file[0].size, compWeb.size),
              inPath: file[0].path,
              outPath: toPath+file[0].filename
            })
            break;
          default: 
            `file with type of ${mimetype} cannot be optimized`;
        }
      }else{
        await Promise.all(file.map(async(x)=> {
          let toPath = process.cwd()+`/build/bulk/${inscriptionId}/`
          if (!fs.existsSync(toPath)) {
            fs.mkdirSync(
                toPath,
              { recursive: true },
              (err) => {
                console.log(err);
              }
            );
          }
  
          let mimetype = x.mimetype
          switch (mimetype) {
            case "image/png":
              let compPng = await sharp(x.path).resize().png({ quality: 70 }).toFile(toPath+x.filename);
              fs.unlinkSync(x.path);
              compData.push({
                sizeIn: x.size,
                sizeOut: compPng.size,
                comPercentage: percentageDiff(x.size, compPng.size),
                inPath: x.path,
                outPath: toPath+x.filename
              })
              break;
            case "image/jpeg":
              let compJpeg = await sharp(x.path).resize().jpeg({ quality: 70 }).toFile(toPath+x.filename);
              fs.unlinkSync(x.path);
              compData.push({
                sizeIn: x.size,
                sizeOut: compJpeg.size,
                comPercentage: percentageDiff(x.size, compJpeg.size),
                inPath: x.path,
                outPath: toPath+x.filename
              })
              break;
            case "image/gif":
              let compGif = await sharp(x.path).resize().gif({ quality: 70 }).toFile(toPath+x.filename);
              fs.unlinkSync(x.path);
              compData.push({
                sizeIn: x.size,
                sizeOut: compGif.size,
                comPercentage: percentageDiff(x.size, compGif.size),
                inPath: x.path,
                outPath: toPath+x.filename
              })
              break;
            case "image/png":
              let compWeb = await sharp(x.path).resize().webp({ quality: 70 }).toFile(toPath+x.filename);
              fs.unlinkSync(x.path);
              compData.push({
                sizeIn: x.size,
                sizeOut: compWeb.size,
                comPercentage: percentageDiff(x.size, compWeb.size),
                inPath: x.path,
                outPath: toPath+x.filename
              })
              break;
            default: 
              `file with type of ${mimetype} cannot be optimized`;
          }
        }))
      }
    }else{
      file.map((x)=> {
        compData.push({
          sizeIn: x.size,
          sizeOut: x.size,
          inPath: x.path,
          outPath: x.path,
          comPercentage: 0
        })
      })
    }
    return compData
  }catch(e){
    console.log(e)
  }
}

const percentageDiff = (value1, value2) => {
  try{
   
    if (typeof value1 !== 'number' || typeof value2 !== 'number') {
        throw new Error('Both values must be numbers');
    }
    const larger = Math.max(value1, value2);
    const smaller = Math.min(value1, value2);
    const difference = larger - smaller;
    const percentageDifference = (difference / larger) * 100;
    return percentageDifference;
  }catch(e){
    console.log(e.message)
  }
}

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
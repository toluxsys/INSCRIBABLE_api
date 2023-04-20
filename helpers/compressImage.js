const { compress } = require("compress-images/promise");
const { Web3Storage, getFilesFromPath } = require("web3.storage");
const { sort } = require("./sort");
const fs = require("fs");
const dotenv = require("dotenv").config();

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
      sizeIn: (await stats.size_in) / 1000,
      sizeOut: (await stats.size_output) / 1000,
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

const compressAndSaveBulk = async (inscriptionId, optimize) => {
  const storage = await initStorage();
  let files = [];
  let fileSize = [];
  try {
    if (optimize === true) {
      if (!fs.existsSync(__dirname + `/build/bulk/${inscriptionId}/`)) {
        fs.mkdirSync(
          __dirname + `/build/bulk/${inscriptionId}/`,
          { recursive: true },
          (err) => {
            console.log(err);
          }
        );
      }

      const fileNames = fs.readdirSync(`./src/bulk/${inscriptionId}`);
      console.log(fileNames);

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
      console.log(sortFileSize);

      const rootCid = await storage.put(files);
      const newData = {
        cid: rootCid,
        largestFile: sortFileSize[sortFileSize.length - 1],
      };
      console.log(`Image Saved: CID (${rootCid})`);
      fs.rmSync(`./src/bulk/${inscriptionId}`, { recursive: true });
      fs.rmSync(`./build/bulk/${inscriptionId}`, { recursive: true });
      return newData;
    } else {
      const fileNames = fs.readdirSync(`./src/bulk/${inscriptionId}`);
      console.log(fileNames);

      for (const fileName of fileNames) {
        const imageFile = await getFilesFromPath(
          `./src/bulk/${inscriptionId}/${fileName}`
        );
        files.push(imageFile[0]);
        fileSize.push(imageFile[0].size);
      }

      const sortFileSize = fileSize.sort((a, b) => a - b);
      console.log(sortFileSize);
      const rootCid = await storage.put(files);
      const newData = {
        cid: rootCid,
        largestFile: sortFileSize[sortFileSize.length - 1],
      };
      console.log(`Image Saved: CID (${rootCid})`);
      fs.rmSync(`./src/bulk/${inscriptionId}`, { recursive: true });
      return newData;
    }
  } catch (e) {
    console.log(e.message);
  }
};

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
        sizeIn: (await stats.size_in) / 1000,
        sizeOut: (await stats.size_output) / 1000,
        comPercentage: await stats.percent,
        outPath: await stats.path_out_new,
        formatedOutPath: await stats.path_out_new.replace(/\//g, "\\"),
        input: stats.input,
        cid: rootCid,
      };
      console.log(`Image Saved: CID (${rootCid})`);
      return newData;
    } else if (optimize === false) {
      const compdImg = await getFilesFromPath(fromPath);
      const rootCid = await storage.put(compdImg);
      fs.unlinkSync(fromPath);
      const newData = {
        cid: rootCid,
      };
      console.log(`Image Saved: CID (${rootCid})`);
      return newData;
    }
  } catch (e) {
    console.log(e);
  }
};

module.exports = { compressImage, compressAndSave, compressAndSaveBulk };

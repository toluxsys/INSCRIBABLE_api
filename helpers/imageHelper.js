const { compress } = require("compress-images/promise");
const { Web3Storage, getFilesFromPath } = require("web3.storage");
const { sort } = require("./sort");
const fs = require("fs");
const { cwd } = require("process");
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
        fileSize.push(imageFile[0].size);
      }
      const sortFileSize = fileSize.sort((a, b) => a - b);
      const newData = {
        largestFile: sortFileSize[sortFileSize.length - 1],
      };
      fs.rmSync(`./src/bulk/${id}`, { recursive: true });
      fs.rmSync(`./build/bulk/${id}`, { recursive: true });
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

const saveFile = async (fileName) => {
  try{
    const storage = await initStorage();
    const filePath = `${process.cwd()}/build/files/${fileName}`
    const n_file = await getFilesFromPath(filePath);
      const rootCid = await storage.put(n_file);
      fs.unlinkSync(filePath);
      const newData = {
        cid: rootCid,
        size: n_file[0].size,
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

module.exports = {
  compressImage,
  compressAndSave,
  compressAndSaveBulk,
  compressBulk,
  saveFile,
};

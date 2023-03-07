const { compress } = require("compress-images/promise");
const { unlinkSync } = require("fs");

const compressImage = async (fileName) => {
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
    unlinkSync(stats.input);
    return newData;
  } catch (e) {
    console.log(e);
  }
};

module.exports = { compressImage };

const { exec } = require("child_process");
const dotenv = require("dotenv");
dotenv.config();

// fileName and fee rate gotten from db
const inscribe = async (feeRate, fileName) => {
  try {
    const imagePath = process.cwd() + `build\img\\${fileName}`;
    const command = `ord --cookie-file "E:\Bitcoin\.cookie" --wallet ordinalHashes wallet inscribe --fee-rate ${feeRate} ${imagePath}`;
    exec(command, { cwd: `E:\Bitcoin\ORD` }, function (error, stdout, stderr) {
      if (error) {
        console.log(error);
        return;
      }

      if (stderr) {
        console.log(stderr);
        return;
      }

      return stdout;
    });
  } catch (e) {
    console.log(e);
  }
};

const sendInscription = async (address, inscriptionId) => {
  try {
    const command = `ord --cookie-file "E:\Bitcoin\.cookie" --wallet ordinalHashes wallet send --fee-rate ${3} ${address} ${inscriptionId}`;
    exec(command, { cwd: `E:\Bitcoin\ORD` }, function (error, stdout, stderr) {
      if (error) {
        console.log(error);
        return;
      }

      if (stderr) {
        console.log(stderr);
        return;
      }

      return stdout;
    });
  } catch (e) {
    console.log(e);
  }
};

const inscriptionPaymentAddress = async () => {
  try {
    const command = `ord --cookie-file "E:\Bitcoin\.cookie" --wallet ordinalHashes ord wallet receive`;
    exec(command, { cwd: `E:\Bitcoin\ORD` }, function (error, stdout, stderr) {
      if (error) {
        console.log(error);
        return;
      }

      if (stderr) {
        console.log(stderr);
        return;
      }

      return stdout;
    });
  } catch (e) {
    console.log(e);
  }
};

const test = async () => {
  try {
    const path = process.cwd();
    exec(`ls`, { cwd: path }, function (error, stdout, stderr) {
      if (error) {
        console.log(error);
        return;
      }

      if (stderr) {
        console.log(stderr);
        return;
      }

      console.log(stdout);
      return stdout;
    });
  } catch (e) {
    console.log(e);
  }
};

module.exports = { inscribe, sendInscription, inscriptionPaymentAddress };

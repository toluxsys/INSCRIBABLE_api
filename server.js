const express = require("express");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");
const inscriptRoute = require("./routes/inscriptRoute.js");
const collectionRoute = require("./routes/collectionRoute.js");
const interval = process.env.INDEXING_INTERVAL;
let timerId;
let blockHeight = 0;

const app = express();
const port = process.env.PORT || 5000;
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

mongoose.set(`strictQuery`, false);
mongoose
  .connect(process.env.MONGO_DB_URI)
  .then((res) => {
    console.log(`Mongo DB Connected! to ${res.connection.host}`);

    timerId = setTimeout(async function indexOrd() {
      const blocks = await axios.post(
        process.env.ORD_API_URL + `/ord/getLatestBlock`
      );
      if (blocks.data.message !== `ok`)
        console.log(
          `[ALERT]: ORD INDEXING ERROR WITH MESSAGE: ${blocks.data.message}`
        );
      if (blocks.data.userResponse.data > blockHeight) {
        await axios.post(process.env.ORD_API_URL + `/ord/index_ord`);
        blockHeight = blocks.data.userResponse.data;
      }
      timerId = setTimeout(indexOrd, interval);
    }, interval);
  })
  .catch(console.error);

app.use(`/api/inscript`, inscriptRoute);
app.use(`/api/collection`, collectionRoute);

app.get("/", (req, res) => {
  res.status(200).json({ message: "You are connected to the server" });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

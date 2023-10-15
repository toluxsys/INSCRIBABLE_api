const express = require("express");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");
const inscriptRoute = require("./routes/inscriptRoute.js");
const collectionRoute = require("./routes/collectionRoute.js");
const explorerRoute = require("./routes/explorerRoute.js");
const RabbitMqClient = require("./helpers/queue/rabbitMqClient.js");
const RabbitMqConsumer = require("./helpers/queue/rabbitMqConsumer.js");
const {initCron} = require("./cron.js")
const interval = process.env.INDEXING_INTERVAL;

const app = express();
const port = process.env.PORT || 5000;
const host = "0.0.0.0";
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
  .then(async (res) => {
    console.log(`Mongo DB Connected! to ${res.connection.host}`);
    await RabbitMqClient.initilize()
    await RabbitMqConsumer.initilize()
  })
  .catch(console.error);

app.use(`/api/inscript`, inscriptRoute);
app.use(`/api/collection`, collectionRoute);
app.use(`/api/explore`, explorerRoute);

app.get("/", async(req, res) => {
  let result = await RabbitMqClient.addToQueue({orderId:"se28c1b9d-b90f-4f6f-b914-a933cbb1ce89", networkName: "mainnet", txid:"bfe74fe8d9e70f89f1c57388de801e498e082e755c8217f9b05a12742786ab7d"}, "paymentSeen")
  if(result.status !== true) return res.status(200).json({message: "message not added to queue"})
  res.status(200).json({ message: "You are connected to the server", rabbitMq: result.message });
  
});

app.listen(port, host, async() => {
  console.log(`Server running on port ${port}`);
  //initilize rabbit mq
  //initilize cron job
  //initCron();
});

//docker commands = docker compose up --scale api=1000

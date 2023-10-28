const express = require("express");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");
const inscriptRoute = require("./routes/inscriptRoute.js");
const collectionRoute = require("./routes/collectionRoute.js");
const explorerRoute = require("./routes/explorerRoute.js");
const uniInscriptionRoute = require("./routes/uniInscriptionRoute.js") 
const rewardRoute = require("./routes/rewardRoute.js")
const RabbitMqClient = require("./helpers/queue/rabbitMqClient.js");
const RabbitMqConsumer = require("./helpers/queue/rabbitMqConsumer.js");

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
app.use(`/api/reward`, rewardRoute);

//endpoint for universal api route
app.use(`/api`, uniInscriptionRoute);

app.get("/", async(req, res) => {
  res.status(200).json({ message: "You are connected to the server" });
});

app.listen(port, host, async() => {
  console.log(`Server running on port ${port}`);
});

//docker commands = docker compose up --scale api=1000

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const inscriptRoute = require("./routes/inscriptRoute.js");

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

mongoose
  .connect(process.env.MONGO_DB_URI)
  .then(() => console.log("Connected!"))
  .catch(console.error);

app.use(`/api/inscript`, inscriptRoute);

app.get("/", (req, res) => {
  res.status(200).json({ message: "You are connected to the server" });
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});

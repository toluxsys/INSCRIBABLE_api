// const express = require("express");
// const controller = require("../controllers/inscriptionController");
// const path = require("path");
// const router = express.Router();
// const fileUpload = require("express-fileupload");
// const fs = require("fs");
// const { v4: uuidv4 } = require("uuid");
// const basicAuth = require('express-basic-auth')
// const dotenv = require("dotenv").config();


// router.use(express.urlencoded({ extended: false }));
// router.use(express.json());

// router.use(basicAuth({
//   authorizer: (username, password, cb) => {
//     const userMatches = basicAuth.safeCompare(username, process.env.API_USERNAME)
//     const passwordMatches = basicAuth.safeCompare(password, process.env.API_PASSWORD)
//     if (userMatches & passwordMatches)
//       return cb(null, true)
//     else
//       return cb(null, false)
//   },
//   authorizeAsync: true,
// }))

// router.use(
//   fileUpload({
//     useTempFiles: true,
//     tempFileDir: path.join(process.cwd(), `tmp`),
//     createParentPath: true,
//   })
// );

// //uiniversal inscribe route
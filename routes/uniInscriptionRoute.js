const express = require('express');
const dotenv = require('dotenv').config();

const router = express.Router();
const basicAuth = require('express-basic-auth');

const controller = require('../controllers/uniInscriptionController');

router.use(express.urlencoded({ extended: false }));
router.use(express.json());

router.use(
  basicAuth({
    authorizer: (username, password, cb) => {
      const userMatches = basicAuth.safeCompare(
        username,
        process.env.API_USERNAME,
      );
      const passwordMatches = basicAuth.safeCompare(
        password,
        process.env.API_PASSWORD,
      );
      if (userMatches && passwordMatches) return cb(null, true);
      return cb(null, false);
    },
    authorizeAsync: true,
  }),
);

router.post('/inscribe', controller.inscribeItem);
router.post('/checkPayment', controller.verifyPayment);
router.post('/address_orders', controller.getAllAddressOrder);
router.post('/getOrder', controller.getOrder);
router.post('/getUserOrder', controller.getReceiverOrder);
router.post('/updateSatDetails', controller.updateSatDetails);
router.post('/addSats', controller.addSats);

module.exports = router;

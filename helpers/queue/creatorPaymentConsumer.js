/* eslint-disable prettier/prettier */
const ampq = require('amqplib');
const mempoolJS = require('@mempool/mempool.js');
const dotenv = require('dotenv').config();
const { sendCreatorsPayment } = require('../inscriptionHelper');
const Collection = require('../../model/collection')
const Inscription = require('../../model/inscription')
const {createTransaction, getAddressType, getAddressHistory} = require('../walletHelper.js')

const interval = 3000;

const options = {
  protocol: 'amqp',
  hostname: process.env.RMQ_HOST,
  port: 5672,
  username: 'admin',
  password: process.env.RMQ_PASSWORD,
  vhost: '/',
  authMechnisim: ['PLAIN', 'AMQPLAIN', 'EXTERNAL'],
};

const validBindingKeys = ['paymentSeen', 'paymentReceived', 'error', 'creatorsPayment'];
// const validQueue = ['seen', 'received', 'error'];

class Consumer {
  instance;

  channel;

  conn;

  isInitilized = false;

  timerId;

  initilize = async () => {
    try {
      if (this.isInitilized === false) {
        this.conn = await ampq.connect(options);
        this.channel = await this.conn.createChannel();
      } else {
        return;
      }
      await this.consumeMessage1();
      console.log('creators Payment Queue Consumer Initilized...');
      this.isInitilized = true;
    } catch (e) {
      console.log(e);
    }
  };

  static getInstance() {
    if (!this.instance) {
      this.instance = new Consumer();
    }
    return this.instance;
  }

  // eslint-disable-next-line class-methods-use-this
  init = async (network) => {
    const {
      bitcoin: { addresses, fees, transactions },
    } = mempoolJS({
      hostname: 'mempool.space',
      network,
    });

    return { addresses, fees, transactions };
  };

  getStatus = async (txId) => {
    try {
      const { transactions } = await this.init('mainnet');
      const txid = txId;
      const tx = await transactions.getTx({ txid });
      return tx.status.confirmed;
    } catch (e) {
      console.log(e.message);
    }
  };

  consumeMessage = async (queueName, bindingKey) => {
    try {
      if (!validBindingKeys.includes(bindingKey)) {
        return { message: 'invalid bindingKey key', status: false };
      }

      const exchangeName = process.env.EXCHANGE_NAME || 'inscriptions';

      // check that exchange exists or create exchange
      await this.channel.assertExchange(exchangeName);

      // check that queue exists or create queue
      const q = await this.channel.assertQueue(queueName);

      // bind queue and exchange
      await this.channel.bindQueue(q.queue, exchangeName, bindingKey);
      // await this.channel.prefetch(1)

      const msg = await this.channel.get(q.queue);
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        if(content.txid === ''){
          console.log(
            '[CREATORS PAYMENT CLIENT]:',
            'orderId:',
            content.orderId,
            'paymentStatus:',
            false,
          );
          const inscription = await Inscription.findOne({id: content.orderId})
          const collection = await Collection.findOne({id: inscription.collectionId})

          const utxo = await getAddressHistory(collection.collectionAddress, inscription.inscriptionDetails.payAddress, 'mainnet');
          let msgData;
          if(utxo.length === 0){
            msgData = {orderId: content.orderId, networkName: 'mainnet', txid: ''}
          }else{
            msgData = {orderId: content.orderId, networkName: 'mainnet', txid: utxo[0].txid }
          }
          
          this.channel.ack(msg);
          await this.channel.publish(
          exchangeName,
          'creatorsPayment',
          Buffer.from(JSON.stringify(msgData)),
          );

        }else{
          const status = await this.getStatus(content.txid);
          console.log(
            '[CREATORS PAYMENT CLIENT]:',
            'orderId:',
            content.orderId,
            'paymentStatus:',
            status,
          );
          if (status === true) {
              const res = await sendCreatorsPayment({
                  inscriptionId: content.orderId,
                  networkName: content.networkName,
              });
              if (res === undefined) {
                  this.channel.ack(msg);
                  await this.channel.publish(
                  exchangeName,
                  'creatorsPayment',
                  Buffer.from(JSON.stringify(content)),
                  );
              } else if (res.status === false) {
                  this.channel.ack(msg);
                  await this.channel.publish(
                  exchangeName,
                  'creatorsPayment',
                  Buffer.from(JSON.stringify(content)),
                  );
              } else {
                  this.channel.ack(msg);
              }
          }else{
              this.channel.ack(msg);
                  await this.channel.publish(
                  exchangeName,
                  'creatorsPayment',
                  Buffer.from(JSON.stringify(content)),
              );
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
  };

  consumeMessage1 = async () => {
    this.timerId = setTimeout(async () => {
      await this.consumeMessage('creatorsPayment', 'creatorsPayment');
      this.consumeMessage1();
    }, interval);
  };
}

module.exports = Consumer.getInstance();

// docker run -d --hostname rabbit --name rabbit-server -p 15672:15672 -p 5672:5672 rabbitmq:3.12.6-management

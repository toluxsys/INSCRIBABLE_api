const ampq = require('amqplib');
const mempoolJS = require('@mempool/mempool.js');
const dotenv = require('dotenv').config();
const { inscribe } = require('../inscriptionHelper');
const Inscription = require('../../model/inscription');
const BulkInscription = require('../../model/bulkInscription');
const { getType } = require('../getType');

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

const validBindingKeys = ['paymentSeen', 'paymentReceived', 'error'];
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
      console.log('Consumer Initilized...');
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
        const status = await this.getStatus(content.txid);
        console.log('[RECEIVED CLIENT]', 'orderId:', content.orderId,'paymentStatus:',status,
        );
        if (status === true) {
          const type = getType(content.orderId);
          let inscription;
          if (type === `single`) {
            inscription = await Inscription.findOne({ id: content.orderId });
          } else if (type === `bulk`) {
            inscription = await BulkInscription.findOne({
              id: content.orderId,
            });
          } else {
            inscription = '';
          }

          if (inscription === '') {
            this.channel.ack(msg);
          } else if (inscription.inscribed === true) {
            this.channel.ack(msg);
          } else {
            const res = await inscribe({
              inscriptionId: content.orderId,
              networkName: content.networkName,
            });

            if(res === undefined){
              this.channel.ack(msg);
              await this.channel.publish(
                exchangeName,
                'paymentReceived',
                Buffer.from(JSON.stringify(content)),
              );
            }else if (res.message !== 'Request failed with status code 404') {
              console.log(res)
              this.channel.ack(msg);
              await this.channel.publish(
                exchangeName,
                'paymentReceived',
                Buffer.from(JSON.stringify(content)),
              );
            } else if (res.message !== 'inscription complete') {
              this.channel.ack(msg);
              await this.channel.publish(
                exchangeName,
                'error',
                Buffer.from(
                  JSON.stringify({ id: content.orderId, message: res.message }),
                ),
              );
            } else {
              this.channel.ack(msg);
            }
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
  };

  consumeMessage1 = async () => {
    this.timerId = setTimeout(async () => {
      await this.consumeMessage('received', 'paymentReceived');
      this.consumeMessage1();
    }, interval);
  };
}

module.exports = Consumer.getInstance();

// docker run -d --hostname rabbit --name rabbit-server -p 15672:15672 -p 5672:5672 rabbitmq:3.12.6-management

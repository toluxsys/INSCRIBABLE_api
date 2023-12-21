/* eslint-disable prettier/prettier */
const ampq = require('amqplib');
const dotenv = require('dotenv').config();
const { getType } = require('../getType');
const Inscription = require('../../model/inscription');
const BulkInscription = require('../../model/bulkInscription');

const options = {
  protocol: 'amqp',
  hostname: process.env.RMQ_HOST,
  port: 5672,
  username: 'admin',
  password: process.env.RMQ_PASSWORD,
  vhost: '/',
  authMechnisim: ['PLAIN', 'AMQPLAIN', 'EXTERNAL'],
};

const validRoutingKeys = ['paymentSeen', 'paymentReceived', 'error', 'creatorsPayment', 'pendingOrders'];
// const validQueue = ['seen', 'received', 'error'];

class RabbitMqClient {
  instance;

  channel;

  isInitilized = false;

  initilize = async () => {
    try {
      if (this.isInitilized === false) {
        const _conn = await ampq.connect(options.hostname);
        this.channel = await _conn.createChannel();
      } else {
        return;
      }
      await this.consumeMessage('error', 'error');
      this.isInitilized = true;
      console.log('Error Channel Initilized...');
    } catch (e) {
      console.log(e);
    }
  };

  static getInstance() {
    if (!this.instance) {
      this.instance = new RabbitMqClient();
    }
    return this.instance;
  }

  addToQueue = async ({ data, routingKey }) => {
    try {
      if (!this.isInitilized) {
        await this.initilize();
      }
      if (!validRoutingKeys.includes(routingKey)) {
        return { message: 'invalid routing key', status: false };
      }
      const message = Buffer.from(JSON.stringify(data));
      const exchangeName = process.env.EXCHANGE_NAME || 'inscriptions';
      await this.channel.assertExchange(exchangeName);
      const pub = await this.channel.publish(exchangeName, routingKey, message);
      return { message: 'message added to queue', status: pub };
    } catch (e) {
      console.log(e);
    }
  };

  consumeMessage = async (queueName, bindingKey) => {
    try {
      const exchangeName = process.env.EXCHANGE_NAME || 'inscriptions';
      await this.channel.assertExchange(exchangeName);
      const q = await this.channel.assertQueue(queueName);
      await this.channel.bindQueue(q.queue, exchangeName, bindingKey);
      await this.channel.consume(q.queue, async (msg) => {
        const content = JSON.parse(msg.content.toString());
        const inscriptionId = content.id;
        const errorMessage = content.message;
        const type = getType(inscriptionId);
        let inscription;
        if (type === 'single') {
          inscription = await Inscription.findOne({ id: inscriptionId });
        } else if (type === 'bulk') {
          inscription = await BulkInscription.findOne({ id: inscriptionId });
        } else {
          inscription = '';
        }

        if (inscription !== '') {
          inscription.error = true;
          inscription.errorMessage = errorMessage;
          await inscription.save();
          this.channel.ack(msg);
        } else {
          this.channel.ack(msg);
        }
      });
    } catch (e) {
      console.log(e.message);
    }
  };
}

module.exports = RabbitMqClient.getInstance();

// let producer = Producer.getInstance();

// producer.addToQueue({message: "testing rabbit mq"}, "paymentSeen").then(res => console.log(res)).catch()

// docker run -d --hostname rabbit --name rabbit-server -p 15672:15672 -p 5672:5672 rabbitmq:3.12.6-management

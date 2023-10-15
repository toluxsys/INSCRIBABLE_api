
const ampq = require("amqplib") 
const mempoolJS = require("@mempool/mempool.js");
const { inscribe } = require("../inscriptionHelper")
const Inscription = require("../../model/inscription");
const BulkInscription = require("../../model/bulkInscription");
const { getType } = require("../getType");
const { MongoClient } = require('mongodb');
const dotenv = require("dotenv").config();


const options = {
    protocol: "amqp",
    hostname: process.env.RMQ_HOST,
    port: 5672,
    username: "admin",
    password: process.env.RMQ_PASSWORD,
    vhost: "/",
    authMechnisim: ["PLAIN","AMQPLAIN", "EXTERNAL"]
}

const validBindingKeys = ["paymentSeen", "paymentReceived", "error"]
const validQueue = ["seen", "received", "error"]

class Consumer {

    instance;
    channel;
    conn;
    isInitilized = false;

    initilize = async () => {
        try{
            if(this.isInitilized === false){
                this.conn = await ampq.connect("amqp://localhost:5672");
                this.channel = await this.conn.createChannel();
            }else{
                return;
            }
            await this.consumeMessage("received", "paymentReceived")
            this.isInitilized = true;  
        }catch(e){
            console.log(e)
        }
    }

    static getInstance() {
        if (!this.instance) {
          this.instance = new Consumer();
        }
        return this.instance;
    }

    init = async (network) => {
        const {
          bitcoin: { addresses, fees, transactions },
        } = mempoolJS({
          hostname: "mempool.space",
          network: network,
        });
      
        return { addresses, fees, transactions };
    };

    getStatus = async (txId) => {
        try{
            const {transactions } = await this.init("mainnet");
            let txid = txId ;
            const tx = await transactions.getTx({ txid });
            return  tx.status.confirmed;   
        }catch(e){
            console.log(e.message)
            throw new Error(e.message)
        }
     };
    
    consumeMessage = async (queueName, bindingKey) => {
        try{
            if(!validBindingKeys.includes(bindingKey)){
                return {message: "invalid bindingKey key", status: false}
            }

            let exchangeName = process.env.EXCHANGE_NAME || "inscriptions" 

            //check that exchange exists or create exchange
            await this.channel.assertExchange(exchangeName);

            //check that queue exists or create queue
            let q = await this.channel.assertQueue(queueName)

            //bind queue and exchange
            await this.channel.bindQueue(q.queue, exchangeName, bindingKey)
            await this.channel.prefetch(1)
            
            await this.channel.consume(q.queue, async (msg) => {
                let content = JSON.parse(msg.content.toString()) 
                let status = await this.getStatus(content.txid);
                console.log("[RECEIVED CLIENT]","orderId:",content.orderId, "paymentStatus:", status)
                if(status === true){
                    const type = getType(content.orderId);
                    let inscription;
                    if (type === `single`) {
                      inscription = await Inscription.findOne({ id: content.orderId });
                    } else if (type === `bulk`) {
                      inscription = await BulkInscription.findOne({ id: content.orderId });
                    }

                    if(inscription.inscribed === true) {
                        this.channel.ack(msg)
                    }else{
                        let res = await inscribe({inscriptionId: content.orderId, networkName: content.networkName})
                        console.log(res)
                        if(res.message !== "inscription complete"){
                            await this.channel.publish(exchangeName, "error", Buffer.from(JSON.stringify({id: content.orderId, message: res.message})))
                            this.channel.ack(msg)
                        }else{
                            this.channel.ack(msg)
                        }
                    }
                }else{
                    this.channel.reject(msg, true, false);
                }
            })
        }catch(e){
            console.log(e.message)
        }
    }
} 

module.exports = Consumer.getInstance();


//docker run -d --hostname rabbit --name rabbit-server -p 15672:15672 -p 5672:5672 rabbitmq:3.12.6-management
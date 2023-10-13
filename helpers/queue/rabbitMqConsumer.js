const ampq = require("amqplib")
const mempoolJS = require("@mempool/mempool.js");
const dotenv = require("dotenv").config();
//import inscribe function

const options = {
    protocol: "amqp",
    hostname: process.env.RMQ_HOST || "localhost",
    port: 5672,
    username: "guest",
    password: process.env.RMQ_PASSWORD || "admin",
    vhost: "/",
    authMechnisim: ["PLAIN", "AMQPLAIN", "EXTERNAL"]
}

const validBindingKeys = ["paymentSeen", "error"]

class Consumer {

    instance;
    channel;
    conn;
    isInitilized = false;

    initilize = async () => {
        try{
            if(this.isInitilized === false){
                this.conn = await ampq.connect(options);
                this.channel = await this.conn.createChannel();
            }else{
                return;
            }
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
    
    consumeMessage = async (queueName, bindingKey) => {
        try{
            if(this.isInitilized === false){
                await this.initilize()
            }
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
            await this.channel.prefetch(4)
            
            let data = []
            await this.channel.consume(q.queue, (msg) => {
                let received = JSON.parse(msg.content.toString())
                data.push({content: received, message: msg}) 
            })

            let result =  await Promise.all(data.map(async(x) => {
                let _response
                 //check payment is confirmed
                 let checkPayment = true;
                 if(checkPayment === true){
                     //let inscribe = await inscribe(x.content.inscriptionId, x.content.networkName)
                     //if(inscribe.status === false){
                    //   _response = {message:`order with ID: ${received.orderId}, inscribed`, content:x.content, err: true, inscriptionId:""}
                     //}else{
                     //  _response = {message:`order with ID: ${received.orderId}, not inscribed`, content:x.content, err: false, inscriptionId:inscribe.inscriptionId}
                     //}
                     this.channel.ack(x.message)
                     _response = {message:`order with ID: ${x.content.orderId}, has been handled`, content:x.content, err: true}
                 }else{
                    _response = {message:`order with ID: ${x.content.orderId}, payment not confirmed`, content:x.content, err: false, inscriptionId:""}
                 }
                 
                 return _response
            }))

            let err = []
            let success = []
            result.forEach(async(x) => {
                if(x.err == true){
                    await this.channel.publish(exchangeName,"error", Buffer.from(JSON.stringify(x.content)))
                    err.push(x.content)
                }else{
                    success.push(x.content)
                }
            })

            setTimeout(() => {
                this.conn.close();
            }, 500)

            return {passed: success, failed: err}

        }catch(e){
            console.log(e.message)
            throw new Error(e.message)
        }
    }

    addToQueue = async (data, routingKey) => {
        try{
            if(!this.isInitilized){
                await this.initilize()
            }
            if(!validBindingKeys.includes(routingKey)){
                return {message: "invalid routing key", status: false}
            }
            let message = Buffer.from(JSON.stringify(data))
            let exchangeName = process.env.EXCHANGE_NAME || "inscriptions" 
            await this.channel.assertExchange(exchangeName);
            return {message: "message added to queue", status: await this.channel.publish(exchangeName, routingKey ,message)};
        }catch(e){
            console.log(e.message)
            throw new Error(e.message)
        }
    }

} 

module.exports = Consumer.getInstance();
//queueName, bindingKey
Consumer.getInstance().consumeMessage("seen", "paymentSeen").then(res => console.log(res)).catch()


//docker run -d --hostname rabbit --name rabbit-server -p 15672:15672 -p 5672:5672 rabbitmq:3.12.6-management
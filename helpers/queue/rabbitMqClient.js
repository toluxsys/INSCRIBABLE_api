const ampq = require("amqplib")
const dotenv = require("dotenv").config()

const options = {
    protocol: "amqp",
    hostname: process.env.RMQ_HOST,
    port: 5672,
    username: "admin",
    password: process.env.RMQ_PASSWORD,
    vhost: "/",
    authMechnisim: ["PLAIN", "AMQPLAIN", "EXTERNAL"]
}

const validRoutingKeys = ["paymentSeen", "paymentReceived", "error"]
const validQueue = ["seen", "received", "error"]

class RabbitMqClient {

    instance;
    channel;
    isInitilized = false;

    initilize = async () => {
        try{
            if(this.isInitilized === false){
                const _conn = await ampq.connect("amqp://localhost:5672");
                this.channel = await _conn.createChannel();
            }else{
                return;
            }
            //await this.consumeMessage("error", "error")
            this.isInitilized = true; 
            console.log("Channel Initilized...")  
        }catch(e){
            console.log(e)
        }
    }

    static getInstance() {
        if (!this.instance) {
          this.instance = new RabbitMqClient();
        }
        return this.instance;
    }

    addToQueue = async (data, routingKey) => {
        try{
            if(!this.isInitilized){
                await this.initilize()
            }
            if(!validRoutingKeys.includes(routingKey)){
                return {message: "invalid routing key", status: false}
            }
            let message = Buffer.from(JSON.stringify(data))
            let exchangeName = process.env.EXCHANGE_NAME || "inscriptions" 
            await this.channel.assertExchange(exchangeName);
            return {message: "message added to queue", status: await this.channel.publish(exchangeName, routingKey ,message)};
        }catch(e){
            console.log(e.message)
        }
    }

    // consumeMessage = async (queueName, bindingKey) => {
    //     try{
    //         let exchangeName = process.env.EXCHANGE_NAME || "inscriptions" 
    //         await this.channel.assertExchange(exchangeName);
    //         let q = await this.channel.assertQueue(queueName)
    //         await this.channel.bindQueue(q.queue, exchangeName, bindingKey)
    //         await this.channel.consume(q.queue, (msg) => {
    //             let received = JSON.parse(msg.content.toString())
    //             this.channel.ack(msg)
    //             console.log(received)
    //         })
    //     }catch(e){
    //         console.log(e.message)
    //     }
    // }
} 

module.exports = RabbitMqClient.getInstance();

//let producer = Producer.getInstance();

//producer.addToQueue({message: "testing rabbit mq"}, "paymentSeen").then(res => console.log(res)).catch()

//docker run -d --hostname rabbit --name rabbit-server -p 15672:15672 -p 5672:5672 rabbitmq:3.12.6-management
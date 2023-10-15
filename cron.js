const cron = require("node-cron")
const shell = require("shelljs")
const dotenv = require("dotenv").config();

const initCron = () => {
    cron.schedule(process.env.CRON_SCHEDULE, function(){
        console.log("running cron job...")
        let workDir = process.cwd()
        shell.exec(`node ${workDir}/helpers/queue/rabbitMqConsumer.js`)
    })
}
module.exports = {initCron};


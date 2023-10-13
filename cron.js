const cron = require("node-cron")
const shell = require("shelljs")

cron.schedule("* * * * *", function(){
    console.log("running cron job...")
    let workDir = process.cwd()
    shell.exec(`node ${workDir}/helpers/queue/rabbitMqConsumer.js`)
})
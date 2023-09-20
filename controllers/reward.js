//users get points for completing task
//users are tracked by address
//useres can redeem points for prices linked to codes: each cupon code has details of the reward the user is tring to redeem

const Task = require("../model/task")
const UserReward = require("../model/userReward")
const Claim = require("../model/claims")
const { v4: uuidv4 } = require("uuid");

module.exports.perform_task = async (address, taskId) => {
    try{
        //if address has not been added add it to user reward list
        //increase point on user reward 
        //add task to user reward array
        let task = await Task.findOne({taskId: taskId})
        let reward = await UserReward.findOne({address: address});
        if (!reward) {
            let _taskId = [];
            _taskId.push(task._id)
            reward = new UserReward({address: address, totalPoints: task.taskPoints, taskIds: _taskId})
        };
        let points = reward.totalPoints + task.taskPoints;
        let savedReward = await UserReward.findOneAndUpdate({address: address}, {$set: {points: points}}, {$push: {taskIds: task._id}}, {new: true})
        return savedReward;
    }catch(e){
        comsole.log(e.message)
    }
}

//TODO: finish the method and import to inscribe function
const claimReward = async (req, res) => {
    try{
        //this function is used by the inscription function
        //allows user to use the reduced inscription cost claim or free sat claim
    }catch(e){
        comsole.log(e.message)
    }
}

module.exports.addTask = async (req, res) => {
    try{
        const {taskName, points} = req.body
        if(!taskName) return res.status(200).json({status: false, message: "task name is required"})
        if(!points) return res.status(200).json({status: false, message: "points is required"})
        let tasks = await Task.find({})
        let taskId = tasks.length + 1
        let task = new Task({
            taskId: taskId,
            taskName: taskName,
            taskPoints: points,
            status: "active"
        })
        let savedTask = await task.save()
        return res.status(200).json({status: true, message: "Task saved", userResponse: savedTask})
    }catch(e){
        comsole.log(e.message)
        return res.status(500).json({status:false, message: e.message})
    }
}

module.exports.addClaim = async (req, res) => {
    try{
        const {description, info, claimPoint} = req.body
        if(!description) return res.status(200).json({status: false, message: "description is required"})
        if(!claimPoint) return res.status(200).json({status: false, message: "claimPoint is required"})
        let claims = await Claim.find({})
        let claimId = claims.length + 1
        let claim = new Claim({
            claimId: claimId,
            description: description,
            info: info,
            claimPoint: claimPoint,
            status: "active"
        })
        let savedClaim = await claim.save()
        return res.status(200).json({status: true, message: "claim saved", userResponse: savedClaim})
    }catch(e){
        comsole.log(e.message)
        return res.status(500).json({status:false, message: e.message})
    }
}

module.exports.removeTask = async (req, res) => {
    try{
        const {taskId} = req.body
        if(!taskId) return res.status(200).json({status: false, message: "taskId is required"})
        let updateTask = await Task.findOneAndUpdate({taskId: taskId}, {$set: {status: "inactive"}}, {new: true});
        return res.status(200).json({status: true, message: "task removed", userResponse: updateTask});
    }catch(e){
        comsole.log(e.message)
        return res.status(500).json({status:false, message: e.message})
    }
}

module.exports.removeClaim = async (req, res) => {
    try{
        const {claimId} = req.body
        if(!claimId) return res.status(200).json({status: false, message: "claimId is required"})
        let updateClaim = await Task.findOneAndUpdate({claimId: claimId}, {$set: {status: "inactive"}}, {new: true});
        return res.status(200).json({status: true, message: "claim removed", userResponse: updateClaim});
    }catch(e){
        comsole.log(e.message)
        return res.status(500).json({status:false, message: e.message})
    }
}

module.exports.performTask = async (req, res) => {
    try{
        const {address, taskId} = req.body
        let savedReward = await perform_task(address, taskId);
        return res.status(200).json({status: true, message: "task complete", userResponse: savedReward})
    }catch(e){
        comsole.log(e.message)
        return res.status(500).json({status:false, message: e.message})
    }
}

module.exports.redeem = async (req, res) => {
    try{
        const {address, claimId} = req.body
        let userReward = await UserReward.findOne({address: address})
        let claim = await Claim.findOne({claimId: claimId})
        if (!claim) return res.status(200).json({status: false, message: "invalid claim id"})
        if (claim.status !== `active`) return res.status(200).json({status: false, message: `claim is inactive`})
        if (!userReward) return res.status(200).json({status: false, message: `address has no reward point`})
        if (userReward.totalPoints < claim.claimPoint) return res.status(200).json({status: false, message: `not enough points to redeem claim. n\ Total Point: ${userReward.totalPoints}`})
        //claim code: insc-claimId-uuid
        let claimCode = `insc-${claimId}-${uuidv4()}`
        let points = userReward.totalPoints - claim.claimPoint
        await userReward.save()
        await UserReward.findByIdAndUpdate({address: address}, {$set: {totalPoints: points}}, {$push: {claimCode: claimCode}}, {new: true})
        await Claim.findOneAndUpdate({claimId: claimId}, {$push: {claimCode: claimCode}}, {new: true})
        return res.status(200).json({status: true, message: "claim code generated", userResponse: claimCode})
    }catch(e){
        comsole.log(e.message)
        return res.status(500).json({status:false, message: e.message})
    }
}

module.exports.claim = async (req, res) => {
    try{
        const {address, claimCode} = req.body
        let claimId = parseInt(claimCode.split("-")[1])
        let userReward = await UserReward.findOne({address: address})
        let claim = await Claim.findOne({claimId: claimId})
        if (!claim) return res.status(200).json({status: false, message: "invalid code"})
        if (claim.status !== `active`) return res.status(200).json({status: false, message: `claim is inactive`})
        if (!userReward) return res.status(200).json({status: false, message: `address has no reward point`})
        if (!userReward.claimCode.includes(claimCode)) return res.status(200).json({status: false, message: "address not valid for code"})
        if (claim.usedClaimCode.includes(claimCode)) return res.status(200).json({status: false, message: "code has been used"})
        if (!claim.claimCode.includes(claimCode)) return res.status(200).json({status: false, message: "invalid code"})
        await Claim.findOneAndUpdate({claimId: claimId}, {$push: {usedClaimCode: claimCode}}, {new: true})
        return res.status(200).json({status: true, message: "claim successful", userResponse: true})
    }catch(e){
        comsole.log(e.message)
        return res.status(500).json({status:false, message: e.message})
    }
}

module.exports.getClaims = async (req, res) => {
    try{
        let claims  = await Claim.find({});
        let active = []
        claims.forEach(claim => {
            let data = {
                claimId: claim.claimId,
                status: claim.status,
                description: claim.description,
                info: claim.info,
                claimPoint: claim.claimPoint
            }
            if (claim.status == "active") active.push(data)
        })
        return res.status(200).json({status: true, message: "active claims", userResponse: active});
    }catch(e){
        comsole.log(e.message)
        return res.status(500).json({status:false, message: e.message})
    }
}

module.exports.getTasks = async (req, res) => {
    try{
        let tasks  = await Task.find({});
        let active = []
        tasks.forEach(task => {
            let data = {
                taskId: task.taskId,
                status: task.status,
                description: task.description,
                info: task.info,
                taskPoints: task.taskPoints
            }
            if (task.status == "active") active.push(data)
        })
        return res.status(200).json({status: true, message: "active tasks", userResponse: active});
    }catch(e){
        comsole.log(e.message)
        return res.status(500).json({status:false, message: e.message})
    }
}

module.exports.getUserReward = async (req, res) => {
    try{
        const {address} = req.body
        let reward  = await UserReward.findOne({address: address});
        if (!reward) return res.status(200).json({status: false, message: "address has no reward point"})
        return res.status(200).json({status: true, message: "address reward", userResponse: reward});
    }catch(e){
        comsole.log(e.message)
        return res.status(500).json({status:false, message: e.message})
    }
}



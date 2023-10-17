//users get points for completing task
//users are tracked by address
//useres can redeem points for prices linked to codes: each cupon code has details of the reward the user is tring to redeem

const Task = require("../model/task")
const UserReward = require("../model/userReward")
const Claim = require("../model/claims")
const { v4: uuidv4 } = require("uuid");


//claim = reward
module.exports.perform_task = async (address, taskId) => {
    try{
        //if address has not been added add it to user reward list
        //increase point on user reward 
        //add task to user reward array
        let task = await Task.findOne({taskId: taskId})
        let reward = await UserReward.findOne({address: address});
        let savedReward
        if (!reward) {
            let _taskId = [];
            _taskId.push(task._id)
            let newReward = new UserReward({address: address, totalPoints: task.taskPoints, taskIds: _taskId})
            await newReward.save()
            savedReward = {
                status: true,
                data: newReward,
                message: "point claimed"
            }
        }else{
            if(task.taskName === "checkIn"){
                let validCheckIn = await canCheckIn({address})
                if(validCheckIn.status === false){
                    savedReward = {status: false, message: "last check was less than 24 hours",  data: reward}
                }else{
                    let points = reward.totalPoints + task.taskPoints;
                    let updateReward = await UserReward.findOneAndUpdate({address: address}, {$set: {points: points}}, {$push: {taskIds: task._id}}, {new: true})
                    savedReward = {status: true, message: "point claimed",  data: updateReward}
                }
            }else{
                let points = reward.totalPoints + task.taskPoints;
                let updateReward = await UserReward.findOneAndUpdate({address: address}, {$set: {points: points}}, {$push: {taskIds: task._id}}, {new: true})
                savedReward = {status: true, message: "point claimed",  data: updateReward}
            }
        };
        return savedReward;
    }catch(e){
        comsole.log(e.message)
    }
}

const canCheckIn = async ({address}) => {
    try{
        let userReward = await UserReward.findOne({address: address})
        const currentTime = moment();
        const timeDifference = currentTime.diff(userReward.lastCheckIn , 'hours');
        const duration = 24;
        if(timeDifference < duration){
            return {
                message: "last checkin was less than 24 hours",
                status:false,
                data: {
                    totalPoints: userReward.totalPoints,
                    lastCheckIn: userReward.lastCheckIn
                }
            }
        }else{
            return {
                message: "valid checkIn",
                status:true,
                data: {
                    totalPoints: userReward.totalPoints,
                    lastCheckIn: userReward.lastCheckIn
                }
            }
        }
    }catch(e){
        console.log(e.message)
    }
}

module.exports.claimCheckinPoints = async ({address}) => {
    try{
        let task = await Task.findOne({taskName: "checkIn"})
        let validCheckIn = await canCheckIn({address: address})
        let result
        if(validCheckIn.status === true){
            result = await perform_task(address, task.taskId).totalPoints
            return res.status(200).json({status: true, message: "scribe points claimed", data: {totalPoints: result.totalPoints}})
        }else{
            return res.status(200).json({status: false, message: "last checkin was less than 24 hours", data: {totalPoints: result.totalPoints}})
        } 
    }catch(e){
        comsole.log(e.message)
    }
}

module.exports.addTask = async ({taskName, points}) => {
    try{
        if(!taskName) return res.status(200).json({status: false, message: "task name is required"})
        if(!points) return {status: false, message: "points is required"}
        let tasks = await Task.find({})
        let taskId = tasks.length + 1
        let task = new Task({
            taskId: taskId,
            taskName: taskName,
            taskPoints: points,
            status: "active"
        })
        let savedTask = await task.save()
        return {status: true, message: "Task saved", userResponse: savedTask}
    }catch(e){
        comsole.log(e.message)
        return {status:false, message: e.message}
    }
}

module.exports.addClaim = async ({description, info, claimPoint}) => {
    try{
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
        return {status: true, message: "claim saved", userResponse: savedClaim}
    }catch(e){
        comsole.log(e.message)
        return {status:false, message: e.message}
    }
}

module.exports.removeTask = async ({taskId}) => {
    try{
        if(!taskId) return {status: false, message: "taskId is required"}
        let updateTask = await Task.findOneAndUpdate({taskId: taskId}, {$set: {status: "inactive"}}, {new: true});
        return {status: true, message: "task removed", userResponse: updateTask};
    }catch(e){
        comsole.log(e.message)
        return {status:false, message: e.message}
    }
}

module.exports.removeClaim = async ({claimId}) => {
    try{
        if(!claimId) return {status: false, message: "claimId is required"}
        let updateClaim = await Task.findOneAndUpdate({claimId: claimId}, {$set: {status: "inactive"}}, {new: true});
        return {status: true, message: "claim removed", userResponse: updateClaim};
    }catch(e){
        comsole.log(e.message)
        return {status:false, message: e.message}
    }
}

module.exports.performTask = async ({address, taskId}) => {
    try{
        let savedReward = await perform_task(address, taskId);
        return {status: true, message: "task complete", userResponse: savedReward}
    }catch(e){
        comsole.log(e.message)
        return {status:false, message: e.message}
    }
}

module.exports.redeemPoints = async ({address, claimId}) => {
    try{
        let userReward = await UserReward.findOne({address: address})
        let claim = await Claim.findOne({claimId: claimId})
        if (!claim) return {status: false, message: "invalid claim id"}
        if (claim.status !== `active`) return {status: false, message: `claim is inactive`}
        if (!userReward) return {status: false, message: `address has no reward point`}
        if (userReward.totalPoints < claim.claimPoint) return {status: false, message: `not enough points to redeem claim. n\ Total Point: ${userReward.totalPoints}`}
        //claim code: insc-claimId-uuid
        let claimCode = `insc-${claimId}-${uuidv4()}`
        let points = userReward.totalPoints - claim.claimPoint
        await userReward.save()
        await UserReward.findByIdAndUpdate({address: address}, {$set: {totalPoints: points}}, {$push: {claimCode: claimCode}}, {new: true})
        await Claim.findOneAndUpdate({claimId: claimId}, {$push: {claimCode: claimCode}}, {new: true})
        return {status: true, message: "claim code generated", userResponse: claimCode}
    }catch(e){
        comsole.log(e.message)
        return {status:false, message: e.message}
    }
}

module.exports.redeemPointsForInscription = async ({address, count}) => {
    try{
        let inscriptionPoint = 1000 * count;
        let userReward = await UserReward.findOne({address: address})
        if (!userReward) return {status: false, message: `address has no reward point`}
        if (userReward.totalPoints < inscriptionPoint) return {status: false, message: `not enough points to redeem claim. n\ Total Point: ${userReward.totalPoints}`}
        let points = userReward.totalPoints - inscriptionPoint
        await userReward.save()
        await UserReward.findByIdAndUpdate({address: address}, {$set: {totalPoints: points}}, {new: true})
        return {status: true, message: "claim code generated"}
    }catch(e){
        comsole.log(e.message)
        return {status:false, message: e.message}
    }
}

module.exports.claim = async ({address, claimCode}) => {
    try{
        let claimId = parseInt(claimCode.split("-")[1])
        let userReward = await UserReward.findOne({address: address})
        let claim = await Claim.findOne({claimId: claimId})
        if (!claim) return {status: false, message: "invalid code"}
        if (claim.status !== `active`) return {status: false, message: `claim is inactive`}
        if (!userReward) return {status: false, message: `address has no reward point`}
        if (!userReward.claimCode.includes(claimCode)) return {status: false, message: "address not valid for code"}
        if (claim.usedClaimCode.includes(claimCode)) return {status: false, message: "code has been used"}
        if (!claim.claimCode.includes(claimCode)) return {status: false, message: "invalid code"}
        await Claim.findOneAndUpdate({claimId: claimId}, {$push: {usedClaimCode: claimCode}}, {new: true})
        return {status: true, message: "claim successful", userResponse: true}
    }catch(e){
        comsole.log(e.message)
        return {status:false, message: e.message}
    }
}

module.exports.getClaims = async () => {
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
        return {status: true, message: "active claims", userResponse: active};
    }catch(e){
        comsole.log(e.message)
        return res.status(500).json({status:false, message: e.message})
    }
}

module.exports.getTasks = async () => {
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
        return {status: true, message: "active tasks", userResponse: active};
    }catch(e){
        comsole.log(e.message)
        return {status:false, message: e.message}
    }
}

module.exports.getUserReward = async ({address}) => {
    try{
        let reward  = await UserReward.findOne({address: address});
        if (!reward) return {status: false, message: "address has no reward point"}
        return {status: true, message: "address reward", userResponse: reward};
    }catch(e){
        comsole.log(e.message)
        return {status:false, message: e.message}
    }
}



//users get points for completing task
//users are tracked by address
//useres can redeem points for prices linked to codes: each cupon code has details of the reward the user is tring to redeem

const Task = require("../model/task")
const UserReward = require("../model/userReward")
const Claim = require("../model/claims")
const { v4: uuidv4 } = require("uuid");


//claim = reward
const redeemPointsForInscription = async ({address, count}) => {
    try{
        let claim = await claim.findOne({claimId: 1})
        let claimHistory = {
            claimId: 1,
            createdAt: Date.now(),
            claimCode: "inscription"
        }
        let inscriptionPoint = claim.claimPoints * count
        let userReward = await UserReward.findOne({address: address})
        if (!userReward) return {status: false, message: `address has no reward point`}
        if (userReward.totalPoints < inscriptionPoint) return {status: false, message: `not enough points to redeem claim. Total Point: ${userReward.totalPoints}`}
        userReward.totalPoints = userReward.totalPoints - inscriptionPoint
        userReward.claimHistory.push(claimHistory)
        await userReward.save()
        return {status: true, message: "inscription claim complete"}
    }catch(e){
        comsole.log(e.message)
        return {status:false, message: e.message}
    }
}

const perform_task = async (address, taskId) => {
    try{
        //if address has not been added add it to user reward list
        //increase point on user reward 
        //add task to user reward array
        let task = await Task.findOne({taskId:taskId})
        if(!task) return {status: false, message: "invalid task id"}
        if(task.status == "inactive") return {status: false, message: "task is inactive"}
        let taskHistory = {
            taskId: task.taskId,
            createdAt: Date.now()
        }
        
        let reward = await UserReward.findOne({address: address});
        let savedReward
        if (!reward) {
            if(task.taskName !== "checkIn"){
                let hist = [];
                hist.push(taskHistory)
                let newReward = new UserReward({address: address, totalPoints: task.taskPoints, taskHistory: hist})
                await newReward.save()
                savedReward = {
                    status: true,
                    data: newReward,
                    message: "point claimed"
                }
            }else{
                let hist = [];
                hist.push(taskHistory)
                let newReward = new UserReward({address: address, totalPoints: task.taskPoints, taskHistory: hist, lastCheckIn: Date.now(), checkInCount: 1})
                await newReward.save()
                savedReward = {
                    status: true,
                    data: newReward,
                    message: "point claimed"
                }
            }
            
        }else{
            if(task.taskName === "checkIn"){
                let validCheckIn = await canCheckIn({address})
                if(validCheckIn.status === false){
                    savedReward = {status: false, message: "last check was less than 24 hours",  data: reward}
                }else{
                    reward.totalPoints = reward.totalPoints + task.taskPoints;
                    reward.lastCheckIn = Date.now()
                    reward.checkInCount = reward.checkInCount + 1
                    reward.taskHistory.push(taskHistory)
                    let updateReward = await reward.save();
                    savedReward = {status: true, message: "point claimed",  data: updateReward}
                }
            }else{
                reward.totalPoints = reward.totalPoints + task.taskPoints;
                reward.taskHistory.push(taskHistory)
                let updateReward = await reward.save();
                savedReward = {status: true, message: "point claimed",  data: updateReward}
            }
        };
        return savedReward;
    }catch(e){
        console.log(e.message)
    }
}

const addTask = async ({taskName, points, info, description}) => {
    try{
        if(!taskName) return {status: false, message: "task name is required"}
        if(!points) return {status: false, message: "points is required"}
        let tasks = await Task.find({})
        let taskId = tasks.length + 1
        let task = new Task({
            taskId: taskId,
            taskName: taskName,
            taskPoints: points,
            info: info,
            description: description,
            status: "active"
        })
        let savedTask = await task.save()
        return {status: true, message: "Task saved", userResponse: savedTask}
    }catch(e){
        comsole.log(e.message)
    }
}

const addClaim = async ({description, info, claimPoint}) => {
    try{
        if(!description) return {status: false, message: "description is required"}
        if(!claimPoint) return {status: false, message: "claimPoint is required"}
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
    }
}

const removeTask = async ({taskId}) => {
    try{
        if(!taskId) return {status: false, message: "taskId is required"}
        let task = await Task.findOne({taskId:taskId})
        if(!task) return res.status(200).json({status: false, message: "invalid task id"})
        if(task.status == "inactive") return {status: false, message: "task already inactive"}
        task.status = "inactive"
        let updateTask = await task.save()
        return {status: true, message: "task removed", userResponse: updateTask};
    }catch(e){
        comsole.log(e.message)
    }
}

const removeClaim = async ({rewardId}) => {
    try{
        if(!rewardId) return res.status(200).json({status: false, message: "rewardId is required"})
        let claim = await Claim.findOne({claimId: rewardId})
        if(!claim) return {status: false, message: "invalid reward id"}
        if(claim.status == "inactive") return {status: false, message: "reward already inactive"}
        claim.status = "inactive"
        let updateClaim = await claim.save()
        return {status: true, message: "claim removed", data: updateClaim};
    }catch(e){
        console.log(e.message)
    }
}

const performTask = async ({address, taskId}) => {
    try{
        let result = await perform_task(address, taskId);
        return result 
    }catch(e){
        console.log(e)
        return res.status(500).json({status:false, message: e.message})
    }
}

const canCheckIn = async ({address}) => {
    try{
        let userReward = await UserReward.findOne({address: address})
        if(!userReward){
            return {
                message: "valid checkIn",
                status:true,
                data: {
                    totalPoints: 0,
                    lastCheckIn: Date.now()
                }
            }
        }
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

const claimCheckinPoints = async ({address}) => {
    try{
        let task = await Task.findOne({taskName: "checkIn"})
        let validCheckIn = await canCheckIn({address: address})
        let result
        if(validCheckIn.status === true){
            result = await perform_task(address, task.taskId)
            return {status: true, message: "scribe points claimed", data: {totalPoints: result.data.totalPoints, lastCheckIn:result.data.lastCheckIn}}
        }else{
            result = await perform_task(address, task.taskId)
            return {status: false, message: "last checkin was less than 24 hours", data: {totalPoints: result.data.totalPoints, lastCheckIn:result.data.lastCheckIn }}
        } 
    }catch(e){
        console.log(e)
    }
}

const redeemPoints = async ({address, rewardId}) => {
    try{
        let userReward = await UserReward.findOne({address: address})
        let claim = await Claim.findOne({claimId: rewardId})
        if (!claim) return {status: false, message: "invalid claim id"}
        if (claim.status !== `active`) return {status: false, message: `claim is inactive`}
        if (!userReward) return {status: false, message: `address has no reward point`}
        if (userReward.totalPoints < claim.claimPoint) return {status: false, message: `not enough points to redeem claim. Total Point: ${userReward.totalPoints}`}

        //claim code: insc-claimId-uuid
        let claimCode = `insc-${rewardId}-${uuidv4()}`
        let claimHistory = {
            rewardId: rewardId,
            createdAt: Date.now(),
            claimCode: claimCode,
        }
        claim.claimCode.push(claimCode)
        userReward.claimCode.push(claimCode)
        userReward.totalPoints = userReward.totalPoints - claim.claimPoint
        userReward.claimHistory.push(claimHistory)
        await claim.save()
        await userReward.save()
        return {status: true, message: "claim code generated", userResponse: claimCode}
    }catch(e){
        console.log(e)
        return res.status(500).json({status:false, message: e.message})
    }
}

const redeemClaimCode = async ({address, claimCode}) => {
    try{
        let claimId = parseInt(claimCode.split("-")[1])
        let userReward = await UserReward.findOne({address: address})
        let claim = await Claim.findOne({claimId: claimId})
        if (!claim) return {status: false, message: "invalid code"}
        if (claim.status !== `active`) return {status: false, message: `reward is inactive`}
        if (!userReward) return {status: false, message: `address has no reward point`}
        if (!userReward.claimCode.includes(claimCode)) return {status: false, message: "address not valid for code"}
        if (claim.usedClaimCode.includes(claimCode)) return {status: false, message: "code has been used"}
        if (!claim.claimCode.includes(claimCode)) return {status: false, message: "invalid code"}
        await Claim.findOneAndUpdate({claimId: claimId}, {$push: {usedClaimCode: claimCode}}, {new: true})
        return {status: true, message: "claim successful", userResponse: true}
    }catch(e){
        console.log(e.message)
    }
}

const getClaims = async () => {
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
        return {status: true, message: "active rewards", userResponse: active};
    }catch(e){
        console.log(e.message)
    }
}

const getTasks = async () => {
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
        console.log(e.message)
    }
}

const getUserReward = async ({address}) => {
    try{
        const {address} = req.body
        let reward  = await UserReward.findOne({address: address});
        if (!reward) return {status: false, message: "address has no reward point"}
        return {status: true, message: "address reward", userResponse: reward};
    }catch(e){
        console.log(e.message)
    }
}

module.exports = {redeemPointsForInscription, perform_task, addTask, addClaim, removeTask, removeClaim, performTask, claimCheckinPoints, redeemPoints, redeemClaimCode, getClaims, getTasks, getUserReward}





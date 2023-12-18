/* eslint-disable no-lonely-if */
// users get points for completing task
// users are tracked by address
// useres can redeem points for prices linked to codes: each cupon code has details of the reward the user is tring to redeem
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const Task = require('../model/task');
const UserReward = require('../model/userReward');
const Claim = require('../model/claims');

// claim = reward
const redeemPointsForInscription = async ({ address, count }) => {
  try {
    const claim = await claim.findOne({ claimId: 1 });
    const claimHistory = {
      claimId: 1,
      createdAt: Date.now(),
      claimCode: 'inscription',
    };
    const inscriptionPoint = claim.claimPoints * count;
    const userReward = await UserReward.findOne({ address });
    if (!userReward)
      return { status: false, message: `address has no reward point` };
    if (userReward.totalPoints < inscriptionPoint)
      return {
        status: false,
        message: `not enough points to redeem claim. Total Point: ${userReward.totalPoints}`,
      };
    userReward.totalPoints -= inscriptionPoint;
    userReward.claimHistory.push(claimHistory);
    await userReward.save();
    return { status: true, message: 'inscription claim complete' };
  } catch (e) {
    console.log(e.message);
    return { status: false, message: e.message };
  }
};

const perform_task = async (address, taskId) => {
  try {
    // if address has not been added add it to user reward list
    // increase point on user reward
    // add task to user reward array
    const task = await Task.findOne({ taskId });
    if (!task) return { status: false, message: 'invalid task id' };
    if (task.status === 'inactive')
      return { status: false, message: 'task is inactive' };
    const taskHistory = {
      taskId: task.taskId,
      createdAt: Date.now(),
    };

    const reward = await UserReward.findOne({ address });
    let savedReward;
    if (!reward) {
      if (task.taskName !== 'checkIn') {
        const hist = [];
        hist.push(taskHistory);
        const newReward = new UserReward({
          address,
          totalPoints: task.taskPoints,
          taskHistory: hist,
        });
        await newReward.save();
        savedReward = {
          status: true,
          data: newReward,
          message: 'point claimed',
        };
      } else {
        const hist = [];
        hist.push(taskHistory);
        const newReward = new UserReward({
          address,
          totalPoints: task.taskPoints,
          taskHistory: hist,
          lastCheckIn: Date.now(),
          checkInCount: 1,
        });
        await newReward.save();
        savedReward = {
          status: true,
          data: newReward,
          message: 'point claimed',
        };
      }
    } else {
      if (task.taskName === 'checkIn') {
        const validCheckIn = await canCheckIn({ address });
        if (validCheckIn.status === false) {
          savedReward = {
            status: false,
            message: 'last check was less than 24 hours',
            data: reward,
          };
        } else {
          reward.totalPoints += task.taskPoints;
          reward.lastCheckIn = Date.now();
          reward.checkInCount += 1;
          reward.taskHistory.push(taskHistory);
          const updateReward = await reward.save();
          savedReward = {
            status: true,
            message: 'point claimed',
            data: updateReward,
          };
        }
      } else {
        reward.totalPoints += task.taskPoints;
        reward.taskHistory.push(taskHistory);
        const updateReward = await reward.save();
        savedReward = {
          status: true,
          message: 'point claimed',
          data: updateReward,
        };
      }
    }
    return savedReward;
  } catch (e) {
    console.log(e.message);
  }
};

const addTask = async ({ taskName, points, info, description }) => {
  try {
    if (!taskName) return { status: false, message: 'task name is required' };
    if (!points) return { status: false, message: 'points is required' };
    const tasks = await Task.find({});
    const taskId = tasks.length + 1;
    const task = new Task({
      taskId,
      taskName,
      taskPoints: points,
      info,
      description,
      status: 'active',
    });
    const savedTask = await task.save();
    return { status: true, message: 'Task saved', userResponse: savedTask };
  } catch (e) {
    console.log(e.message);
  }
};

const addClaim = async ({ description, info, claimPoint }) => {
  try {
    if (!description)
      return { status: false, message: 'description is required' };
    if (!claimPoint)
      return { status: false, message: 'claimPoint is required' };
    const claims = await Claim.find({});
    const claimId = claims.length + 1;
    const claim = new Claim({
      claimId,
      description,
      info,
      claimPoint,
      status: 'active',
    });
    const savedClaim = await claim.save();
    return savedClaim;
  } catch (e) {
    console.log(e.message);
  }
};

const removeTask = async ({ taskId }) => {
  try {
    if (!taskId) return { status: false, message: 'taskId is required' };
    const task = await Task.findOne({ taskId });
    if (!task) return { status: false, message: 'invalid task id' };
    if (task.status === 'inactive')
      return { status: false, message: 'task already inactive' };
    task.status = 'inactive';
    const updateTask = await task.save();
    return { status: true, message: 'task removed', userResponse: updateTask };
  } catch (e) {
    console.log(e.message);
  }
};

const removeClaim = async ({ rewardId }) => {
  try {
    if (!rewardId) return { status: false, message: 'rewardId is required' };
    const claim = await Claim.findOne({ claimId: rewardId });
    if (!claim) return { status: false, message: 'invalid reward id' };
    if (claim.status === 'inactive')
      return { status: false, message: 'reward already inactive' };
    claim.status = 'inactive';
    const updateClaim = await claim.save();
    return { status: true, message: 'claim removed', data: updateClaim };
  } catch (e) {
    console.log(e.message);
  }
};

const performTask = async ({ address, taskId }) => {
  try {
    const result = await perform_task(address, taskId);
    return result;
  } catch (e) {
    console.log(e);
  }
};

const canCheckIn = async ({ address }) => {
  try {
    const userReward = await UserReward.findOne({ address });
    if (!userReward) {
      return {
        message: 'valid checkIn',
        status: true,
        data: {
          totalPoints: 0,
          lastCheckIn: Date.now(),
        },
      };
    }
    const currentTime = moment();
    const timeDifference = currentTime.diff(userReward.lastCheckIn, 'hours');
    const duration = 24;
    if (timeDifference < duration) {
      return {
        message: 'last checkin was less than 24 hours',
        status: false,
        data: {
          totalPoints: userReward.totalPoints,
          lastCheckIn: userReward.lastCheckIn,
        },
      };
    }
    return {
      message: 'valid checkIn',
      status: true,
      data: {
        totalPoints: userReward.totalPoints,
        lastCheckIn: userReward.lastCheckIn,
      },
    };
  } catch (e) {
    console.log(e.message);
  }
};

const claimCheckinPoints = async ({ address }) => {
  try {
    const task = await Task.findOne({ taskName: 'checkIn' });
    const validCheckIn = await canCheckIn({ address });
    let result;
    if (validCheckIn.status === true) {
      result = await perform_task(address, task.taskId);
      return {
        status: true,
        message: 'scribe points claimed',
        data: {
          totalPoints: result.data.totalPoints,
          lastCheckIn: result.data.lastCheckIn,
        },
      };
    }
    // result = await perform_task(address, task.taskId);
    return {
      status: false,
      message: 'last checkin was less than 24 hours',
      data: {
        totalPoints: result.data.totalPoints,
        lastCheckIn: result.data.lastCheckIn,
      },
    };
  } catch (e) {
    console.log(e);
  }
};

// rewardId and claimId are the same
const redeemPoints = async ({ address, rewardId }) => {
  try {
    const userReward = await UserReward.findOne({ address });
    const claim = await Claim.findOne({ claimId: rewardId });
    if (!claim) return { status: false, message: 'invalid claim id' };
    if (claim.status !== `active`)
      return { status: false, message: `claim is inactive` };
    if (!userReward)
      return { status: false, message: `address has no reward point` };
    if (userReward.totalPoints < claim.claimPoint)
      return {
        status: false,
        message: `not enough points to redeem claim. Total Point: ${userReward.totalPoints}`,
      };

    // claim code: insc-claimId-uuid
    const claimCode = `insc-${rewardId}-${uuidv4()}`;
    const claimHistory = {
      rewardId,
      createdAt: Date.now(),
      claimCode,
    };
    claim.claimCode.push(claimCode);
    userReward.claimCode.push(claimCode);
    userReward.totalPoints -= claim.claimPoint;
    userReward.claimHistory.push(claimHistory);
    await claim.save();
    await userReward.save();
    return {
      status: true,
      message: 'claim code generated',
      userResponse: claimCode,
    };
  } catch (e) {
    console.log(e);
  }
};

const redeemClaimCode = async ({ address, claimCode }) => {
  try {
    const claimId = parseInt(claimCode.split('-')[1]);
    const userReward = await UserReward.findOne({ address });
    const claim = await Claim.findOne({ claimId });
    if (!claim) return { status: false, message: 'invalid code' };
    if (claim.status !== `active`)
      return { status: false, message: `reward is inactive` };
    if (!claim.claimCode.includes(claimCode))
      return { status: false, message: 'invalid code' };
    if (!userReward)
      return { status: false, message: `address has no reward point` };
    if (!userReward.claimCode.includes(claimCode))
      return { status: false, message: 'address not valid for code' };
    if (claim.usedClaimCode.includes(claimCode))
      return { status: false, message: 'code has been used' };
    await Claim.findOneAndUpdate(
      { claimId },
      { $push: { usedClaimCode: claimCode } },
      { new: true },
    );
    return { status: true, message: 'claim successful', userResponse: true };
  } catch (e) {
    console.log(e.message);
  }
};

const getClaims = async () => {
  try {
    const claims = await Claim.find({});
    const active = [];
    claims.forEach((claim) => {
      if (claim.status === 'active') {
        const data = {
          claimId: claim.claimId,
          status: claim.status,
          description: claim.description,
          info: claim.info,
          claimPoint: claim.claimPoint,
        };
        active.push(data);
      }
    });
    return { status: true, message: 'active rewards', userResponse: active };
  } catch (e) {
    console.log(e.message);
  }
};

const getTasks = async () => {
  try {
    const tasks = await Task.find({});
    const active = [];
    tasks.forEach((task) => {
      const data = {
        taskId: task.taskId,
        status: task.status,
        description: task.description,
        info: task.info,
        taskPoints: task.taskPoints,
      };
      if (task.status === 'active') active.push(data);
    });
    return { status: true, message: 'active tasks', userResponse: active };
  } catch (e) {
    console.log(e.message);
  }
};

const getUserReward = async ({ address }) => {
  try {
    const reward = await UserReward.findOne({ address });
    if (!reward)
      return { status: false, message: 'address has no reward point' };
    return { status: true, message: 'address reward', userResponse: reward };
  } catch (e) {
    console.log(e.message);
  }
};

module.exports = {
  redeemPointsForInscription,
  perform_task,
  addTask,
  addClaim,
  removeTask,
  removeClaim,
  performTask,
  claimCheckinPoints,
  redeemPoints,
  redeemClaimCode,
  getClaims,
  getTasks,
  getUserReward,
};

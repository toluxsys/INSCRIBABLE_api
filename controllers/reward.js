// users get points for completing task
// users are tracked by address
// useres can redeem points for prices linked to codes: each cupon code has details of the reward the user is tring to redeem

const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const Task = require('../model/task');
const UserReward = require('../model/userReward');
const Claim = require('../model/claims');

// claim = reward
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
      taskName: task.taskName,
      points: task.taskPoints,
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
    } else if (task.taskName === 'checkIn') {
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
    return savedReward;
  } catch (e) {
    console.log(e.message);
  }
};

module.exports.addTask = async (req, res) => {
  try {
    const { taskName, points, info, description } = req.body;
    if (!taskName)
      return res
        .status(200)
        .json({ status: false, message: 'task name is required' });
    if (!points)
      return res
        .status(200)
        .json({ status: false, message: 'points is required' });
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
    return res
      .status(200)
      .json({ status: true, message: 'Task saved', userResponse: savedTask });
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.addClaim = async (req, res) => {
  try {
    const { description, info, claimPoint } = req.body;
    if (!description)
      return res
        .status(200)
        .json({ status: false, message: 'description is required' });
    if (!claimPoint)
      return res
        .status(200)
        .json({ status: false, message: 'claimPoint is required' });
    if (!info)
      return res
        .status(200)
        .json({ status: false, message: 'info is required' });
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
    return res
      .status(200)
      .json({ status: true, message: 'claim saved', userResponse: savedClaim });
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.removeTask = async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId)
      return res
        .status(200)
        .json({ status: false, message: 'taskId is required' });
    const task = await Task.findOne({ taskId });
    if (!task)
      return res
        .status(200)
        .json({ status: false, message: 'invalid task id' });
    if (task.status === 'inactive')
      return res
        .status(200)
        .json({ status: false, message: 'task already inactive' });
    task.status = 'inactive';
    const updateTask = await task.save();
    return res.status(200).json({
      status: true,
      message: 'task removed',
      userResponse: updateTask,
    });
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.removeClaim = async (req, res) => {
  try {
    const { rewardId } = req.body;
    if (!rewardId)
      return res
        .status(200)
        .json({ status: false, message: 'rewardId is required' });
    const claim = await Claim.findOne({ claimId: rewardId });
    if (!claim)
      return res
        .status(200)
        .json({ status: false, message: 'invalid reward id' });
    if (claim.status === 'inactive')
      return res
        .status(200)
        .json({ status: false, message: 'reward already inactive' });
    claim.status = 'inactive';
    const updateClaim = await claim.save();
    return res
      .status(200)
      .json({ status: true, message: 'claim removed', data: updateClaim });
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.performTask = async (req, res) => {
  try {
    const { address, taskId } = req.body;
    const result = await perform_task(address, taskId);
    if (result.status === true) {
      return res.status(200).json(result);
    }
    return res.status(200).json(result);
  } catch (e) {
    console.log(e);
    return res.status(500).json({ status: false, message: e.message });
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

module.exports.claimCheckinPoints = async (req, res) => {
  try {
    const { address } = req.body;
    const task = await Task.findOne({ taskName: 'checkIn' });
    const validCheckIn = await canCheckIn({ address });
    let result;
    if (validCheckIn.status === true) {
      result = await perform_task(address, task.taskId);
      return res.status(200).json({
        status: true,
        message: 'scribe points claimed',
        data: {
          totalPoints: result.data.totalPoints,
          lastCheckIn: result.data.lastCheckIn,
        },
      });
    }
    result = await perform_task(address, task.taskId);
    return res.status(200).json({
      status: false,
      message: 'last checkin was less than 24 hours',
      data: {
        totalPoints: result.data.totalPoints,
        lastCheckIn: result.data.lastCheckIn,
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.redeemPoints = async (req, res) => {
  try {
    const { address, rewardId } = req.body;
    const userReward = await UserReward.findOne({ address });
    const claim = await Claim.findOne({ claimId: rewardId });
    if (!claim)
      return res
        .status(200)
        .json({ status: false, message: 'invalid claim id' });
    if (claim.status !== `active`)
      return res
        .status(200)
        .json({ status: false, message: `claim is inactive` });
    if (!userReward)
      return res
        .status(200)
        .json({ status: false, message: `address has no reward point` });
    if (userReward.totalPoints < claim.claimPoint)
      return res.status(200).json({
        status: false,
        message: `not enough points to redeem claim. Total Point: ${userReward.totalPoints}`,
      });

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
    return res.status(200).json({
      status: true,
      message: 'claim code generated',
      userResponse: claimCode,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.redeemClaimCode = async (req, res) => {
  try {
    const { address, claimCode } = req.body;
    const claimId = parseInt(claimCode.split('-')[1]);
    const userReward = await UserReward.findOne({ address });
    const claim = await Claim.findOne({ claimId });
    if (!claim)
      return res.status(200).json({ status: false, message: 'invalid code' });
    if (claim.status !== `active`)
      return res
        .status(200)
        .json({ status: false, message: `reward is inactive` });
    if (!userReward)
      return res
        .status(200)
        .json({ status: false, message: `address has no reward point` });
    if (!userReward.claimCode.includes(claimCode))
      return res
        .status(200)
        .json({ status: false, message: 'address not valid for code' });
    if (claim.usedClaimCode.includes(claimCode))
      return res
        .status(200)
        .json({ status: false, message: 'code has been used' });
    if (!claim.claimCode.includes(claimCode))
      return res.status(200).json({ status: false, message: 'invalid code' });
    await Claim.findOneAndUpdate(
      { claimId },
      { $push: { usedClaimCode: claimCode } },
      { new: true },
    );
    return res
      .status(200)
      .json({ status: true, message: 'claim successful', userResponse: true });
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.getClaims = async (req, res) => {
  try {
    const claims = await Claim.find({});
    const active = [];
    claims.forEach((claim) => {
      const data = {
        claimId: claim.claimId,
        status: claim.status,
        description: claim.description,
        info: claim.info,
        claimPoint: claim.claimPoint,
      };
      if (claim.status === 'active') active.push(data);
    });
    return res
      .status(200)
      .json({ status: true, message: 'active rewards', userResponse: active });
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.getTasks = async (req, res) => {
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
      if (task.status === 'active' && task.taskId !== 1) {
        active.push(data);
      } else if (task.status === 'active' && task.taskId !== 2) {
        active.push(data);
      }
    });
    return res
      .status(200)
      .json({ status: true, message: 'active tasks', userResponse: active });
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

module.exports.getUserReward = async (req, res) => {
  try {
    const { address } = req.body;
    const reward = await UserReward.findOne({ address });
    if (!reward)
      return res
        .status(200)
        .json({ status: false, message: 'address has no reward point' });
    return res
      .status(200)
      .json({ status: true, message: 'address reward', userResponse: reward });
  } catch (e) {
    console.log(e.message);
    return res.status(500).json({ status: false, message: e.message });
  }
};

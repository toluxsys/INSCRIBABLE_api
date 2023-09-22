const getType = (inscriptionId) => {
  let type;
  const arr = inscriptionId.split(``);
  if (arr[0] === `s`) {
    type = `single`;
  } else if (arr[0] === `b`) {
    type = `bulk`;
  } else if (arr[0] === `p`) {
    type = `payLink`;
  } else {
    throw new Error(`Invalid inscription id`);
  }

  return type;
};

module.exports = { getType };

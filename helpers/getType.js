const getType = (inscriptionId) => {
  let type;
  if (!inscriptionId) {
    type = 'invalid id';
  } else {
    const arr = inscriptionId.split(``);
    if (arr[0] === `s`) {
      type = `single`;
    } else if (arr[0] === `b`) {
      type = `bulk`;
    } else if (arr[0] === `p`) {
      type = `payLink`;
    } else {
      type = `Invalid inscription id`;
    }
  }
  return type;
};

module.exports = { getType };

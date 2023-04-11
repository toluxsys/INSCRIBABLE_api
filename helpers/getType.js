const getType = (inscriptionId) => {
  let type;
  const arr = inscriptionId.split(``);
  if (arr[0] === `s`) {
    type = `single`;
  } else if (arr[0] === `b`) {
    type = `bulk`;
  }

  return type;
};

module.exports = { getType };

//console.log(getType("se5e484af-6974-4ae5-a5f1-3c92d6366d7e"));

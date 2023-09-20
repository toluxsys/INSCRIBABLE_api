const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
//const { layersOrder } = require("./config.js");

const metDataFile = '_metadata.json';

const rarity = [
    { key: "", val: "original" },
    { key: "r", val: "rare" },
    { key: "sr", val: "super rare" },
];
const defaultEdition = 5;

let metadata = [];
let attributes = [];
let hash = [];
let decodedHash = [];
const Exists = new Map();


const addRarity = _str => {
  let itemRarity;

  rarity.forEach((r) => {
    if (_str.includes(r.key)) {
      itemRarity = r.val;
    }
  });

  return itemRarity;
};

const cleanName = _str => {
  let name = _str.slice(0, -4);
  rarity.forEach((r) => {
    name = name.replace(r.key, "");
  });
  return name;
};

//get attributes id
const getElements = attributes => {
    //let att = [{layerName: "black background", inscriotionId: "", rarity: "sr"}]
    attributes.map((i, index) => {
        return {
            id: index + 1,
            name: i.layerName,
            inscriotionId: i.inscriotionId,
            rarity: i.rarity,
        };
    })
};

//let attributesArray = [{layerName: "black background", inscriotionId: "", rarity: "sr"}]
const layersSetup = (layersOrder, attributesArray) => {
  const layers = layersOrder.map((layerObj, index) => ({
    id: index,
    name: layerObj.name,
    elements: getElements(attributesArray),
    number: layerObj.number
  }));

  return layers;
};

const addMetadata = _edition => {
  let dateTime = Date.now();
  let tempMetadata = {
    hash: hash.join(""),
    decodedHash: decodedHash,
    edition: _edition,
    date: dateTime,
    attributes: attributes,
  };
  metadata.push(tempMetadata);
  attributes = [];
  hash = [];
  decodedHash = [];
};

const addAttributes = (_element, _layer) => {
  let tempAttr = {
    id: _element.id,
    layer: _layer.name,
    name: _element.name,
    rarity: _element.rarity,
    inscriptionId: _element.inscriotionId
  };
  attributes.push(tempAttr);
  hash.push(_layer.id);
  hash.push(_element.id);
  decodedHash.push({ [_layer.id]: _element.id });
};

const drawLayer = async (_layer, _edition) => {
  const rand = Math.random();
  let element =
    _layer.elements[Math.floor(rand * _layer.number)] ? _layer.elements[Math.floor(rand * _layer.number)] : null;
  if (element) {
    addAttributes(element, _layer);
    const inscriptionId = element.inscriotionId;
    return inscriptionId
  }
};

const createFiles = async (collectionId, edition) => {
    //get layer order from database
  /**
   * let collection = await Collection.findOne({id: collectionId})
   * let layersOrder = collection.layerOrder
  */
    let layersOrder =  [
        { name: 'background', number: 1 },
        { name: 'ball', number: 2 },
        { name: 'eye color', number: 12 },
        { name: 'iris', number: 3 },
        { name: 'shine', number: 1 },
        { name: 'bottom lid', number: 3 },
        { name: 'top lid', number: 3 },
    ];
  const layers = layersSetup(layersOrder);
  let numDupes = 0;
 for (let i = 1; i <= edition; i++) {
   await layers.forEach(async (layer) => {
     await drawLayer(layer, i);
   });

   let key = hash.toString();
   if (Exists.has(key)) {
     console.log(
       `Duplicate creation for edition ${i}. Same as edition ${Exists.get(
         key
       )}`
     );
     numDupes++;
     if (numDupes > edition) break; //prevents infinite loop if no more unique items can be created
     i--;
   } else {
     Exists.set(key, i);
     addMetadata(i);
     console.log("Creating edition " + i);
   }
 }
};

const createMetaData = () => {
  fs.stat(`${buildDir}/${metDataFile}`, (err) => {
    if(err == null || err.code === 'ENOENT') {
      fs.writeFileSync(`${buildDir}/${metDataFile}`, JSON.stringify(metadata, null, 2));
    } else {
        console.log('Oh no, error: ', err.code);
    }
  });
};

module.exports = { createFiles, createMetaData };
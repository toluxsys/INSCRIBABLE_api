const fs = require('fs');

let satRanges = [
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 835559269455303,
      end: 835559269457634,
      size: 2331,
      startOffset: 0,
      endOffset: 2330,
      rarity: 'common',
      year: '2012',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 1659521179966900,
      end: 1659521179969908,
      size: 3008,
      startOffset: 2331,
      endOffset: 5338,
      rarity: 'common',
      year: '2017',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 1917744045458621,
      end: 1917744045461629,
      size: 3008,
      startOffset: 5339,
      endOffset: 8346,
      rarity: 'common',
      year: '2022',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 1510604955439621,
      end: 1510604955441846,
      size: 2225,
      startOffset: 8347,
      endOffset: 10571,
      rarity: 'common',
      year: '2016',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 255981554644448,
      end: 255981554646196,
      size: 1748,
      startOffset: 10572,
      endOffset: 12319,
      rarity: 'common',
      year: '2010',
      specialAttribute: 'pizza sats'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 1526993619112786,
      end: 1526993619117821,
      size: 5035,
      startOffset: 12320,
      endOffset: 17354,
      rarity: 'common',
      year: '2016',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 262176797382184,
      end: 262176797387151,
      size: 4967,
      startOffset: 17355,
      endOffset: 22321,
      rarity: 'common',
      year: '2010',
      specialAttribute: 'pizza sats'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 1466017731659929,
      end: 1466017731662607,
      size: 2678,
      startOffset: 22322,
      endOffset: 24999,
      rarity: 'common',
      year: '2015',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 978860492833752,
      end: 978860492844536,
      size: 10784,
      startOffset: 25000,
      endOffset: 35783,
      rarity: 'common',
      year: '2012',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 12628470165231,
      end: 12628470250802,
      size: 85571,
      startOffset: 35784,
      endOffset: 121354,
      rarity: 'common',
      year: '2009',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 982981897653832,
      end: 982981897667477,
      size: 13645,
      startOffset: 121355,
      endOffset: 134999,
      rarity: 'common',
      year: '2012',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 1693470371364613,
      end: 1693470371374638,
      size: 10025,
      startOffset: 135000,
      endOffset: 145024,
      rarity: 'common',
      year: '2018',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 64438188917270,
      end: 64438188922789,
      size: 5519,
      startOffset: 145025,
      endOffset: 150543,
      rarity: 'common',
      year: '2009',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 1563047719304638,
      end: 1563047719310157,
      size: 5519,
      startOffset: 150544,
      endOffset: 156062,
      rarity: 'common',
      year: '2016',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 49536662768526,
      end: 49536662774045,
      size: 5519,
      startOffset: 156063,
      endOffset: 161582,
      rarity: 'common',
      year: '2009',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 892186968593087,
      end: 892186968598606,
      size: 5519,
      startOffset: 161582,
      endOffset: 167101,
      rarity: 'common',
      year: '2012',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 1038129672027595,
      end: 1038129672030494,
      size: 2899,
      startOffset: 167101,
      endOffset: 170000,
      rarity: 'common',
      year: '2012',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 1148922539383356,
      end: 1148922539390377,
      size: 7021,
      startOffset: 170000,
      endOffset: 177021,
      rarity: 'common',
      year: '2013',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 34873750438734,
      end: 34873750448734,
      size: 10000,
      startOffset: 177021,
      endOffset: 187021,
      rarity: 'common',
      year: '2009',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 1171311001019016,
      end: 1171311001026995,
      size: 7979,
      startOffset: 187021,
      endOffset: 195000,
      rarity: 'common',
      year: '2013',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 1775661713201014,
      end: 1775661713211016,
      size: 10002,
      startOffset: 195000,
      endOffset: 205002,
      rarity: 'common',
      year: '2019',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 125289669332098,
      end: 125289669348098,
      size: 16000,
      startOffset: 205002,
      endOffset: 221002,
      rarity: 'common',
      year: '2009',
      specialAttribute: 'none'
    },
    {
      output: 'bf1c7355912e111358ba5d73ae6a50857736a2df7ca767d2ad0dba15663d2356:0',    
      start: 811301664397240,
      end: 811301664397591,
      size: 351,
      startOffset: 221002,
      endOffset: 221353,
      rarity: 'common',
      year: '2012',
      specialAttribute: 'none'
    }
  ]

  const writeFile = ()=> {
    // if (fs.existsSync(process.cwd() + 'output.json')) {
    //   fs.mkdir(process.cwd() + 'output.json')
    // }

    const str_sat = JSON.stringify(satRanges)
    console.log(str_sat)
    //fs.writeFile(process.cwd() + 'output.json', JSON.stringify(output), (err) => {})
  }
  //writeFile()
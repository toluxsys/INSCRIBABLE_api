const fs = require("fs");

const newInscriptions1 = [
  {
    inscription:
      "e52b143d5520fa9ff6043c2543cf394c8b2f5dcfb6dd28d8cddbfab75eac3204i0",
    location:
      "e52b143d5520fa9ff6043c2543cf394c8b2f5dcfb6dd28d8cddbfab75eac3204:0:0",
    explorer:
      "https://ordinals.com/inscription/e52b143d5520fa9ff6043c2543cf394c8b2f5dcfb6dd28d8cddbfab75eac3204i0",
  },
  {
    inscription:
      "49452f91fc1867410c72eafeef3a1399da7c44f1dac9df36f6e1b8061163f604i0",
    location:
      "49452f91fc1867410c72eafeef3a1399da7c44f1dac9df36f6e1b8061163f604:0:0",
    explorer:
      "https://ordinals.com/inscription/49452f91fc1867410c72eafeef3a1399da7c44f1dac9df36f6e1b8061163f604i0",
  },
  {
    inscription:
      "b591d7359b959a8ec4a1991671800da35f4e4895590f6dadc22408fd9bd65805i0",
    location:
      "b591d7359b959a8ec4a1991671800da35f4e4895590f6dadc22408fd9bd65805:0:0",
    explorer:
      "https://ordinals.com/inscription/b591d7359b959a8ec4a1991671800da35f4e4895590f6dadc22408fd9bd65805i0",
  },
  {
    inscription:
      "f5a5ec183ac3ee5de504943c3835dd63f35fafcae813c0ebd459dfcf820cce08i0",
    location:
      "f5a5ec183ac3ee5de504943c3835dd63f35fafcae813c0ebd459dfcf820cce08:0:0",
    explorer:
      "https://ordinals.com/inscription/f5a5ec183ac3ee5de504943c3835dd63f35fafcae813c0ebd459dfcf820cce08i0",
  },
  {
    inscription:
      "61af154bc6035e4dd3df65eabc46c0976a64c3015384857527642debe76faa0ai0",
    location:
      "61af154bc6035e4dd3df65eabc46c0976a64c3015384857527642debe76faa0a:0:0",
    explorer:
      "https://ordinals.com/inscription/61af154bc6035e4dd3df65eabc46c0976a64c3015384857527642debe76faa0ai0",
  },
  {
    inscription:
      "52975e529259a94b962c2695f8069b72a45a9721d48b433bc4f45789fa34cb0ai0",
    location:
      "52975e529259a94b962c2695f8069b72a45a9721d48b433bc4f45789fa34cb0a:0:0",
    explorer:
      "https://ordinals.com/inscription/52975e529259a94b962c2695f8069b72a45a9721d48b433bc4f45789fa34cb0ai0",
  },
  {
    inscription:
      "b0e16f0e7f1f4fb6228efa92b3624528940529c84881bcfa8da31ae3fe68d915i0",
    location:
      "b0e16f0e7f1f4fb6228efa92b3624528940529c84881bcfa8da31ae3fe68d915:0:0",
    explorer:
      "https://ordinals.com/inscription/b0e16f0e7f1f4fb6228efa92b3624528940529c84881bcfa8da31ae3fe68d915i0",
  },
  {
    inscription:
      "2ed162f16a6d847136a86c234c3b7073d98e89c09a5cf6285ea4a52a82e15916i0",
    location:
      "2ed162f16a6d847136a86c234c3b7073d98e89c09a5cf6285ea4a52a82e15916:0:0",
    explorer:
      "https://ordinals.com/inscription/2ed162f16a6d847136a86c234c3b7073d98e89c09a5cf6285ea4a52a82e15916i0",
  },
  {
    inscription:
      "11ee98301ffd124a1126bc303c5d6b858486d1288b0a0feb5ae5dfcfd1894c19i0",
    location:
      "11ee98301ffd124a1126bc303c5d6b858486d1288b0a0feb5ae5dfcfd1894c19:0:0",
    explorer:
      "https://ordinals.com/inscription/11ee98301ffd124a1126bc303c5d6b858486d1288b0a0feb5ae5dfcfd1894c19i0",
  },
  {
    inscription:
      "7adb5a04320fb97175d804d79b01d6ffaf7918addb603c450af264f4a940491bi0",
    location:
      "7adb5a04320fb97175d804d79b01d6ffaf7918addb603c450af264f4a940491b:0:0",
    explorer:
      "https://ordinals.com/inscription/7adb5a04320fb97175d804d79b01d6ffaf7918addb603c450af264f4a940491bi0",
  },
  {
    inscription:
      "a140cdbed24cb634cd53a624a1510ae0feb115962fd8974e0545a3bcff2a9d1ci0",
    location:
      "a140cdbed24cb634cd53a624a1510ae0feb115962fd8974e0545a3bcff2a9d1c:0:0",
    explorer:
      "https://ordinals.com/inscription/a140cdbed24cb634cd53a624a1510ae0feb115962fd8974e0545a3bcff2a9d1ci0",
  },
  {
    inscription:
      "2a010584e16e62dde16247cbd71491b651afa6d90609228a57e9336189cc8c26i0",
    location:
      "2a010584e16e62dde16247cbd71491b651afa6d90609228a57e9336189cc8c26:0:0",
    explorer:
      "https://ordinals.com/inscription/2a010584e16e62dde16247cbd71491b651afa6d90609228a57e9336189cc8c26i0",
  },
  {
    inscription:
      "b26b89c821f8b446fcd80bc5ff1de997da7e08d3da6064c4d1a216180f9aa829i0",
    location:
      "b26b89c821f8b446fcd80bc5ff1de997da7e08d3da6064c4d1a216180f9aa829:0:0",
    explorer:
      "https://ordinals.com/inscription/b26b89c821f8b446fcd80bc5ff1de997da7e08d3da6064c4d1a216180f9aa829i0",
  },
  {
    inscription:
      "4a3b48c7e42e0375be62bb4aa2cd8021dbec6ef6ede029fb42ca9c2b2f383f2di0",
    location:
      "4a3b48c7e42e0375be62bb4aa2cd8021dbec6ef6ede029fb42ca9c2b2f383f2d:0:0",
    explorer:
      "https://ordinals.com/inscription/4a3b48c7e42e0375be62bb4aa2cd8021dbec6ef6ede029fb42ca9c2b2f383f2di0",
  },
  {
    inscription:
      "4cdc8dddade958d15f4ddd456c4d7a6e346e5522793b7fe088e817439361302ei0",
    location:
      "4cdc8dddade958d15f4ddd456c4d7a6e346e5522793b7fe088e817439361302e:0:0",
    explorer:
      "https://ordinals.com/inscription/4cdc8dddade958d15f4ddd456c4d7a6e346e5522793b7fe088e817439361302ei0",
  },
  {
    inscription:
      "5df39d80e3428f241900b83c512da0bab84ee65a8d8363ba85ae0103ef9e4d2fi0",
    location:
      "5df39d80e3428f241900b83c512da0bab84ee65a8d8363ba85ae0103ef9e4d2f:0:0",
    explorer:
      "https://ordinals.com/inscription/5df39d80e3428f241900b83c512da0bab84ee65a8d8363ba85ae0103ef9e4d2fi0",
  },
  {
    inscription:
      "748363fa5d2df25219512b699c638200efc8cde3e329e0471a375d914a7e8b39i0",
    location:
      "748363fa5d2df25219512b699c638200efc8cde3e329e0471a375d914a7e8b39:0:0",
    explorer:
      "https://ordinals.com/inscription/748363fa5d2df25219512b699c638200efc8cde3e329e0471a375d914a7e8b39i0",
  },
  {
    inscription:
      "774bc6a7065038ebedb2567dc12b7a2e475b61c2494acfc4457446609fd9d23ai0",
    location:
      "774bc6a7065038ebedb2567dc12b7a2e475b61c2494acfc4457446609fd9d23a:0:0",
    explorer:
      "https://ordinals.com/inscription/774bc6a7065038ebedb2567dc12b7a2e475b61c2494acfc4457446609fd9d23ai0",
  },
  {
    inscription:
      "2acfa22968b276e4e583c5526959a19e3c7c81d8ee2e5bfd01cd72f73804733ci0",
    location:
      "2acfa22968b276e4e583c5526959a19e3c7c81d8ee2e5bfd01cd72f73804733c:0:0",
    explorer:
      "https://ordinals.com/inscription/2acfa22968b276e4e583c5526959a19e3c7c81d8ee2e5bfd01cd72f73804733ci0",
  },
  {
    inscription:
      "6dd9d0d987060254e05b51d7f476310ddad3add43e0b0fa2cd48bd02b5b1533fi0",
    location:
      "6dd9d0d987060254e05b51d7f476310ddad3add43e0b0fa2cd48bd02b5b1533f:0:0",
    explorer:
      "https://ordinals.com/inscription/6dd9d0d987060254e05b51d7f476310ddad3add43e0b0fa2cd48bd02b5b1533fi0",
  },
  {
    inscription:
      "b5e106ed34ab9bf08fd270854379acb3a22f776cda74c138af0696b8ac678c3fi0",
    location:
      "b5e106ed34ab9bf08fd270854379acb3a22f776cda74c138af0696b8ac678c3f:0:0",
    explorer:
      "https://ordinals.com/inscription/b5e106ed34ab9bf08fd270854379acb3a22f776cda74c138af0696b8ac678c3fi0",
  },
  {
    inscription:
      "687c4803e3c839b883ba3381a20ca73d5731f15d19f52dad4317a28d598c6140i0",
    location:
      "687c4803e3c839b883ba3381a20ca73d5731f15d19f52dad4317a28d598c6140:0:0",
    explorer:
      "https://ordinals.com/inscription/687c4803e3c839b883ba3381a20ca73d5731f15d19f52dad4317a28d598c6140i0",
  },
  {
    inscription:
      "147e277c2eaf934243ecc8e83118668450a4f5ed2db8a03bac61b8e6b0c9cb42i0",
    location:
      "147e277c2eaf934243ecc8e83118668450a4f5ed2db8a03bac61b8e6b0c9cb42:0:0",
    explorer:
      "https://ordinals.com/inscription/147e277c2eaf934243ecc8e83118668450a4f5ed2db8a03bac61b8e6b0c9cb42i0",
  },
  {
    inscription:
      "7b0c14a6a8b3a058b2858d67a020345455aab954f1d697247315fe0cf74dd745i0",
    location:
      "7b0c14a6a8b3a058b2858d67a020345455aab954f1d697247315fe0cf74dd745:0:0",
    explorer:
      "https://ordinals.com/inscription/7b0c14a6a8b3a058b2858d67a020345455aab954f1d697247315fe0cf74dd745i0",
  },
  {
    inscription:
      "8c98784f1b9428a994878bae83cb00e0ff0e0aec884eabe5f3c437f68c92eb46i0",
    location:
      "8c98784f1b9428a994878bae83cb00e0ff0e0aec884eabe5f3c437f68c92eb46:0:0",
    explorer:
      "https://ordinals.com/inscription/8c98784f1b9428a994878bae83cb00e0ff0e0aec884eabe5f3c437f68c92eb46i0",
  },
  {
    inscription:
      "e6401d576d2dc44440042928e76e3fd58de3d5726327a9a03fdce773fd531149i0",
    location:
      "e6401d576d2dc44440042928e76e3fd58de3d5726327a9a03fdce773fd531149:0:0",
    explorer:
      "https://ordinals.com/inscription/e6401d576d2dc44440042928e76e3fd58de3d5726327a9a03fdce773fd531149i0",
  },
  {
    inscription:
      "8fb87fc9c97c69f154a110e1b13218e4360242794736a7fc82f9f97bad521a4ci0",
    location:
      "8fb87fc9c97c69f154a110e1b13218e4360242794736a7fc82f9f97bad521a4c:0:0",
    explorer:
      "https://ordinals.com/inscription/8fb87fc9c97c69f154a110e1b13218e4360242794736a7fc82f9f97bad521a4ci0",
  },
  {
    inscription:
      "d2268c34eefb25880a2c8560339a9841f1a7c0dbe166b1a7464e54584c721053i0",
    location:
      "d2268c34eefb25880a2c8560339a9841f1a7c0dbe166b1a7464e54584c721053:0:0",
    explorer:
      "https://ordinals.com/inscription/d2268c34eefb25880a2c8560339a9841f1a7c0dbe166b1a7464e54584c721053i0",
  },
  {
    inscription:
      "418a3cefd268840f1ecee5591da0f2a52e3d33eb9a40c697d3fdefaa1f98d258i0",
    location:
      "418a3cefd268840f1ecee5591da0f2a52e3d33eb9a40c697d3fdefaa1f98d258:0:0",
    explorer:
      "https://ordinals.com/inscription/418a3cefd268840f1ecee5591da0f2a52e3d33eb9a40c697d3fdefaa1f98d258i0",
  },
  {
    inscription:
      "7f8f8ba0e5231c95359cf9af234325513c5b3869061fc7621c4cc7128b24915ci0",
    location:
      "7f8f8ba0e5231c95359cf9af234325513c5b3869061fc7621c4cc7128b24915c:0:0",
    explorer:
      "https://ordinals.com/inscription/7f8f8ba0e5231c95359cf9af234325513c5b3869061fc7621c4cc7128b24915ci0",
  },
  {
    inscription:
      "db5b2ea34e4b1d2d598c0d307c748eb33e00be92cd5ca80e82e51c0cac0f265fi0",
    location:
      "db5b2ea34e4b1d2d598c0d307c748eb33e00be92cd5ca80e82e51c0cac0f265f:0:0",
    explorer:
      "https://ordinals.com/inscription/db5b2ea34e4b1d2d598c0d307c748eb33e00be92cd5ca80e82e51c0cac0f265fi0",
  },
  {
    inscription:
      "2ae0ac444ec444534656bf0ea5b55250dbb8111b9a112350fc459bf0d50b4760i0",
    location:
      "2ae0ac444ec444534656bf0ea5b55250dbb8111b9a112350fc459bf0d50b4760:0:0",
    explorer:
      "https://ordinals.com/inscription/2ae0ac444ec444534656bf0ea5b55250dbb8111b9a112350fc459bf0d50b4760i0",
  },
  {
    inscription:
      "05c397c8a1dedb792de0f4f623d0b2d3e07acd4c54abb3f725e40467b547e364i0",
    location:
      "05c397c8a1dedb792de0f4f623d0b2d3e07acd4c54abb3f725e40467b547e364:0:0",
    explorer:
      "https://ordinals.com/inscription/05c397c8a1dedb792de0f4f623d0b2d3e07acd4c54abb3f725e40467b547e364i0",
  },
  {
    inscription:
      "5360b17147d298a37fd39e1951de165892e01f3c70e122f00985ed4a5de26a65i0",
    location:
      "5360b17147d298a37fd39e1951de165892e01f3c70e122f00985ed4a5de26a65:0:0",
    explorer:
      "https://ordinals.com/inscription/5360b17147d298a37fd39e1951de165892e01f3c70e122f00985ed4a5de26a65i0",
  },
  {
    inscription:
      "bd1142e59a571bc44fd28c1402bba235b80dd1979dead4f41a55f7cec8589766i0",
    location:
      "bd1142e59a571bc44fd28c1402bba235b80dd1979dead4f41a55f7cec8589766:0:0",
    explorer:
      "https://ordinals.com/inscription/bd1142e59a571bc44fd28c1402bba235b80dd1979dead4f41a55f7cec8589766i0",
  },
  {
    inscription:
      "0844e55b957af449d23344ccdf1a10f2ea8ecddc75c6d97826ad6f3e51080267i0",
    location:
      "0844e55b957af449d23344ccdf1a10f2ea8ecddc75c6d97826ad6f3e51080267:0:0",
    explorer:
      "https://ordinals.com/inscription/0844e55b957af449d23344ccdf1a10f2ea8ecddc75c6d97826ad6f3e51080267i0",
  },
  {
    inscription:
      "c8b3eaf44dd099f0f3a3f68cad9e97b53569d86fcfe7bf322c69f0b596499268i0",
    location:
      "c8b3eaf44dd099f0f3a3f68cad9e97b53569d86fcfe7bf322c69f0b596499268:0:0",
    explorer:
      "https://ordinals.com/inscription/c8b3eaf44dd099f0f3a3f68cad9e97b53569d86fcfe7bf322c69f0b596499268i0",
  },
  {
    inscription:
      "6dbf182f70846f417f773764b50f244e29fa8733112a91d3b3b28641fd49ed6ai0",
    location:
      "6dbf182f70846f417f773764b50f244e29fa8733112a91d3b3b28641fd49ed6a:0:0",
    explorer:
      "https://ordinals.com/inscription/6dbf182f70846f417f773764b50f244e29fa8733112a91d3b3b28641fd49ed6ai0",
  },
  {
    inscription:
      "487f9d4c2e3e7216366d2cbe63adba1f3fda46991c8b9b22207aa247c6335570i0",
    location:
      "487f9d4c2e3e7216366d2cbe63adba1f3fda46991c8b9b22207aa247c6335570:0:0",
    explorer:
      "https://ordinals.com/inscription/487f9d4c2e3e7216366d2cbe63adba1f3fda46991c8b9b22207aa247c6335570i0",
  },
  {
    inscription:
      "a73237009174eab37966947f125227f051cc177014fc11f46ca86b6cc2d5d073i0",
    location:
      "a73237009174eab37966947f125227f051cc177014fc11f46ca86b6cc2d5d073:0:0",
    explorer:
      "https://ordinals.com/inscription/a73237009174eab37966947f125227f051cc177014fc11f46ca86b6cc2d5d073i0",
  },
  {
    inscription:
      "4929cb2c2e60db85ab3bc6acc8bd82d116b681fb45e3479178827413747edc77i0",
    location:
      "4929cb2c2e60db85ab3bc6acc8bd82d116b681fb45e3479178827413747edc77:0:0",
    explorer:
      "https://ordinals.com/inscription/4929cb2c2e60db85ab3bc6acc8bd82d116b681fb45e3479178827413747edc77i0",
  },
  {
    inscription:
      "f574c06a4b12f5f228bfb6d4c0f0cd920f4d40cc2f02bfbb80f102e5d0021f79i0",
    location:
      "f574c06a4b12f5f228bfb6d4c0f0cd920f4d40cc2f02bfbb80f102e5d0021f79:0:0",
    explorer:
      "https://ordinals.com/inscription/f574c06a4b12f5f228bfb6d4c0f0cd920f4d40cc2f02bfbb80f102e5d0021f79i0",
  },
  {
    inscription:
      "94d2d8134b927b0957a05f12a2ff856928bed398b04fdc2960f4bf1735292a7bi0",
    location:
      "94d2d8134b927b0957a05f12a2ff856928bed398b04fdc2960f4bf1735292a7b:0:0",
    explorer:
      "https://ordinals.com/inscription/94d2d8134b927b0957a05f12a2ff856928bed398b04fdc2960f4bf1735292a7bi0",
  },
  {
    inscription:
      "09338167fdb7f11e2282c4644f49991371696c1d9275103da12f1899306ef27bi0",
    location:
      "09338167fdb7f11e2282c4644f49991371696c1d9275103da12f1899306ef27b:0:0",
    explorer:
      "https://ordinals.com/inscription/09338167fdb7f11e2282c4644f49991371696c1d9275103da12f1899306ef27bi0",
  },
  {
    inscription:
      "c4e61c11e5003e2fe2d138cb2abe397cc050b19123dd1037e369d290303e7a80i0",
    location:
      "c4e61c11e5003e2fe2d138cb2abe397cc050b19123dd1037e369d290303e7a80:0:0",
    explorer:
      "https://ordinals.com/inscription/c4e61c11e5003e2fe2d138cb2abe397cc050b19123dd1037e369d290303e7a80i0",
  },
  {
    inscription:
      "988766cea47f698390ca7d3dd8652042096cd401c95b130c7b2ec5c78d75818ci0",
    location:
      "988766cea47f698390ca7d3dd8652042096cd401c95b130c7b2ec5c78d75818c:0:0",
    explorer:
      "https://ordinals.com/inscription/988766cea47f698390ca7d3dd8652042096cd401c95b130c7b2ec5c78d75818ci0",
  },
  {
    inscription:
      "93cde4105e6c0e9beba386c83fe664e398083b3d34438156e26609a7d7cfdf8ci0",
    location:
      "93cde4105e6c0e9beba386c83fe664e398083b3d34438156e26609a7d7cfdf8c:0:0",
    explorer:
      "https://ordinals.com/inscription/93cde4105e6c0e9beba386c83fe664e398083b3d34438156e26609a7d7cfdf8ci0",
  },
  {
    inscription:
      "94a8cb922f51c2eece59e9fae3ba64d3d0d985da100dafaa3c4980c620845790i0",
    location:
      "94a8cb922f51c2eece59e9fae3ba64d3d0d985da100dafaa3c4980c620845790:0:0",
    explorer:
      "https://ordinals.com/inscription/94a8cb922f51c2eece59e9fae3ba64d3d0d985da100dafaa3c4980c620845790i0",
  },
  {
    inscription:
      "16f89cd53adc9b16131ef1dddb2f2a16b8fb7ae3c2c8626a334b1007aa28589ei0",
    location:
      "16f89cd53adc9b16131ef1dddb2f2a16b8fb7ae3c2c8626a334b1007aa28589e:0:0",
    explorer:
      "https://ordinals.com/inscription/16f89cd53adc9b16131ef1dddb2f2a16b8fb7ae3c2c8626a334b1007aa28589ei0",
  },
  {
    inscription:
      "f7aa19b76b2bce2e873ef88c58d13e8fb119e18274f95bc9dba586c4175eda9ei0",
    location:
      "f7aa19b76b2bce2e873ef88c58d13e8fb119e18274f95bc9dba586c4175eda9e:0:0",
    explorer:
      "https://ordinals.com/inscription/f7aa19b76b2bce2e873ef88c58d13e8fb119e18274f95bc9dba586c4175eda9ei0",
  },
  {
    inscription:
      "dcfa70ba271955e01826e0586410e99672c32d84f7cd0f6a9ba87ed9cfc9fd9ei0",
    location:
      "dcfa70ba271955e01826e0586410e99672c32d84f7cd0f6a9ba87ed9cfc9fd9e:0:0",
    explorer:
      "https://ordinals.com/inscription/dcfa70ba271955e01826e0586410e99672c32d84f7cd0f6a9ba87ed9cfc9fd9ei0",
  },
  {
    inscription:
      "e4fa45f4ffe76699b4825de0d6296c253e1ed7ecd7b775b335f58c967e368ca1i0",
    location:
      "e4fa45f4ffe76699b4825de0d6296c253e1ed7ecd7b775b335f58c967e368ca1:0:0",
    explorer:
      "https://ordinals.com/inscription/e4fa45f4ffe76699b4825de0d6296c253e1ed7ecd7b775b335f58c967e368ca1i0",
  },
  {
    inscription:
      "da37cf143fdc658a479f469fa5066d99cf374eed675df0ee304c112168321ca5i0",
    location:
      "da37cf143fdc658a479f469fa5066d99cf374eed675df0ee304c112168321ca5:0:0",
    explorer:
      "https://ordinals.com/inscription/da37cf143fdc658a479f469fa5066d99cf374eed675df0ee304c112168321ca5i0",
  },
  {
    inscription:
      "2eb1c1f1f8b7ccc273e0ad1ccdecea9f997367512094f18ebf9bae9d56ca3eabi0",
    location:
      "2eb1c1f1f8b7ccc273e0ad1ccdecea9f997367512094f18ebf9bae9d56ca3eab:0:0",
    explorer:
      "https://ordinals.com/inscription/2eb1c1f1f8b7ccc273e0ad1ccdecea9f997367512094f18ebf9bae9d56ca3eabi0",
  },
  {
    inscription:
      "b497b6446f2f3db58b84e2bd5443cae4033b53624c7ada33a5bc9ace667dcdaci0",
    location:
      "b497b6446f2f3db58b84e2bd5443cae4033b53624c7ada33a5bc9ace667dcdac:0:0",
    explorer:
      "https://ordinals.com/inscription/b497b6446f2f3db58b84e2bd5443cae4033b53624c7ada33a5bc9ace667dcdaci0",
  },
  {
    inscription:
      "574b52da3cd80cfb18f4f4c98f0f9913948757d5742aa1872d1735f4ed3aa6b1i0",
    location:
      "574b52da3cd80cfb18f4f4c98f0f9913948757d5742aa1872d1735f4ed3aa6b1:0:0",
    explorer:
      "https://ordinals.com/inscription/574b52da3cd80cfb18f4f4c98f0f9913948757d5742aa1872d1735f4ed3aa6b1i0",
  },
  {
    inscription:
      "4f66d7ed35f8a76eb5edf7bbeac352ddc5db83f8a69a09573837a3eebe2a28b6i0",
    location:
      "4f66d7ed35f8a76eb5edf7bbeac352ddc5db83f8a69a09573837a3eebe2a28b6:0:0",
    explorer:
      "https://ordinals.com/inscription/4f66d7ed35f8a76eb5edf7bbeac352ddc5db83f8a69a09573837a3eebe2a28b6i0",
  },
  {
    inscription:
      "a2556130f3c7cc020484173a06b2967eebfd75f96ca1cc6686c108c3b2c214bai0",
    location:
      "a2556130f3c7cc020484173a06b2967eebfd75f96ca1cc6686c108c3b2c214ba:0:0",
    explorer:
      "https://ordinals.com/inscription/a2556130f3c7cc020484173a06b2967eebfd75f96ca1cc6686c108c3b2c214bai0",
  },
  {
    inscription:
      "99e3e6ec026b66e12ea5bbc36b9504b1bfb4ff0bd7c525b22a73abf10c5d78bci0",
    location:
      "99e3e6ec026b66e12ea5bbc36b9504b1bfb4ff0bd7c525b22a73abf10c5d78bc:0:0",
    explorer:
      "https://ordinals.com/inscription/99e3e6ec026b66e12ea5bbc36b9504b1bfb4ff0bd7c525b22a73abf10c5d78bci0",
  },
  {
    inscription:
      "5301b981a684979fb62d0543aa088e1b892ed807758f1444a42b754abc19d8bci0",
    location:
      "5301b981a684979fb62d0543aa088e1b892ed807758f1444a42b754abc19d8bc:0:0",
    explorer:
      "https://ordinals.com/inscription/5301b981a684979fb62d0543aa088e1b892ed807758f1444a42b754abc19d8bci0",
  },
  {
    inscription:
      "919a72170720c278b012c95e8d9f18d973e91d2b90bc24ec46423d68097e5ac1i0",
    location:
      "919a72170720c278b012c95e8d9f18d973e91d2b90bc24ec46423d68097e5ac1:0:0",
    explorer:
      "https://ordinals.com/inscription/919a72170720c278b012c95e8d9f18d973e91d2b90bc24ec46423d68097e5ac1i0",
  },
  {
    inscription:
      "3a7752f3cbac8e1ad894f783998823b2af3ce1ed11a090cb410f8f347ddef8c3i0",
    location:
      "3a7752f3cbac8e1ad894f783998823b2af3ce1ed11a090cb410f8f347ddef8c3:0:0",
    explorer:
      "https://ordinals.com/inscription/3a7752f3cbac8e1ad894f783998823b2af3ce1ed11a090cb410f8f347ddef8c3i0",
  },
  {
    inscription:
      "61d2a5c15bcd0d7e9c70832009b005c0f788596d57a5f02e5ce0baaf2d1721c4i0",
    location:
      "61d2a5c15bcd0d7e9c70832009b005c0f788596d57a5f02e5ce0baaf2d1721c4:0:0",
    explorer:
      "https://ordinals.com/inscription/61d2a5c15bcd0d7e9c70832009b005c0f788596d57a5f02e5ce0baaf2d1721c4i0",
  },
  {
    inscription:
      "920a0f23a6b60f66f8086e507d736f59ca211ba33479b1ab1bd2d5971be835c5i0",
    location:
      "920a0f23a6b60f66f8086e507d736f59ca211ba33479b1ab1bd2d5971be835c5:0:0",
    explorer:
      "https://ordinals.com/inscription/920a0f23a6b60f66f8086e507d736f59ca211ba33479b1ab1bd2d5971be835c5i0",
  },
  {
    inscription:
      "e913827d3d23759c5b7e08a219a0f01296208532ea5b505e2b3a236a7c6a34c9i0",
    location:
      "e913827d3d23759c5b7e08a219a0f01296208532ea5b505e2b3a236a7c6a34c9:0:0",
    explorer:
      "https://ordinals.com/inscription/e913827d3d23759c5b7e08a219a0f01296208532ea5b505e2b3a236a7c6a34c9i0",
  },
  {
    inscription:
      "2edf83f3969cd029cebd76d7e568557975369a5246742a0a451ae8d891b95dcai0",
    location:
      "2edf83f3969cd029cebd76d7e568557975369a5246742a0a451ae8d891b95dca:0:0",
    explorer:
      "https://ordinals.com/inscription/2edf83f3969cd029cebd76d7e568557975369a5246742a0a451ae8d891b95dcai0",
  },
  {
    inscription:
      "949d0478f69fe80c4d82e620241ec7494e25a7934028b47e188b82776efd60cai0",
    location:
      "949d0478f69fe80c4d82e620241ec7494e25a7934028b47e188b82776efd60ca:0:0",
    explorer:
      "https://ordinals.com/inscription/949d0478f69fe80c4d82e620241ec7494e25a7934028b47e188b82776efd60cai0",
  },
  {
    inscription:
      "546c9069774cfb0bfcb4c72ab6be7c1a811965c896d5e013fe750d91617d18cbi0",
    location:
      "546c9069774cfb0bfcb4c72ab6be7c1a811965c896d5e013fe750d91617d18cb:0:0",
    explorer:
      "https://ordinals.com/inscription/546c9069774cfb0bfcb4c72ab6be7c1a811965c896d5e013fe750d91617d18cbi0",
  },
  {
    inscription:
      "866fdae031c112aa11a9676879997e4bb5a8500f977be7edac6c81d2c36645d0i0",
    location:
      "866fdae031c112aa11a9676879997e4bb5a8500f977be7edac6c81d2c36645d0:0:0",
    explorer:
      "https://ordinals.com/inscription/866fdae031c112aa11a9676879997e4bb5a8500f977be7edac6c81d2c36645d0i0",
  },
  {
    inscription:
      "1163ff5545b612945140c39361b0f088734143b90525cc340e314f86ac436ed0i0",
    location:
      "1163ff5545b612945140c39361b0f088734143b90525cc340e314f86ac436ed0:0:0",
    explorer:
      "https://ordinals.com/inscription/1163ff5545b612945140c39361b0f088734143b90525cc340e314f86ac436ed0i0",
  },
  {
    inscription:
      "17aeb729829888626191507344428fdc981b2b2b7fb4381ec09d66c090cb4dd8i0",
    location:
      "17aeb729829888626191507344428fdc981b2b2b7fb4381ec09d66c090cb4dd8:0:0",
    explorer:
      "https://ordinals.com/inscription/17aeb729829888626191507344428fdc981b2b2b7fb4381ec09d66c090cb4dd8i0",
  },
  {
    inscription:
      "13075829336d517f6a983beb31b19ed8d1609e37895d2b30d340725b5f104bdbi0",
    location:
      "13075829336d517f6a983beb31b19ed8d1609e37895d2b30d340725b5f104bdb:0:0",
    explorer:
      "https://ordinals.com/inscription/13075829336d517f6a983beb31b19ed8d1609e37895d2b30d340725b5f104bdbi0",
  },
  {
    inscription:
      "878ea9291efbacc191c4b9532b28844c324ecd0f468386edeb186e5de80899dbi0",
    location:
      "878ea9291efbacc191c4b9532b28844c324ecd0f468386edeb186e5de80899db:0:0",
    explorer:
      "https://ordinals.com/inscription/878ea9291efbacc191c4b9532b28844c324ecd0f468386edeb186e5de80899dbi0",
  },
  {
    inscription:
      "5edb32b44dc60c38f0b6b6f85d76fb8d72ffabf600c04d8a6c9a92c1b03745dei0",
    location:
      "5edb32b44dc60c38f0b6b6f85d76fb8d72ffabf600c04d8a6c9a92c1b03745de:0:0",
    explorer:
      "https://ordinals.com/inscription/5edb32b44dc60c38f0b6b6f85d76fb8d72ffabf600c04d8a6c9a92c1b03745dei0",
  },
  {
    inscription:
      "121134a8b457f81eff816eee64727363583da69b2897ee780262911c271d0ddfi0",
    location:
      "121134a8b457f81eff816eee64727363583da69b2897ee780262911c271d0ddf:0:0",
    explorer:
      "https://ordinals.com/inscription/121134a8b457f81eff816eee64727363583da69b2897ee780262911c271d0ddfi0",
  },
  {
    inscription:
      "b09b81231ad9e92a49cccbea2fbad8aa6be16715e472d485cc519df8c78629e3i0",
    location:
      "b09b81231ad9e92a49cccbea2fbad8aa6be16715e472d485cc519df8c78629e3:0:0",
    explorer:
      "https://ordinals.com/inscription/b09b81231ad9e92a49cccbea2fbad8aa6be16715e472d485cc519df8c78629e3i0",
  },
  {
    inscription:
      "8acb7997296b98f4e2840e0018c40507586e2586b79db78036d8fa515f4d12e5i0",
    location:
      "8acb7997296b98f4e2840e0018c40507586e2586b79db78036d8fa515f4d12e5:0:0",
    explorer:
      "https://ordinals.com/inscription/8acb7997296b98f4e2840e0018c40507586e2586b79db78036d8fa515f4d12e5i0",
  },
  {
    inscription:
      "edf858a780fc4c3f830fb20ccc3d76e6b77747705731f46fd46a01bdc0cfc8f6i0",
    location:
      "edf858a780fc4c3f830fb20ccc3d76e6b77747705731f46fd46a01bdc0cfc8f6:0:0",
    explorer:
      "https://ordinals.com/inscription/edf858a780fc4c3f830fb20ccc3d76e6b77747705731f46fd46a01bdc0cfc8f6i0",
  },
  {
    inscription:
      "c559f8a807b46d29091be71d84db6bef8e382c1e47c984716ed8d11427fc06fai0",
    location:
      "c559f8a807b46d29091be71d84db6bef8e382c1e47c984716ed8d11427fc06fa:0:0",
    explorer:
      "https://ordinals.com/inscription/c559f8a807b46d29091be71d84db6bef8e382c1e47c984716ed8d11427fc06fai0",
  },
];

const newInscriptions = [
  {
    inscription:
      "3ed0b43057951bca9d0026354e3242c98206088c5a78d6f23bc09d1f1f2d8e19i0",
    location:
      "3ed0b43057951bca9d0026354e3242c98206088c5a78d6f23bc09d1f1f2d8e19:0:0",
    explorer:
      "https://ordinals.com/inscription/3ed0b43057951bca9d0026354e3242c98206088c5a78d6f23bc09d1f1f2d8e19i0",
    hash: 01,
  },
  {
    inscription:
      "6dd9d0d987060254e05b51d7f476310ddad3add43e0b0fa2cd48bd02b5b1533fi0",
    location:
      "6dd9d0d987060254e05b51d7f476310ddad3add43e0b0fa2cd48bd02b5b1533f:0:0",
    explorer:
      "https://ordinals.com/inscription/6dd9d0d987060254e05b51d7f476310ddad3add43e0b0fa2cd48bd02b5b1533fi0",
    hash: 02,
  },
  {
    inscription:
      "3e72556aeb2cdc73360f0ecc131aabd34c745dd36634f1be49d9d46ffd779272i0",
    location:
      "3e72556aeb2cdc73360f0ecc131aabd34c745dd36634f1be49d9d46ffd779272:0:0",
    explorer:
      "https://ordinals.com/inscription/3e72556aeb2cdc73360f0ecc131aabd34c745dd36634f1be49d9d46ffd779272i0",
    hash: 03,
  },
  {
    inscription:
      "5c586c4bb238ef5ab19ead1a105f33b71707c65bd8e52829d818744f131843a7i0",
    location:
      "5c586c4bb238ef5ab19ead1a105f33b71707c65bd8e52829d818744f131843a7:0:0",
    explorer:
      "https://ordinals.com/inscription/5c586c4bb238ef5ab19ead1a105f33b71707c65bd8e52829d818744f131843a7i0",
    hash: 04,
  },
  {
    inscription:
      "e1f2ca65fce4911f165b9a0b58a1f84f616e6c24d527994cdd619ad80c972eb4i0",
    location:
      "e1f2ca65fce4911f165b9a0b58a1f84f616e6c24d527994cdd619ad80c972eb4:0:0",
    explorer:
      "https://ordinals.com/inscription/e1f2ca65fce4911f165b9a0b58a1f84f616e6c24d527994cdd619ad80c972eb4i0",
    hash: 05,
  },
  {
    inscription:
      "d20472e91a4881973e924d8f434f8c1d0b1d7cf5a7dc0602460409023c3420c4i0",
    location:
      "d20472e91a4881973e924d8f434f8c1d0b1d7cf5a7dc0602460409023c3420c4:0:0",
    explorer:
      "https://ordinals.com/inscription/d20472e91a4881973e924d8f434f8c1d0b1d7cf5a7dc0602460409023c3420c4i0",
    hash: 06,
  },
  {
    commit: "68dd515718b35324ac90168a31d51c6ebb02fa44f5fbf520cdde77fde5d4e99d",
    inscription:
      "4330b849d7c11df5355ae8e83c987cbc014ecdceb4a252a21298265ed8a9e800i0",
    reveal: "4330b849d7c11df5355ae8e83c987cbc014ecdceb4a252a21298265ed8a9e800",
    fees: 5520,
  },

  {
    commit: "0198d9e9afc3266b37754a9d2893586510977b9527b2a9cfa2bfa68fdc885844",
    inscription:
      "05eae45e8377cf15e3274be8c263ca038410c0cdadb74f0a9f28a46b2472a1cdi0",
    reveal: "05eae45e8377cf15e3274be8c263ca038410c0cdadb74f0a9f28a46b2472a1cd",
    fees: 5610,
  },

  {
    commit: "1dd5976e9450cd65a12095f765b8d8914536a47363d98ab9aa51b19ce8889e01",
    inscription:
      "0f3b34e368b7e1924389517a46bfd32c550e6973a2413c09bbb4bc1372ed7c7ei0",
    reveal: "0f3b34e368b7e1924389517a46bfd32c550e6973a2413c09bbb4bc1372ed7c7e",
    fees: 3468,
  },

  {
    commit: "96c3aa3704d320e2fcd9989dece1a24d15f9665f50fe02939d63ca19a6c52ce2",
    inscription:
      "5ba6a9db323741b192e71b5fff7d815bd0048d8b82dd16164b8a8614882b56f7i0",
    reveal: "5ba6a9db323741b192e71b5fff7d815bd0048d8b82dd16164b8a8614882b56f7",
    fees: 3768,
  },

  {
    commit: "a00cb85ef3a5cbac7954d217c63229eb8c6ac41ad2c5d1743a1b6fdda187bd97",
    inscription:
      "9aafbced199d115f752fdb0e8efa4528fddd5c17f8e5cf5e7bbff304cb4ba50bi0",
    reveal: "9aafbced199d115f752fdb0e8efa4528fddd5c17f8e5cf5e7bbff304cb4ba50b",
    fees: 3192,
  },

  {
    commit: "3a9577ce25c4918bc443905d3f14ef9b008140f79764b3ee7c8381fdd19c7711",
    inscription:
      "09338167fdb7f11e2282c4644f49991371696c1d9275103da12f1899306ef27bi0",
    reveal: "09338167fdb7f11e2282c4644f49991371696c1d9275103da12f1899306ef27b",
    fees: 3036,
  },

  {
    commit: "a1b69b5240371192ee3dfc6e382741e4a10c9652e1e0a7764c9bad3241629a8f",
    inscription:
      "a73237009174eab37966947f125227f051cc177014fc11f46ca86b6cc2d5d073i0",
    reveal: "a73237009174eab37966947f125227f051cc177014fc11f46ca86b6cc2d5d073",
    fees: 3174,
  },

  {
    commit: "0175f17305c658a829fba7426e3b3c36a4a79096f980ef3c49b8c43cf56b2d77",
    inscription:
      "462bd6447125ceacf4783f6457993b47ce69c6949573f73f4cd9ac78965d37fci0",
    reveal: "462bd6447125ceacf4783f6457993b47ce69c6949573f73f4cd9ac78965d37fc",
    fees: 2922,
  },
  {
    commit: "32f6a0e351337efe2456fe89fff4a6a52c6352f35a51db9788069b29dc767eb0",
    inscription:
      "17aeb729829888626191507344428fdc981b2b2b7fb4381ec09d66c090cb4dd8i0",
    reveal: "17aeb729829888626191507344428fdc981b2b2b7fb4381ec09d66c090cb4dd8",
    fees: 3102,
  },
  {
    commit: "4adf2d7aef0e2d7888f1f5bb7c52b91360e14fdaacfce4f93c96a2069ecf4dd6",
    inscription:
      "bd1142e59a571bc44fd28c1402bba235b80dd1979dead4f41a55f7cec8589766i0",
    reveal: "bd1142e59a571bc44fd28c1402bba235b80dd1979dead4f41a55f7cec8589766",
    fees: 2364,
  },
  {
    commit: "069c6fbbdc242d0ef5e692cd7f3882bee57e1957a49fde10d8dc4b10e1582361",
    inscription:
      "16f89cd53adc9b16131ef1dddb2f2a16b8fb7ae3c2c8626a334b1007aa28589ei0",
    reveal: "16f89cd53adc9b16131ef1dddb2f2a16b8fb7ae3c2c8626a334b1007aa28589e",
    fees: 2502,
  },
  {
    commit: "846543df18060fea77609f1800a8525cffa6ad84f9a38d390e71a9fc295f3cf7",
    inscription:
      "61d2a5c15bcd0d7e9c70832009b005c0f788596d57a5f02e5ce0baaf2d1721c4i0",
    reveal: "61d2a5c15bcd0d7e9c70832009b005c0f788596d57a5f02e5ce0baaf2d1721c4",
    fees: 2364,
  },
  {
    commit: "4491753384809ee9b7bbc7bc1185723afdc695a94fd5ce106934da684e81b748",
    inscription:
      "b5e106ed34ab9bf08fd270854379acb3a22f776cda74c138af0696b8ac678c3fi0",
    reveal: "b5e106ed34ab9bf08fd270854379acb3a22f776cda74c138af0696b8ac678c3f",
    fees: 2688,
  },
  {
    commit: "b0ac6601fe893d22d903c8f7097bb4a973c75262b994e0cdaf8cf2a899b9e354",
    inscription:
      "94a8cb922f51c2eece59e9fae3ba64d3d0d985da100dafaa3c4980c620845790i0",
    reveal: "94a8cb922f51c2eece59e9fae3ba64d3d0d985da100dafaa3c4980c620845790",
    fees: 2580,
  },
  {
    commit: "b1c3b793f989374b6fb7a119e0f3bd0305f394621e83c5df8e509d8c4bb5de05",
    inscription:
      "c8b3eaf44dd099f0f3a3f68cad9e97b53569d86fcfe7bf322c69f0b596499268i0",
    reveal: "c8b3eaf44dd099f0f3a3f68cad9e97b53569d86fcfe7bf322c69f0b596499268",
    fees: 2244,
  },
  {
    commit: "51501892f7a9f0d394e6c45c42308f27b14a29b10bf01dfea0728aa5623d3e8f",
    inscription:
      "b09b81231ad9e92a49cccbea2fbad8aa6be16715e472d485cc519df8c78629e3i0",
    reveal: "b09b81231ad9e92a49cccbea2fbad8aa6be16715e472d485cc519df8c78629e3",
    fees: 2388,
  },
  {
    commit: "d9a8e40bf21157189a4a973f12c62aedb401b51039974007a0445eb6dd52fa10",
    inscription:
      "4e07cdec48ec4d04c13029c6446d3b22ec5e540cbe878ac8329e1e30997f16fbi0",
    reveal: "4e07cdec48ec4d04c13029c6446d3b22ec5e540cbe878ac8329e1e30997f16fb",
    fees: 2478,
  },
  {
    commit: "502a9a4b363a7560735d25280eec9df47f701b4b01a91a13076255ed9af4a33b",
    inscription:
      "5301b981a684979fb62d0543aa088e1b892ed807758f1444a42b754abc19d8bci0",
    reveal: "5301b981a684979fb62d0543aa088e1b892ed807758f1444a42b754abc19d8bc",
    fees: 2640,
  },
  {
    commit: "ac4095285d15bbdf363ea29df1b3adb2ac29f79c127e53dbe6e6a85f889910f3",
    inscription:
      "b497b6446f2f3db58b84e2bd5443cae4033b53624c7ada33a5bc9ace667dcdaci0",
    reveal: "b497b6446f2f3db58b84e2bd5443cae4033b53624c7ada33a5bc9ace667dcdac",
    fees: 2592,
  },
  {
    commit: "a12be60d34b5438f9744b73152ae419869f2f0f501c45747e6301791899134fa",
    inscription:
      "866fdae031c112aa11a9676879997e4bb5a8500f977be7edac6c81d2c36645d0i0",
    reveal: "866fdae031c112aa11a9676879997e4bb5a8500f977be7edac6c81d2c36645d0",
    fees: 2652,
  },
  {
    commit: "5d557c9dde773ec03d98145f9a6a8ab4929063d6942955d547be7cfc9859b4ee",
    inscription:
      "edf858a780fc4c3f830fb20ccc3d76e6b77747705731f46fd46a01bdc0cfc8f6i0",
    reveal: "edf858a780fc4c3f830fb20ccc3d76e6b77747705731f46fd46a01bdc0cfc8f6",
    fees: 2706,
  },
  {
    commit: "a700447c946dfeb7a440c88e9bd4529936cdf54f677fb12e6083243deb6d209f",
    inscription:
      "f574c06a4b12f5f228bfb6d4c0f0cd920f4d40cc2f02bfbb80f102e5d0021f79i0",
    reveal: "f574c06a4b12f5f228bfb6d4c0f0cd920f4d40cc2f02bfbb80f102e5d0021f79",
    fees: 3492,
  },
  {
    commit: "6435eacf70de9f7db469e319d5a978894dc99f9e7ef07bea19814823f3951deb",
    inscription:
      "574b52da3cd80cfb18f4f4c98f0f9913948757d5742aa1872d1735f4ed3aa6b1i0",
    reveal: "574b52da3cd80cfb18f4f4c98f0f9913948757d5742aa1872d1735f4ed3aa6b1",
    fees: 2412,
  },
  {
    commit: "0f83496cdd234315da438bdfbfbdcd3e1089216f310e61739adea3315714939b",
    inscription:
      "13075829336d517f6a983beb31b19ed8d1609e37895d2b30d340725b5f104bdbi0",
    reveal: "13075829336d517f6a983beb31b19ed8d1609e37895d2b30d340725b5f104bdb",
    fees: 2478,
  },
  {
    commit: "84009894e0deaa4656cf7d7c6f9c4b519efff9574036668cc050d849bd9acdd4",
    inscription:
      "93cde4105e6c0e9beba386c83fe664e398083b3d34438156e26609a7d7cfdf8ci0",
    reveal: "93cde4105e6c0e9beba386c83fe664e398083b3d34438156e26609a7d7cfdf8c",
    fees: 2532,
  },
  {
    commit: "c8f4cad89cd840859b769929faa398b3825542e310e7373b18ee7571a5dbcf29",
    inscription:
      "8c98784f1b9428a994878bae83cb00e0ff0e0aec884eabe5f3c437f68c92eb46i0",
    reveal: "8c98784f1b9428a994878bae83cb00e0ff0e0aec884eabe5f3c437f68c92eb46",
    fees: 2580,
  },
  {
    commit: "09e2e7992e4344c2c8a3b2d4d08c76377907650b15a630e2da0c7c03b4ebe510",
    inscription:
      "b26b89c821f8b446fcd80bc5ff1de997da7e08d3da6064c4d1a216180f9aa829i0",
    reveal: "b26b89c821f8b446fcd80bc5ff1de997da7e08d3da6064c4d1a216180f9aa829",
    fees: 2718,
  },
  {
    commit: "74baa68cf19af4cffe566a7ccb3515ad1c3f51b63a8ec3ab1102fc3dc4ddbffe",
    inscription:
      "6dbf182f70846f417f773764b50f244e29fa8733112a91d3b3b28641fd49ed6ai0",
    reveal: "6dbf182f70846f417f773764b50f244e29fa8733112a91d3b3b28641fd49ed6a",
    fees: 2574,
  },
  {
    commit: "cb3306b08681d13e0a1b049a08fbdfeaf8d235cbed4cc810e81ea66e0b861877",
    inscription:
      "f7aa19b76b2bce2e873ef88c58d13e8fb119e18274f95bc9dba586c4175eda9ei0",
    reveal: "f7aa19b76b2bce2e873ef88c58d13e8fb119e18274f95bc9dba586c4175eda9e",
    fees: 2730,
  },
  {
    commit: "0bd72e7f56d022514f6fe61e5dc59d10d493fb59bf57adff93ea0dc55378fb7d",
    inscription:
      "a2556130f3c7cc020484173a06b2967eebfd75f96ca1cc6686c108c3b2c214bai0",
    reveal: "a2556130f3c7cc020484173a06b2967eebfd75f96ca1cc6686c108c3b2c214ba",
    fees: 2718,
  },
  {
    commit: "a716c549ed0341dcf987966a8b22c79036c34625530c592660181d41baeaf4b7",
    inscription:
      "2ae0ac444ec444534656bf0ea5b55250dbb8111b9a112350fc459bf0d50b4760i0",
    reveal: "2ae0ac444ec444534656bf0ea5b55250dbb8111b9a112350fc459bf0d50b4760",
    fees: 3432,
  },
  {
    commit: "2c163ec2e66dbd324c567ea2157ff052810adde0cc5ccd99cc51c415c1b48fa2",
    inscription:
      "5df39d80e3428f241900b83c512da0bab84ee65a8d8363ba85ae0103ef9e4d2fi0",
    reveal: "5df39d80e3428f241900b83c512da0bab84ee65a8d8363ba85ae0103ef9e4d2f",
    fees: 2742,
  },
  {
    commit: "dc68cc873db8d7980b8a7ac8ceef9f6d54cdcb51897fdbf74ecafd34312750b2",
    inscription:
      "3a7752f3cbac8e1ad894f783998823b2af3ce1ed11a090cb410f8f347ddef8c3i0",
    reveal: "3a7752f3cbac8e1ad894f783998823b2af3ce1ed11a090cb410f8f347ddef8c3",
    fees: 2742,
  },
  {
    commit: "e405a54c66d9cbfd037f3d1c8b22a0640818dd8c588278558b99c3cd901b2ffb",
    inscription:
      "c559f8a807b46d29091be71d84db6bef8e382c1e47c984716ed8d11427fc06fai0",
    reveal: "c559f8a807b46d29091be71d84db6bef8e382c1e47c984716ed8d11427fc06fa",
    fees: 3492,
  },
  {
    commit: "8f12a73133eea1cada883ef2d57b8a722661388d8e28ef69749872188795b58d",
    inscription:
      "a140cdbed24cb634cd53a624a1510ae0feb115962fd8974e0545a3bcff2a9d1ci0",
    reveal: "a140cdbed24cb634cd53a624a1510ae0feb115962fd8974e0545a3bcff2a9d1c",
    fees: 3516,
  },
  {
    commit: "877c0abdb991fc497e62c9afc46f3497450f7104e9d9c1b777b37c9e49e72bcb",
    inscription:
      "687c4803e3c839b883ba3381a20ca73d5731f15d19f52dad4317a28d598c6140i0",
    reveal: "687c4803e3c839b883ba3381a20ca73d5731f15d19f52dad4317a28d598c6140",
    fees: 3546,
  },
  {
    commit: "7164f9aa1d9030fab1d412e2ac4bde1ae6ff6c407d029e9acf4a3fe10d1e7035",
    inscription:
      "11ee98301ffd124a1126bc303c5d6b858486d1288b0a0feb5ae5dfcfd1894c19i0",
    reveal: "11ee98301ffd124a1126bc303c5d6b858486d1288b0a0feb5ae5dfcfd1894c19",
    fees: 3426,
  },
  {
    commit: "dccb431d99997245aaa301da25fad1316a1c6cb1f164c28806c5663c4888e50f",
    inscription:
      "e4fa45f4ffe76699b4825de0d6296c253e1ed7ecd7b775b335f58c967e368ca1i0",
    reveal: "e4fa45f4ffe76699b4825de0d6296c253e1ed7ecd7b775b335f58c967e368ca1",
    fees: 2706,
  },
  {
    commit: "3c66c5b5d4f498a7e209677be0102984ffa676320860ba8509ac6a4d4e8462b6",
    inscription:
      "e6401d576d2dc44440042928e76e3fd58de3d5726327a9a03fdce773fd531149i0",
    reveal: "e6401d576d2dc44440042928e76e3fd58de3d5726327a9a03fdce773fd531149",
    fees: 3408,
  },
  {
    commit: "d224807bc11fd5d5bba744f5b25f7d2cb0394bf8effbc0845b0d40df9a2e22d4",
    inscription:
      "da37cf143fdc658a479f469fa5066d99cf374eed675df0ee304c112168321ca5i0",
    reveal: "da37cf143fdc658a479f469fa5066d99cf374eed675df0ee304c112168321ca5",
    fees: 3384,
  },
  {
    commit: "f1d9d19801600bb66de9bde7a53011b84f255b56c261bac1c1bdfb02c573bd92",
    inscription:
      "cb91de11de61daa74d983dfc08f74e3c7b50feda2be711fa30ef3de9d889ccf0i0",
    reveal: "cb91de11de61daa74d983dfc08f74e3c7b50feda2be711fa30ef3de9d889ccf0",
    fees: 3288,
  },
  {
    commit: "ab988c666ad89c81f007717706368997771e33c4493f05451bd8d9ed8c65047e",
    inscription:
      "546c9069774cfb0bfcb4c72ab6be7c1a811965c896d5e013fe750d91617d18cbi0",
    reveal: "546c9069774cfb0bfcb4c72ab6be7c1a811965c896d5e013fe750d91617d18cb",
    fees: 3138,
  },
  {
    commit: "26f1eae630bf780f54dc1e55452b8cac7587da709be75016770bd1a2f4b6db3b",
    inscription:
      "418a3cefd268840f1ecee5591da0f2a52e3d33eb9a40c697d3fdefaa1f98d258i0",
    reveal: "418a3cefd268840f1ecee5591da0f2a52e3d33eb9a40c697d3fdefaa1f98d258",
    fees: 3300,
  },
  {
    commit: "3aaebf02b8b9da40eefeeab03bdac0356983b848c5b67f5044f942bf17812004",
    inscription:
      "7066dd4c37b14aaf0526c233d7aed31378bc69f2c9a1e1a68fd4314afd8627eai0",
    reveal: "7066dd4c37b14aaf0526c233d7aed31378bc69f2c9a1e1a68fd4314afd8627ea",
    fees: 3396,
  },
  {
    commit: "9db986aa7d9874740b4423b19f457de8493a9d6e0b0acecb52cffdb8c453ade1",
    inscription:
      "e913827d3d23759c5b7e08a219a0f01296208532ea5b505e2b3a236a7c6a34c9i0",
    reveal: "e913827d3d23759c5b7e08a219a0f01296208532ea5b505e2b3a236a7c6a34c9",
    fees: 2694,
  },
  {
    commit: "b30282e8582f7bfacde5c877aafbfd47c79932a6e5a7be3cecd323db03d1e5ff",
    inscription:
      "2acfa22968b276e4e583c5526959a19e3c7c81d8ee2e5bfd01cd72f73804733ci0",
    reveal: "2acfa22968b276e4e583c5526959a19e3c7c81d8ee2e5bfd01cd72f73804733c",
    fees: 2688,
  },
  {
    commit: "2d8fa45c33559ef72841b276264f6b1d84951204f5ef20b4b63a117e9bd89124",
    inscription:
      "4929cb2c2e60db85ab3bc6acc8bd82d116b681fb45e3479178827413747edc77i0",
    reveal: "4929cb2c2e60db85ab3bc6acc8bd82d116b681fb45e3479178827413747edc77",
    fees: 2598,
  },
  {
    commit: "064f87d6235f44c79b26aee807e95e2b9163dce57c8af07d9dbe57ce6baf5114",
    inscription:
      "27622ac76b9c54b93f790c7e603b3bf89457cb7b2302e0d143af617739ccd2dfi0",
    reveal: "27622ac76b9c54b93f790c7e603b3bf89457cb7b2302e0d143af617739ccd2df",
    fees: 3426,
  },
  {
    commit: "d9330131d4a704ca04396e5a7c0e000563e4ba20af66f7856dbbdf0f9fe2df3b",
    inscription:
      "b0e16f0e7f1f4fb6228efa92b3624528940529c84881bcfa8da31ae3fe68d915i0",
    reveal: "b0e16f0e7f1f4fb6228efa92b3624528940529c84881bcfa8da31ae3fe68d915",
    fees: 2748,
  },
  {
    commit: "bab0a29bf072c02276cb209984873f3f275254848ddab68f91db2a27e0b79060",
    inscription:
      "7b0c14a6a8b3a058b2858d67a020345455aab954f1d697247315fe0cf74dd745i0",
    reveal: "7b0c14a6a8b3a058b2858d67a020345455aab954f1d697247315fe0cf74dd745",
    fees: 2622,
  },
  {
    commit: "87940ff01e216d84be7950da835ca5cbd86b946649c6dea1a8dc305005a41c31",
    inscription:
      "2ed162f16a6d847136a86c234c3b7073d98e89c09a5cf6285ea4a52a82e15916i0",
    reveal: "2ed162f16a6d847136a86c234c3b7073d98e89c09a5cf6285ea4a52a82e15916",
    fees: 2742,
  },
  {
    commit: "60ccfcf6325c30faa619e0832fc0c65cb8ef976c221b400cdc5d7727126e8727",
    inscription:
      "a3530dcf3287e5c54e16d14f2ecdb22e65ab2e31b138558b2961ff1fc0637ad4i0",
    reveal: "a3530dcf3287e5c54e16d14f2ecdb22e65ab2e31b138558b2961ff1fc0637ad4",
    fees: 3384,
  },
  {
    commit: "e2c4420eec88936fe9ca089ef0f02dafe968c9d0a68c861764b712ddbb1aedc5",
    inscription:
      "99e3e6ec026b66e12ea5bbc36b9504b1bfb4ff0bd7c525b22a73abf10c5d78bci0",
    reveal: "99e3e6ec026b66e12ea5bbc36b9504b1bfb4ff0bd7c525b22a73abf10c5d78bc",
    fees: 2706,
  },
  {
    commit: "4aac9f018610b10f1b9eba0cd42a29215d445e855b9f6ea78815936f990b1471",
    inscription:
      "d2268c34eefb25880a2c8560339a9841f1a7c0dbe166b1a7464e54584c721053i0",
    reveal: "d2268c34eefb25880a2c8560339a9841f1a7c0dbe166b1a7464e54584c721053",
    fees: 3420,
  },
  {
    commit: "f0007f6ff51c9109ac258cb3441a2f25eba8ae8f3fdfb063ef89cb8a98335f36",
    inscription:
      "774bc6a7065038ebedb2567dc12b7a2e475b61c2494acfc4457446609fd9d23ai0",
    reveal: "774bc6a7065038ebedb2567dc12b7a2e475b61c2494acfc4457446609fd9d23a",
    fees: 3060,
  },
  {
    commit: "a0075d8dd899473d0b514dfa618ebb38157bcd6fc0c1cb8d89570b3e23e2e6a4",
    inscription:
      "f5a5ec183ac3ee5de504943c3835dd63f35fafcae813c0ebd459dfcf820cce08i0",
    reveal: "f5a5ec183ac3ee5de504943c3835dd63f35fafcae813c0ebd459dfcf820cce08",
    fees: 3042,
  },
  {
    commit: "6b3cfacb9df1498280469dc2ab6b6e8cf6d61828b795d696e1550e9973265dd0",
    inscription:
      "1163ff5545b612945140c39361b0f088734143b90525cc340e314f86ac436ed0i0",
    reveal: "1163ff5545b612945140c39361b0f088734143b90525cc340e314f86ac436ed0",
    fees: 2994,
  },
  {
    commit: "0853d7159f5ec7f06abcd33b989380c84480f2a10b4173ad8d6f62ed30175bb3",
    inscription:
      "05c397c8a1dedb792de0f4f623d0b2d3e07acd4c54abb3f725e40467b547e364i0",
    reveal: "05c397c8a1dedb792de0f4f623d0b2d3e07acd4c54abb3f725e40467b547e364",
    fees: 3510,
  },
  {
    commit: "e8558f1dd24d728887828177bf4ba78c24166e56f91db7b2fb11d1ccae99de93",
    inscription:
      "61af154bc6035e4dd3df65eabc46c0976a64c3015384857527642debe76faa0ai0",
    reveal: "61af154bc6035e4dd3df65eabc46c0976a64c3015384857527642debe76faa0a",
    fees: 3288,
  },
  {
    commit: "b2b9acdaf0467e66455b21b6f67aba33f4016b9673804fa48f6c065acd81ba82",
    inscription:
      "6f47fd951fd7a2a4d1bce42379dfe34e43d9354e9bcde05428bfb9200ffa1be2i0",
    reveal: "6f47fd951fd7a2a4d1bce42379dfe34e43d9354e9bcde05428bfb9200ffa1be2",
    fees: 3402,
  },
  {
    commit: "1da32e042da0f19bc0b4afdfb1554f706b954feb49d4b27dabaeadeff18ce464",
    inscription:
      "4cdc8dddade958d15f4ddd456c4d7a6e346e5522793b7fe088e817439361302ei0",
    reveal: "4cdc8dddade958d15f4ddd456c4d7a6e346e5522793b7fe088e817439361302e",
    fees: 3336,
  },
  {
    commit: "0da531db67661cbc5cb8b53c42f13ba5022fb142f27ffa76ae282e70efe844e1",
    inscription:
      "8fb87fc9c97c69f154a110e1b13218e4360242794736a7fc82f9f97bad521a4ci0",
    reveal: "8fb87fc9c97c69f154a110e1b13218e4360242794736a7fc82f9f97bad521a4c",
    fees: 3342,
  },
  {
    commit: "18af27425c097c4ae013cdcb8de588010963af623d06d140bf93017991966793",
    inscription:
      "2eb1c1f1f8b7ccc273e0ad1ccdecea9f997367512094f18ebf9bae9d56ca3eabi0",
    reveal: "2eb1c1f1f8b7ccc273e0ad1ccdecea9f997367512094f18ebf9bae9d56ca3eab",
    fees: 3234,
  },
  {
    commit: "78d05267fed45bc178541558ba23b8a85ffcb2827d33683a053beb76f2373bc6",
    inscription:
      "197c24177d7f98fb978d42d54f1e0433d35a630ce952a946549af52bb2fbf1dai0",
    reveal: "197c24177d7f98fb978d42d54f1e0433d35a630ce952a946549af52bb2fbf1da",
    fees: 3342,
  },
  {
    commit: "8b20c8e6d3293f2935fd64be270549c808839931b56217563c90a386cf48f9be",
    inscription:
      "487f9d4c2e3e7216366d2cbe63adba1f3fda46991c8b9b22207aa247c6335570i0",
    reveal: "487f9d4c2e3e7216366d2cbe63adba1f3fda46991c8b9b22207aa247c6335570",
    fees: 3258,
  },
  {
    commit: "78deac35525489a05095c740e7f510c322fa8a81ac6cf01be0732f2cb617f1f8",
    inscription:
      "147e277c2eaf934243ecc8e83118668450a4f5ed2db8a03bac61b8e6b0c9cb42i0",
    reveal: "147e277c2eaf934243ecc8e83118668450a4f5ed2db8a03bac61b8e6b0c9cb42",
    fees: 3426,
  },
  {
    commit: "c71c23b744133cea3c9d26cc61eb94693c01eeed4068c7778942684b688a4461",
    inscription:
      "2a010584e16e62dde16247cbd71491b651afa6d90609228a57e9336189cc8c26i0",
    reveal: "2a010584e16e62dde16247cbd71491b651afa6d90609228a57e9336189cc8c26",
    fees: 3432,
  },
  {
    commit: "481eaca5818c2065910c63a1d5ac9f29bd2cdb7c1a23476aba7da23b984801c3",
    inscription:
      "4f66d7ed35f8a76eb5edf7bbeac352ddc5db83f8a69a09573837a3eebe2a28b6i0",
    reveal: "4f66d7ed35f8a76eb5edf7bbeac352ddc5db83f8a69a09573837a3eebe2a28b6",
    fees: 3438,
  },
  {
    commit: "aaa99c82f05a464badbbfd98bb3d0772ccf329675f1393fc89751cfb86166291",
    inscription:
      "8acb7997296b98f4e2840e0018c40507586e2586b79db78036d8fa515f4d12e5i0",
    reveal: "8acb7997296b98f4e2840e0018c40507586e2586b79db78036d8fa515f4d12e5",
    fees: 3246,
  },
  {
    commit: "500ca90c6f1197548d504f12127997632847f81c370835b2222b73c732fb3bae",
    inscription:
      "920a0f23a6b60f66f8086e507d736f59ca211ba33479b1ab1bd2d5971be835c5i0",
    reveal: "920a0f23a6b60f66f8086e507d736f59ca211ba33479b1ab1bd2d5971be835c5",
    fees: 3366,
  },
  {
    commit: "abe3ff424fa3c4e2b18d0b809b9cd003fd36862cd5983fca9619030a756916f3",
    inscription:
      "748363fa5d2df25219512b699c638200efc8cde3e329e0471a375d914a7e8b39i0",
    reveal: "748363fa5d2df25219512b699c638200efc8cde3e329e0471a375d914a7e8b39",
    fees: 3348,
  },
  {
    commit: "59ff21ca662351eabe9f834bbb47c4cddd18a6e6482bd8bf0c5679615b2d4fdd",
    inscription:
      "db5b2ea34e4b1d2d598c0d307c748eb33e00be92cd5ca80e82e51c0cac0f265fi0",
    reveal: "db5b2ea34e4b1d2d598c0d307c748eb33e00be92cd5ca80e82e51c0cac0f265f",
    fees: 5862,
  },
  {
    commit: "f5d15e9449a4fed7cacea2a2234089fee9e24b09c12e09919b99dd8efeb3829f",
    inscription:
      "4a3b48c7e42e0375be62bb4aa2cd8021dbec6ef6ede029fb42ca9c2b2f383f2di0",
    reveal: "4a3b48c7e42e0375be62bb4aa2cd8021dbec6ef6ede029fb42ca9c2b2f383f2d",
    fees: 5892,
  },
  {
    commit: "79ea306e17dfe1a0f00a7992da5c85f4d13d6041e3c323fb58346d96b516df0e",
    inscription:
      "e52b143d5520fa9ff6043c2543cf394c8b2f5dcfb6dd28d8cddbfab75eac3204i0",
    reveal: "e52b143d5520fa9ff6043c2543cf394c8b2f5dcfb6dd28d8cddbfab75eac3204",
    fees: 5916,
  },
  {
    commit: "f266994f5c9d871708b950f503cef67cd1c844836991204a0e18eadc5a8766c6",
    inscription:
      "988766cea47f698390ca7d3dd8652042096cd401c95b130c7b2ec5c78d75818ci0",
    reveal: "988766cea47f698390ca7d3dd8652042096cd401c95b130c7b2ec5c78d75818c",
    fees: 5292,
  },
  {
    commit: "74a6937ac647de080ef1b0f4d8e042c07a2384555806c318403f71eb424a90c7",
    inscription:
      "7adb5a04320fb97175d804d79b01d6ffaf7918addb603c450af264f4a940491bi0",
    reveal: "7adb5a04320fb97175d804d79b01d6ffaf7918addb603c450af264f4a940491b",
    fees: 4644,
  },
  {
    commit: "bf51c0e7f6bd545e3feb2fe8597915bc20cf6262baa090d475c3bbcf44d94a5c",
    inscription:
      "878ea9291efbacc191c4b9532b28844c324ecd0f468386edeb186e5de80899dbi0",
    reveal: "878ea9291efbacc191c4b9532b28844c324ecd0f468386edeb186e5de80899db",
    fees: 4014,
  },
  {
    commit: "e59f47f5dadce9503a9414fb44712494aa76ee6f9e025d48edabbc27339d1f5f",
    inscription:
      "94d2d8134b927b0957a05f12a2ff856928bed398b04fdc2960f4bf1735292a7bi0",
    reveal: "94d2d8134b927b0957a05f12a2ff856928bed398b04fdc2960f4bf1735292a7b",
    fees: 3972,
  },
  {
    commit: "81a62ef9d2989374ed8182cd4ec0af98ca0be29e440447b3dce0b196e08d810a",
    inscription:
      "dcfa70ba271955e01826e0586410e99672c32d84f7cd0f6a9ba87ed9cfc9fd9ei0",
    reveal: "dcfa70ba271955e01826e0586410e99672c32d84f7cd0f6a9ba87ed9cfc9fd9e",
    fees: 4098,
  },
  {
    commit: "91ef2de9c33cbbf6382ab5fdf77ccf7602d89cc7a6cc8022037cb63097674e21",
    inscription:
      "c4e61c11e5003e2fe2d138cb2abe397cc050b19123dd1037e369d290303e7a80i0",
    reveal: "c4e61c11e5003e2fe2d138cb2abe397cc050b19123dd1037e369d290303e7a80",
    fees: 4230,
  },
  {
    commit: "be3148926b4fee0784427d89f9b10efb6e35fa53999c5f96534c3856f73f5ba8",
    inscription:
      "49452f91fc1867410c72eafeef3a1399da7c44f1dac9df36f6e1b8061163f604i0",
    reveal: "49452f91fc1867410c72eafeef3a1399da7c44f1dac9df36f6e1b8061163f604",
    fees: 4044,
  },
  {
    commit: "7bcc45bd7b96e81bd4fad6a3b31872ffce42fbe75be1ccc4bce7083a9f5e91ab",
    inscription:
      "919a72170720c278b012c95e8d9f18d973e91d2b90bc24ec46423d68097e5ac1i0",
    reveal: "919a72170720c278b012c95e8d9f18d973e91d2b90bc24ec46423d68097e5ac1",
    fees: 4824,
  },
  {
    commit: "c8458d179d91ac7babf5890ef9c08a95790409dd24d5855b400408a3f180c991",
    inscription:
      "949d0478f69fe80c4d82e620241ec7494e25a7934028b47e188b82776efd60cai0",
    reveal: "949d0478f69fe80c4d82e620241ec7494e25a7934028b47e188b82776efd60ca",
    fees: 3972,
  },
  {
    commit: "29841f3fd7acb782ee05f670cae0d48e10709fdb702a403beebea83ac8d695f1",
    inscription:
      "52975e529259a94b962c2695f8069b72a45a9721d48b433bc4f45789fa34cb0ai0",
    reveal: "52975e529259a94b962c2695f8069b72a45a9721d48b433bc4f45789fa34cb0a",
    fees: 4140,
  },
  {
    commit: "863c9557b471ebe2efcfd28186c5337742a383bc77242f05cb354653a58958c7",
    inscription:
      "2edf83f3969cd029cebd76d7e568557975369a5246742a0a451ae8d891b95dcai0",
    reveal: "2edf83f3969cd029cebd76d7e568557975369a5246742a0a451ae8d891b95dca",
    fees: 3168,
  },
  {
    commit: "1c717e8803ffed0f8e183703507c0443245f1ba1541d334e2fcf61dd3b2e1a60",
    inscription:
      "b591d7359b959a8ec4a1991671800da35f4e4895590f6dadc22408fd9bd65805i0",
    reveal: "b591d7359b959a8ec4a1991671800da35f4e4895590f6dadc22408fd9bd65805",
    fees: 3612,
  },
  {
    commit: "a9a75c599c354bb5cf010a15271b9e5a4ccf6554b734bace4d407cce91441774",
    inscription:
      "7f8f8ba0e5231c95359cf9af234325513c5b3869061fc7621c4cc7128b24915ci0",
    reveal: "7f8f8ba0e5231c95359cf9af234325513c5b3869061fc7621c4cc7128b24915c",
    fees: 5322,
  },
  {
    commit: "64741ea7c0fd4693d7ec38fbea64a2ed3afcb35612c3d99df4273d5c57a509d0",
    inscription:
      "0844e55b957af449d23344ccdf1a10f2ea8ecddc75c6d97826ad6f3e51080267i0",
    reveal: "0844e55b957af449d23344ccdf1a10f2ea8ecddc75c6d97826ad6f3e51080267",
    fees: 4200,
  },
  {
    commit: "c45327f3147167d8994226095e6a29242b514950af9acb0f6e0676a27bde19a1",
    inscription:
      "5360b17147d298a37fd39e1951de165892e01f3c70e122f00985ed4a5de26a65i0",
    reveal: "5360b17147d298a37fd39e1951de165892e01f3c70e122f00985ed4a5de26a65",
    fees: 7728,
  },
  {
    commit: "795414030747864b7834286f6cbaa4dc918a2193189466e33a3e952330ce7d97",
    inscription:
      "5edb32b44dc60c38f0b6b6f85d76fb8d72ffabf600c04d8a6c9a92c1b03745dei0",
    reveal: "5edb32b44dc60c38f0b6b6f85d76fb8d72ffabf600c04d8a6c9a92c1b03745de",
    fees: 3084,
  },
  {
    commit: "f5df3a45779c52b793ca0024062f55fc043437b7692593ee5041687602c0af39",
    inscription:
      "121134a8b457f81eff816eee64727363583da69b2897ee780262911c271d0ddfi0",
    reveal: "121134a8b457f81eff816eee64727363583da69b2897ee780262911c271d0ddf",
    fees: 2928,
  },
];

const main = async () => {
  // let id = [];
  let unknown = [];
  // let hashCount = 0;
  // for (const ids of newInscriptions1) {
  //   id.push(ids.inscription);
  // }
  // for (const item of newInscriptions) {
  //   if (id.includes(item.inscription)) {
  //     let obj = {
  //       id: item.inscription,
  //       meta: {
  //         name: `hash ${hashCount + 1}`,
  //       },
  //     };
  //     hashCount++;
  //     unknown.push(obj);
  //   }
  // }

  // console.log(unknown);

  let hashCount = 0;
  let compInscription = [];
  for (const items of newInscriptions) {
    let obj = {
      id: items.inscription,
      meta: {
        name: `hash ${hashCount + 1}`,
      },
    };

    hashCount++;

    compInscription.push(obj);
  }

  const path = "./inscription/inscription.json";

  if (!fs.existsSync("./inscription")) {
    fs.mkdirSync("./inscription");
  }

  fs.writeFileSync(path, JSON.stringify(compInscription), (err) => {
    console.log(err);
  });

  console.log(compInscription);
};

main().then().catch();

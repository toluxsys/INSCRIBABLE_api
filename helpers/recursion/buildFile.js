const { saveFile, saveFileS3 } = require('../imageHelper');

// draw
const writeFile = (path, data, collectionId) => {
  try {
    if (!existsSync(`${process.cwd()}/build/files/${collectionId}/`)) {
      fs.mkdirSync(
        `${process.cwd()}/build/files/${collectionId}/`,
        { recursive: true },
        (err) => {
          console.log(err);
        },
      );
    }

    fs.writeFileSync(path, data, (err) => {
      console.log(err.message);
    });
  } catch (e) {
    console.log(e.message);
  }
};

// fileName = new Date().getTime().toString() + `.html`;
// filePath = ./build/files/collectionId/fileName

const buildHtml = (content, collectionId, fileName) => {
  try {
    const imageData = [];
    content.forEach((element) => {
      imageData.push(`"/content/${element}"`);
    });
    const file = `<html>
                <body style="margin: 0;padding: 0" data-id="8628">
                    <script src="/content/b52f97a91555acce06f7cc1b42455a2b785be3a5cd3f4351b5358d1591690e2ei0"></script>
                    <canvas id="canvas" style="width: 100%; height: auto; max-width: 1200px" width="1200" height="1200"></canvas>
                        <script>
                            draw(document.getElementById('canvas'), [${imageData}]);
                        </script>
                </body>
            </html>`;
    writeFile(
      `${process.cwd()}/build/files/${collectionId}/${fileName}`,
      file,
      collectionId,
    );
    const savedData = saveFileS3(fileName, collectionId);
    // cid: file location on s3
    // size: file size
    return savedData;
  } catch (e) {
    console.log(e.message);
  }
};

buildHtml([
  'b7c3ea2387cac429b409bd0ec9170b4f15c353ecc5e1c57ed8ed447518119ceei0',
  '518980b84c34c486f47eccc8df953203259cbdeeb132309a0a6bf2914f6e7be9i0',
  '207413ea2f3e622c07bc5ce9770e17a1fdd92603e633ee2cd71d9b09bbbd95d2i0',
  '61a3bd0db66606b9ab2fbe09205ede2273e00068f426bd4cb2d490dd0413f1d6i0',
  '/content/5947de4998380fb841a5fb4a3377ae6a97afb239c042951dccf6868e7b13b007i0',
  'ba6a4d74bcd78f3f6ef061404afab2bf690d982f026adbf8c3e007ac9d62ba2ci0',
  'd8ce59b4d5998a2b2bfec9c83840165c5b586d339f21a615d5bcfc96081c5938i0',
]);

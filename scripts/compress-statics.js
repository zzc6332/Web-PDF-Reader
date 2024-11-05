import fs from "fs";
import path from "path";
import zlib from "zlib";
import yaml from "js-yaml";

const outputPath = path.resolve("./dist/statics/");
try {
  fs.accessSync(outputPath);
} catch (error) {
  fs.mkdirSync(outputPath, { recursive: true });
}

const config = fs.readFileSync(path.resolve("./statics/statics.yaml"));
fs.writeFileSync(path.join(outputPath, "statics.yaml"), config);

const { fileNames, path: pathStr } = yaml.load(config);

const files = fileNames.map((fileName) => {
  try {
    return fs.readFileSync(path.resolve("." + pathStr + fileName));
  } catch (error) {
    return null;
  }
});

files.forEach((file, index) => {
  if (!file) return;
  fs.writeFileSync(path.join(outputPath, fileNames[index]), file);
  zlib.gzip(file, { level: 9 }, (err, compressedData) => {
    if (err) {
      console.error(`${fileNames[index]} 压缩错误`, err);
    } else {
      fs.writeFileSync(
        path.join(outputPath, fileNames[index] + ".gz"),
        compressedData
      );
    }
  });
});

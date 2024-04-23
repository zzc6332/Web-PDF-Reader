// const fs = require("fs");
import fs from "fs";
import path from "path";

const pathStr = path.resolve("./src/assets/icons/icons.js");
const readStream = fs.createReadStream(pathStr, { highWaterMark: 1024 });

const stat = fs.statSync(pathStr);

let accumulate = 0;

let data = Buffer.from("");

readStream.on("data", (chunk) => {
  accumulate += chunk.length;
  data = Buffer.concat([data, chunk]);
  console.log(accumulate + " / " + stat.size);
});

readStream.on("end", () => {
  console.log("加载成功");
  const script = data.toString();
  const reg = /fill="[^"]*"/g;
  const newScript = script.replace(reg, 'fill="currentColor"');
  writeFile(newScript);
});

function writeFile(str) {
  const writeStream = fs.createWriteStream(pathStr, {
    highWaterMark: 1024,
    encoding: "utf-8",
    flags: "w+",
  });
  writeStream.write(str, (err) => {
    if (!err) console.log("写入成功");
  });
}

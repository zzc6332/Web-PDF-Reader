// 命令示例：node generate-components Foo1 Foo2 p=src/components/Foo Bar1 Bar2 p=src/components/Bar

// const path = require("path");
// const fs = require("fs");
// const readline = require("readline").promises;
import path from "path";
import fs from "fs";
import readline from "readline/promises";

const { argv } = process;

const args = argv.slice(2);

function parsePath(arg) {
  const fragment = arg.split("p=");
  if (fragment[0] === "") {
    return fragment[1].replace(/\\/g, "\\");
  }
  return false;
}

if (parsePath(args[0])) {
  throw new Error("请先输入组件名作为参数，再输入【p=路径名】");
}

const argMaps = [];

let currentArgMap = { names: [] };
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  const pathStr = parsePath(arg);
  // 当前 arg 是 pathStr 的情况
  if (pathStr) {
    currentArgMap.pathStr = pathStr;
    argMaps.push(currentArgMap);
    currentArgMap = { names: [] };
    continue;
  }
  // 当前 arg 是组件名的情况
  currentArgMap.names.push(arg);
}

if (!argMaps[0]?.pathStr) {
  throw new Error("请使用 p= 指定路径名");
}

function generateScriptContent(names) {
  return `import { memo } from "react";
import Props from "src/types/props";

interface ${names}Props extends Props {}

export default memo(function ${names}({ className: classNameProp }: ${names}Props) {
  const className = classNameProp || "";
  return <div className={ className }></div>;
});`;
}

async function getOverwriteStrategy(target) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const inputStr = await rl.question(
    `文件 ${target} 已存在，是否需要覆写？\ny - 覆写\nn - 不覆写（默认）\nay - 总是覆写 \nan - 总不覆写\n(y/n/ay/an): `
  );
  rl.close();
  return inputStr;
}

// alwaysOverwrite 表示是否总是覆写已存在的文件，-1 表示未设置，0 表示总是不覆写，1 表示总是覆写
let alwaysOverwrite = -1;

async function handleArgMaps() {
  for (let i = 0; i < argMaps.length; i++) {
    const argMap = argMaps[i];
    const { names, pathStr } = argMap;
    for (let j = 0; j < names.length; j++) {
      // isOverwrite 表示当前 target 如果已存在是否覆写，优先级低于 alwaysOverwrite
      let isOverwrite = false;
      const name = names[j];
      const absPath = path.resolve(pathStr);
      const target = path.join(absPath, name + ".tsx");
      // console.log("正在生成: ", target);
      if (fs.existsSync(target)) {
        if (alwaysOverwrite === -1) {
          switch (await getOverwriteStrategy(target)) {
            case "y":
              isOverwrite = true;
              break;
            case "n":
              isOverwrite = false;
              break;
            case "ay":
              alwaysOverwrite = 1;
              break;
            case "an":
              alwaysOverwrite = 0;
              break;
            default:
              break;
          }
          if (alwaysOverwrite !== 1 && !isOverwrite) {
            console.log(target, " 取消生成。");
            continue;
          }
        }
        if (alwaysOverwrite === 0) {
          console.log(target, " 取消生成。");
          continue;
        }
      }
      fs.mkdirSync(absPath, { recursive: true });
      fs.writeFileSync(target, generateScriptContent(name), {
        encoding: "utf-8",
      });
      console.log(target, " 生成成功！");
    }
  }
}

handleArgMaps();

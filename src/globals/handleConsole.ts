const consoleError = console.error;
console.error = function (...args) {
  // semi-ui 中的一些表单组件会向 dom 中加入 autofocus 组件导致 react 发起 console.warn
  if (args[1] === "autofocus" && args[2] === "autoFocus") {
    return;
  }
  consoleError.apply(console, args);
};

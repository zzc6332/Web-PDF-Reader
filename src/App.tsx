import PDFReader from "./components/PDFReader/PDFReader";
import useThemes from "./hooks/useThemes";
import { colorsList } from "./configs/theme";
import useThemeStore from "./stores/useThemeStore";

import { Upload, Button } from "@douyinfe/semi-ui";
import { useRef } from "react";

function App() {
  const inputRef = useRef<HTMLInputElement>(null);

  const themeIndex = useThemeStore((s) => s.themeIndex);
  useThemes(colorsList, themeIndex);
  return (
    <div className={"h-screen" + " semi-light-scrollbar"}>
      <PDFReader />
      {/* <Upload>
        <Button>111</Button>
      </Upload> */}
      {/* <input type="file" ref={inputRef} />
      <button
        onClick={() => {
          // const reader = new FileReader();
          // reader.onload = (e) => {
          //   console.log(e.target?.result);
          // };
          // reader.readAsArrayBuffer(inputRef.current!.files!);
          console.log(inputRef.current!.files);
        }}
      >
        check
      </button> */}
    </div>
  );
}

export default App;

import PDFReader from "./components/PDFReader/PDFReader";
import useThemes from "./hooks/useThemes";
import { colorsList } from "./configs/theme";

function App() {
  useThemes(colorsList);
  return (
    <div className={"h-screen" + " semi-light-scrollbar"}>
      <PDFReader />
    </div>
  );
}

export default App;

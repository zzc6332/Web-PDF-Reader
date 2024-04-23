import PDFReader from "./components/PDFReader/PDFReader";
import useThemes from "./hooks/useThemes";
import { colorsList } from "./configs/theme";
import useGlobalStore from "./stores/useGlobalStore";

function App() {
  const themeIndex = useGlobalStore((s) => s.themeIndex);
  useThemes(colorsList, themeIndex);
  return (
    <div className="h-screen">
      <PDFReader />
    </div>
  );
}

export default App;

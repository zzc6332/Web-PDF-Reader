import PDFReader from "./components/PDFReader/PDFReader";
import useThemes from "./hooks/useThemes";
import { colorsList } from "./configs/theme";
import useThemeStore from "./stores/useThemeStore";

function App() {
  const themeIndex = useThemeStore((s) => s.themeIndex);
  useThemes(colorsList, themeIndex);
  return (
    <div className="h-screen">
      <PDFReader />
    </div>
  );
}

export default App;

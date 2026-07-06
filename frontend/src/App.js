import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import StudioPage from "@/pages/StudioPage";

function App() {
  return (
    <div className="App dark">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<StudioPage />} />
          <Route path="*" element={<StudioPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" theme="dark" richColors closeButton />
    </div>
  );
}

export default App;

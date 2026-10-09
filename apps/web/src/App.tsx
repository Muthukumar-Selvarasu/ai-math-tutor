import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Workspace from './pages/Workspace';
import 'katex/dist/katex.min.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Workspace />} />
        <Route path="/workspace/:sessionId" element={<Workspace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

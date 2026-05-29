import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import SearchPage from './pages/SearchPage.tsx';
import GraphPage from './pages/GraphPage.tsx';
import { Header } from './components/layout/Header.tsx';
import { Footer } from './components/layout/Footer.tsx';
import './App.css'
function App() {
  const location = useLocation();
  const isGraphRoute = location.pathname.startsWith('/frontend/graph/');
  return (
      <div className="flex flex-col min-h-screen w-full bg-slate-950 text-slate-50 overflow-x-hidden font-sans">
        <Header />
        {/* Main Content */}
        <main className="flex-1 flex flex-col w-full relative z-10">
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/frontend/" element={<SearchPage />} />
              <Route path="/frontend/graph/:uri" element={<GraphPage />} />
            </Routes>
          </AnimatePresence>
        </main>
        {!isGraphRoute && <Footer />}
      </div>
  )
}
export default App

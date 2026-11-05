import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import UniversityPortal from './UniversityPortal';

const Root: React.FC = () => {
  const [simulator, setSimulator] = useState(false);
  if (simulator) return (
    <>
      <button
        onClick={() => setSimulator(false)}
        className="fixed right-4 top-4 z-[200] rounded-xl border border-cyan-400/40 bg-slate-950 px-4 py-2 text-xs font-bold text-cyan-300 shadow-xl"
      >
        Return to university portal
      </button>
      <App />
    </>
  );
  return <UniversityPortal onOpenSimulator={() => setSimulator(true)} />;
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element to mount to');
ReactDOM.createRoot(rootElement).render(<React.StrictMode><Root /></React.StrictMode>);

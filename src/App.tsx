import React from 'react';
import Scene from './components/Scene';
import Editor from './components/Editor';
import { StoreProvider } from './store';

function App() {
  return (
    <StoreProvider>
      <div className="flex w-full h-full bg-black">
        <Editor />
        <main className="flex-1 relative overflow-hidden">
           <Scene />
           <div className="absolute top-4 right-4 text-right pointer-events-none opacity-40">
             <div className="text-[10px] font-mono text-slate-500 uppercase">Field_V0_Alpha</div>
             <div className="text-[10px] font-mono text-slate-500 uppercase">Ortho_Projection: Active</div>
           </div>
        </main>
      </div>
    </StoreProvider>
  );
}

export default App;

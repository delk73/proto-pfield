import React, { useState, useRef, useEffect } from 'react';
import { useStore, MovePosition } from '../store';
import { SDFNode, SDFPrimitive, SDFOperation, isOperation, isPrimitive, OPERATOR_REGISTRY, SDFNodeType, OperatorMeta } from '../types';
import { getInheritanceStack } from '../services/validation';
import { 
  Trash2, FolderTree, Circle, Square, Minus as CapsuleIcon,
  ChevronRight, ChevronDown, Download, Upload, Eye, EyeOff,
  ArrowUp, ArrowDown, Package, Shuffle, Maximize2, Move, Settings2, Combine,
  Activity, Scissors, Target, Layers, Cloud, Eraser, Crosshair, Grid, Columns2, 
  Route, Tornado, Waves, Maximize, Minimize, CircleDashed, Contrast, Lock, 
  Search, Check, Zap, Plus, Undo2, Redo2, ShieldAlert, ShieldCheck, Info
} from 'lucide-react';

const ICON_MAP: Record<string, React.FC<any>> = {
  Circle, Square, CapsuleIcon, FolderTree, Combine, Scissors, Target, Layers,
  Cloud, Eraser, Crosshair, Grid, Columns2, Route, Tornado, Waves,
  Maximize, Minimize, CircleDashed, Contrast, Lock
};

const getCategoryStyles = (category: string) => {
  switch (category) {
    case 'Boolean': return { color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', active: 'border-cyan-500 bg-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.3)]' };
    case 'Domain': return { color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10', active: 'border-purple-500 bg-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.3)]' };
    case 'Metric': return { color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', active: 'border-amber-500 bg-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.3)]' };
    case 'Primitive': return { color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10', active: 'border-blue-500 bg-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.3)]' };
    default: return { color: 'text-slate-400', border: 'border-slate-500/30', bg: 'bg-slate-500/10', active: 'border-slate-500 bg-slate-500/20' };
  }
};

const OperatorIcon = ({ type, size = 14, className = "" }: { type: SDFNodeType, size?: number, className?: string }) => {
  const meta = OPERATOR_REGISTRY[type];
  const Icon = ICON_MAP[meta?.icon] || FolderTree;
  const styles = getCategoryStyles(meta?.category || '');
  return <Icon size={size} className={`${styles.color} ${className}`} />;
};

const DraggableIcon: React.FC<{ type: SDFNodeType }> = ({ type }) => {
    const { state, dispatch } = useStore();
    const meta = OPERATOR_REGISTRY[type];
    const isPrimitiveType = meta.category === 'Primitive';
    const findSelected = (root: SDFNode | null): SDFNode | null => {
        if(!root) return null;
        if(root.id === state.selectedId) return root;
        if(isOperation(root)) { for (const child of root.children) { const f = findSelected(child); if (f) return f; } }
        return null;
    }
    const selectedNode = findSelected(state.root);
    const isActive = selectedNode?.type === type;
    const styles = getCategoryStyles(meta.category);

    const handleDragStart = (e: React.DragEvent) => { e.dataTransfer.setData('application/json', JSON.stringify({ type, source: 'palette' })); };
    const handleClick = () => {
        if (selectedNode) {
            const selectedIsPrimitive = isPrimitive(selectedNode);
            const targetIsPrimitive = isPrimitiveType;
            if (selectedIsPrimitive === targetIsPrimitive) {
                dispatch({ type: 'SET_OP_TYPE', payload: { id: selectedNode.id, type: type as any } });
                return;
            }
        }
        dispatch({ type: 'ADD_NODE', payload: { type, position: [0, 0] } });
    };

    return (
        <div 
            draggable 
            onDragStart={handleDragStart}
            onClick={handleClick}
            className={`w-8 h-8 border rounded flex items-center justify-center cursor-pointer transition-all group relative
                ${isActive ? styles.active : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-500 hover:bg-slate-700/50'}
            `}
            title={meta.label}
        >
            <OperatorIcon type={type} size={16} className={`${isActive ? 'scale-110' : 'group-hover:scale-110'} transition-transform`} />
            {isActive && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white shadow-sm" />}
        </div>
    );
};

const NodeItem: React.FC<{ node: SDFNode; depth?: number; parentType?: string; index?: number }> = ({ node, depth = 0, parentType, index }) => {
  const { state, dispatch } = useStore();
  const [dropPos, setDropPos] = useState<MovePosition | null>(null);
  const isSelected = state.selectedId === node.id;
  const isOp = isOperation(node);
  const meta = OPERATOR_REGISTRY[node.type];
  const isCollapsed = node.collapsed;
  const isDisplaceSource = parentType === 'displace' && index === 1;

  const handleDragStart = (e: React.DragEvent) => {
      e.dataTransfer.setData('application/json', JSON.stringify({ id: node.id, source: 'hierarchy' }));
      e.stopPropagation();
  };
  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      if (relativeY < rect.height * 0.25) setDropPos('before');
      else if (relativeY > rect.height * 0.75) setDropPos('after');
      else setDropPos('inside');
  };
  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.source === 'hierarchy' && data.id !== node.id) {
          dispatch({ type: 'MOVE_NODE', payload: { draggedId: data.id, targetId: node.id, position: dropPos || 'inside' } });
      }
      setDropPos(null);
  };

  return (
    <div className="select-none group/item focus:outline-none relative" draggable onDragStart={handleDragStart} onDragOver={handleDragOver} onDragLeave={() => setDropPos(null)} onDrop={handleDrop}>
      {dropPos === 'before' && <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-10" />}
      <div 
        className={`flex items-center gap-2 p-1.5 px-2 cursor-pointer transition-all 
            ${isSelected ? 'bg-slate-700/50 border-l-2 border-blue-500 shadow-[inset_4px_0_12px_rgba(59,130,246,0.1)]' : 'border-l-2 border-transparent hover:bg-slate-800/50'}
            ${dropPos === 'inside' ? 'bg-blue-500/20' : ''}
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => dispatch({ type: 'SELECT_NODE', payload: node.id })}
      >
        <span onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_COLLAPSE', payload: node.id }); }} className={`w-4 h-4 flex items-center justify-center text-slate-500 hover:text-white transition-all ${isOp ? (isCollapsed ? 'opacity-70' : 'opacity-0 group-hover/item:opacity-50') : 'opacity-0 pointer-events-none'}`}>
          {isOp && (isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />)}
        </span>
        <OperatorIcon type={node.type} className={isDisplaceSource ? "text-amber-500 animate-pulse drop-shadow-[0_0_2px_rgba(245,158,11,0.5)]" : ""} />
        <span className={`text-xs font-mono truncate transition-colors ${isSelected ? 'text-white' : (isDisplaceSource ? 'text-amber-400 font-bold' : 'text-slate-400 group-hover/item:text-slate-200')}`}>{node.name || meta.label}</span>
      </div>
      {dropPos === 'after' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-10" />}
      {!isCollapsed && isOp && (
        <div className="flex flex-col border-l border-slate-800/30 ml-[1.15rem]">
           {(node as SDFOperation).children.map((c, idx) => <NodeItem key={c.id} node={c} depth={depth + 1} parentType={node.type} index={idx} />)}
        </div>
      )}
    </div>
  );
};

const PropertiesPanel = () => {
    const { state, dispatch } = useStore();
    const findSelected = (root: SDFNode | null): SDFNode | null => {
        if(!root) return null;
        if(root.id === state.selectedId) return root;
        if(isOperation(root)) { for (const child of root.children) { const f = findSelected(child); if (f) return f; } }
        return null;
    }
    const node = findSelected(state.root);
    if (!node) return <div className="p-8 flex flex-col items-center justify-center gap-3 opacity-15 h-full"><Search size={32} strokeWidth={1} /><div className="text-[10px] text-slate-500 font-mono text-center uppercase tracking-[0.2em]">Select an Object</div></div>;
    
    const update = (updates: Partial<SDFNode>) => dispatch({ type: 'UPDATE_NODE', payload: { id: node.id, updates } });
    const meta = OPERATOR_REGISTRY[node.type];
    const startTx = () => dispatch({ type: 'START_TRANSACTION' });
    const endTx = () => dispatch({ type: 'COMMIT_TRANSACTION' });

    const inheritance = getInheritanceStack(state.root!, node.id);

    return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="p-2.5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50 backdrop-blur-md z-20">
                <div className="flex items-center gap-2">
                    <OperatorIcon type={node.type} size={16} />
                    <span className={`text-[10px] font-black font-mono uppercase tracking-[0.1em] ${getCategoryStyles(meta.category).color}`}>
                        {meta.category}
                    </span>
                </div>
                <div className="flex gap-0.5">
                    <button onClick={() => dispatch({type: 'REORDER_NODE', payload: {id: node.id, direction: 'up'}})} className="p-1 text-slate-500 hover:text-white transition-colors" title="Move Up"><ArrowUp size={14}/></button>
                    <button onClick={() => dispatch({type: 'REORDER_NODE', payload: {id: node.id, direction: 'down'}})} className="p-1 text-slate-500 hover:text-white transition-colors" title="Move Down"><ArrowDown size={14}/></button>
                    <button onClick={() => dispatch({type: 'DELETE_NODE', payload: node.id})} className="p-1 text-red-500/60 hover:text-red-400 transition-colors ml-1"><Trash2 size={14} /></button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-800 p-3 space-y-5">
                {state.debugMode === 'field' && (
                  <section className="p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-md">
                     <div className="flex items-center gap-1.5 text-[8px] font-black font-mono text-blue-400 uppercase tracking-widest mb-2"><Info size={10} /> Inheritance Stack</div>
                     <div className="flex flex-col gap-1">
                        {inheritance.length === 0 ? (
                           <div className="text-[9px] text-slate-600 font-mono italic">No inherited domain warps</div>
                        ) : inheritance.map((item, i) => (
                           <div key={i} className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                              <span className="text-slate-700">L{i}</span>
                              <span className="truncate">{item}</span>
                           </div>
                        ))}
                     </div>
                  </section>
                )}

                <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] text-slate-500 font-mono uppercase tracking-widest opacity-50 font-bold">Identifier</label>
                    <input className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono focus:border-blue-500/50 outline-none transition-all" value={node.name || ''} onChange={(e) => update({ name: e.target.value })} />
                </div>

                {isPrimitive(node) && (
                    <div className="space-y-4">
                        <section className="space-y-3 p-3 bg-slate-950/30 border border-slate-800/60 rounded-lg shadow-inner">
                            <div className="flex items-center gap-2 text-[9px] text-slate-500 font-mono uppercase opacity-70 font-bold tracking-widest"><Move size={10} /> Transform</div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1"><label className="text-[8px] text-slate-600 font-mono font-bold">POS_X</label><input type="number" step="0.01" className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono" value={node.position[0].toFixed(2)} onChange={(e) => update({ position: [parseFloat(e.target.value) || 0, node.position[1]] })} /></div>
                                <div className="flex flex-col gap-1"><label className="text-[8px] text-slate-600 font-mono font-bold">POS_Y</label><input type="number" step="0.01" className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono" value={node.position[1].toFixed(2)} onChange={(e) => update({ position: [node.position[0], parseFloat(e.target.value) || 0] })} /></div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[8px] text-slate-600 font-mono flex justify-between font-bold"><span>ROTATION</span><span className="text-blue-400">{(node.rotation * 180 / Math.PI).toFixed(0)}°</span></label>
                                <input type="range" min="-3.14" max="3.14" step="0.01" className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" value={node.rotation} onMouseDown={startTx} onMouseUp={endTx} onChange={(e) => update({ rotation: parseFloat(e.target.value) })} />
                            </div>
                        </section>
                    </div>
                )}

                {isOperation(node) && (
                    <div className="space-y-4">
                        {(meta.category === 'Boolean' || ['mirror', 'displace', 'clamp', 'dilate', 'erode', 'shell'].includes(node.type)) && (
                            <div className="space-y-4 p-4 bg-slate-950/40 border border-slate-800/60 rounded-lg relative shadow-[inset_0_4px_12px_rgba(0,0,0,0.5)]">
                                {meta.category === 'Boolean' && (
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[9px] text-slate-500 font-mono flex justify-between uppercase font-bold tracking-tight"><span>Blend Power (k)</span><span className="text-purple-400 font-black font-mono">{(node as SDFOperation).blend.toFixed(3)}</span></label>
                                        <input type="range" min="0.0" max="1.0" step="0.001" className="w-full accent-purple-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" value={(node as SDFOperation).blend} onMouseDown={startTx} onMouseUp={endTx} onChange={(e) => update({ blend: parseFloat(e.target.value) })} />
                                    </div>
                                )}
                                {node.type === 'mirror' && <div className="flex flex-col gap-4">
                                    <div className="flex gap-1.5 bg-slate-950/80 p-1 rounded border border-slate-800">
                                        <button onClick={() => update({ axis: 'x' })} className={`flex-1 py-1.5 text-[9px] font-black font-mono rounded transition-all ${ (node as SDFOperation).axis === 'x' ? 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.4)]' : 'text-slate-500 hover:text-slate-300' }`}>AXIS_X</button>
                                        <button onClick={() => update({ axis: 'y' })} className={`flex-1 py-1.5 text-[9px] font-black font-mono rounded transition-all ${ (node as SDFOperation).axis === 'y' ? 'bg-blue-600 text-white shadow-[0_2px_8px_rgba(37,99,235,0.4)]' : 'text-slate-500 hover:text-slate-300' }`}>AXIS_Y</button>
                                    </div>
                                    <div className="flex flex-col gap-1.5"><label className="text-[8px] text-slate-600 font-mono font-bold uppercase tracking-widest">Displacement</label><input type="number" step="0.01" className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs font-mono" value={(node as SDFOperation).offset} onMouseDown={startTx} onMouseUp={endTx} onChange={(e) => update({ offset: parseFloat(e.target.value) || 0 })} /></div>
                                </div>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default function Editor() {
  const { state, dispatch } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmd = isMac ? e.metaKey : e.ctrlKey;
        if (cmd && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) dispatch({ type: 'REDO' }); else dispatch({ type: 'UNDO' });
        } else if (cmd && e.key.toLowerCase() === 'y') { e.preventDefault(); dispatch({ type: 'REDO' }); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  const opsByCategory = Object.values(OPERATOR_REGISTRY).reduce((acc, op) => {
      if (op.category === 'Primitive') return acc;
      if (!acc[op.category]) acc[op.category] = [];
      acc[op.category].push(op);
      return acc;
  }, {} as Record<string, OperatorMeta[]>);

  return (
    <div className="w-80 h-full bg-slate-900 border-r border-slate-800 flex flex-col text-slate-200 shadow-2xl z-10 relative overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 shadow-md z-10">
        <div className="flex items-center gap-2"><Zap size={14} className="text-blue-500 fill-blue-500/20" /><h1 className="font-mono font-bold text-sm tracking-widest text-slate-300">PRECISION<span className="text-blue-500">FIELD</span></h1></div>
        <div className="flex items-center gap-1.5">
            <button onClick={() => dispatch({ type: 'UNDO' })} disabled={state.past.length === 0} className="p-1.5 text-slate-500 hover:text-white disabled:opacity-10 disabled:pointer-events-none transition-colors" title="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
            <button onClick={() => dispatch({ type: 'REDO' })} disabled={state.future.length === 0} className="p-1.5 text-slate-500 hover:text-white disabled:opacity-10 disabled:pointer-events-none transition-colors" title="Redo (Ctrl+Y)"><Redo2 size={16} /></button>
            <button onClick={() => dispatch({ type: 'TOGGLE_DEBUG' })} className="p-1.5 hover:text-white text-slate-500 transition-colors ml-1" title="Toggle Explainability Mode">{state.debugMode === 'normal' ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b border-slate-800/60 flex flex-col gap-4 bg-slate-900/20 overflow-hidden">
               <div className="flex flex-col gap-2">
                   <div className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em] opacity-40 font-black">Primitives</div>
                   <div className="flex gap-2.5">
                       <DraggableIcon type="circle" />
                       <DraggableIcon type="box" />
                       <DraggableIcon type="capsule" />
                   </div>
               </div>
               <div className="flex flex-col gap-3">
                   <div className="text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em] opacity-40 font-black">Operators</div>
                   {Object.entries(opsByCategory).map(([category, ops]) => (
                       <div key={category} className="flex flex-col gap-1.5">
                           <span className={`text-[9px] font-black font-mono uppercase tracking-widest ${getCategoryStyles(category).color}`}>{category}</span>
                           <div className="flex flex-wrap gap-2">{ops.map(op => <DraggableIcon key={op.type} type={op.type} />)}</div>
                       </div>
                   ))}
               </div>
          </div>
          <div className="flex-1 overflow-hidden px-1 py-3 bg-slate-900/5">
             <div className="text-[10px] text-slate-500 font-mono mb-2 px-3 pt-1 uppercase tracking-[0.2em] opacity-30 font-black">Graph Hierarchy</div>
            {!state.root ? <div className="p-12 text-[10px] text-slate-500 font-mono text-center opacity-20 border-2 border-dashed border-slate-800/50 m-4 rounded-lg">EMPTY_TREE</div> : <div className="p-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 h-full"><NodeItem node={state.root} /></div>}
          </div>
      </div>

      <div className="h-[340px] flex flex-col border-t border-slate-800 bg-slate-950/20 shadow-[0_-16px_32px_rgba(0,0,0,0.5)] z-20"><PropertiesPanel /></div>
      <div className="p-3.5 border-t border-slate-800 bg-slate-950 flex justify-between items-center z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.4)]">
           <button onClick={() => dispatch({ type: 'RESET' })} className="px-3 py-2 text-[10px] text-slate-600 font-black font-mono hover:text-red-500 transition-colors uppercase tracking-[0.25em]">Purge_Cache</button>
      </div>
    </div>
  );
}

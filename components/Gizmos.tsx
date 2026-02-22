
import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useThree, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import { collectPrimitives } from '../services/compiler';
import { SDFPrimitive, SDFNode, isOperation, isPrimitive, SDFOperation, OPERATOR_REGISTRY } from '../types';

const GIZMO_LAYER = 100; 
const COLOR_PRIMARY = '#60a5fa'; 
const COLOR_HOVER = '#fbbf24';   
const COLOR_ACTIVE = '#f59e0b';  
const COLOR_BLEND = '#c084fc';   
const COLOR_METRIC = '#fbbf24';  
const COLOR_LIMIT_MIN = '#22d3ee'; // Brighter Cyan
const COLOR_LIMIT_MAX = '#f59e0b'; // Amber
const COLOR_HANDLE_FILL = '#ffffff';
const COLOR_HANDLE_STROKE = '#1e293b';

function useGizmoDrag(node: SDFNode, onUpdate: (updates: any, noHistory?: boolean) => void, onStart: () => void, onEnd: () => void) {
    const { gl, camera } = useThree();
    const [draggingMode, setDraggingMode] = useState<string | null>(null);
    const dragRef = useRef<any>(null);
    const updateRef = useRef(onUpdate);
    updateRef.current = onUpdate;
    const startRef = useRef(onStart);
    startRef.current = onStart;
    const endRef = useRef(onEnd);
    endRef.current = onEnd;

    const getWorldPos = useCallback((e: PointerEvent | MouseEvent) => {
        const rect = gl.domElement.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const vec = new THREE.Vector3(x, y, 0).unproject(camera);
        vec.z = 0; 
        return vec;
    }, [gl, camera]);

    const onMove = useCallback((e: PointerEvent) => {
        if (!dragRef.current) return;
        const info = dragRef.current;
        const currWorld = getWorldPos(e);
        const delta = currWorld.clone().sub(info.startWorld);

        if (info.mode === 'translate') {
            updateRef.current({ position: [info.startPos.x + delta.x, info.startPos.y + delta.y] }, true);
            return;
        }

        if (info.mode === 'rotate') {
            const center = new THREE.Vector3(info.startPos.x, info.startPos.y, 0);
            const startVec = info.startWorld.clone().sub(center);
            const currVec = currWorld.clone().sub(center);
            const angle = Math.atan2(currVec.y, currVec.x) - Math.atan2(startVec.y, startVec.x);
            updateRef.current({ rotation: info.startRot + angle }, true);
            return;
        }

        if (info.mode === 'blend') {
            const val = Math.max(0.0, Math.min(1.0, info.startBlend + delta.y * 1.5));
            updateRef.current({ blend: val }, true);
            return;
        }

        if (info.mode === 'thickness') {
            const center = info.opCenter;
            const dist = currWorld.distanceTo(center);
            const val = Math.max(0.001, dist - 0.1); 
            updateRef.current({ thickness: val }, true);
            return;
        }

        if (info.mode === 'opRadius') {
            const center = info.opCenter;
            const dist = currWorld.distanceTo(center);
            const val = Math.max(0.001, dist - 0.1);
            updateRef.current({ opRadius: val }, true);
            return;
        }

        if (info.mode === 'minLimit') {
            const val = info.startMinLimit + delta.x;
            updateRef.current({ minLimit: val }, true);
            return;
        }

        if (info.mode === 'maxLimit') {
            const val = info.startMaxLimit + delta.x;
            updateRef.current({ maxLimit: val }, true);
            return;
        }

        if (info.mode === 'offset') {
            const isX = (node as SDFOperation).axis === 'x';
            if (isX) {
                updateRef.current({ offset: info.startOffset + delta.x }, true);
            } else {
                updateRef.current({ offset: info.startOffset + delta.y }, true);
            }
            return;
        }

        const cos = Math.cos(info.startRot);
        const sin = Math.sin(info.startRot);
        const localDx = delta.x * cos + delta.y * sin;
        const localDy = -delta.x * sin + delta.y * cos;

        switch (info.mode) {
            case 'radius':
                updateRef.current({ radius: Math.max(0.01, info.startRadius + localDx) }, true);
                break;
            case 'length':
                updateRef.current({ length: Math.max(0.01, info.startLen + localDy * 2) }, true);
                break;
            case 'size_x':
                updateRef.current({ size: [Math.max(0.01, info.startSize[0] + localDx), info.startSize[1]] }, true);
                break;
            case 'size_y':
                updateRef.current({ size: [info.startSize[0], Math.max(0.01, info.startSize[1] + localDy)] }, true);
                break;
        }
    }, [getWorldPos, node]);

    const onUp = useCallback(() => {
        if (dragRef.current) {
            endRef.current();
        }
        dragRef.current = null;
        setDraggingMode(null);
    }, []);

    useEffect(() => {
        if (draggingMode) {
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            return () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
            };
        }
    }, [draggingMode, onMove, onUp]);

    const startDrag = (e: ThreeEvent<PointerEvent>, mode: string, extra?: any) => {
        e.stopPropagation();
        startRef.current(); 
        setDraggingMode(mode);
        dragRef.current = {
            mode,
            startWorld: getWorldPos(e.nativeEvent),
            startPos: new THREE.Vector2((node as any).position?.[0] || 0, (node as any).position?.[1] || 0),
            startRot: (node as any).rotation || 0,
            startRadius: (node as any).radius || 0.1,
            startSize: (node as any).size ? [...(node as any).size] : [0.1, 0.1],
            startLen: (node as any).length || 0.1,
            startBlend: (node as any).blend || 0,
            startThickness: (node as any).thickness || 0,
            startOpRadius: (node as any).opRadius || 0,
            startOffset: (node as any).offset || 0,
            startMinLimit: (node as any).minLimit || 0,
            startMaxLimit: (node as any).maxLimit || 0,
            ...extra
        };
    };

    return { startDrag, draggingMode };
}

const Handle = ({ position, onDown, mode, activeMode, color = COLOR_HANDLE_FILL }: any) => {
    const [hovered, setHovered] = useState(false);
    const isActive = activeMode === mode;
    const isInteracting = isActive || hovered;

    return (
        /* @ts-ignore */
        <group position={[position[0], position[1], 0.5]} scale={isInteracting ? 1.4 : 1}>
            {/* @ts-ignore */}
            <mesh 
                onPointerDown={onDown} 
                onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }} 
                onPointerOut={() => setHovered(false)}
                renderOrder={GIZMO_LAYER + 10}
            >
                {/* @ts-ignore */}
                <circleGeometry args={[0.045, 24]} />
                {/* @ts-ignore */}
                <meshBasicMaterial 
                    color={isActive ? COLOR_ACTIVE : color} 
                    transparent 
                    opacity={0.95} 
                    depthTest={false} 
                    depthWrite={false}
                />
            {/* @ts-ignore */}
            </mesh>
            {/* @ts-ignore */}
            <mesh position={[0,0,-0.001]} renderOrder={GIZMO_LAYER + 9}>
                {/* @ts-ignore */}
                <circleGeometry args={[0.055, 24]} />
                {/* @ts-ignore */}
                <meshBasicMaterial 
                    color={isInteracting ? COLOR_HOVER : COLOR_HANDLE_STROKE} 
                    depthTest={false} 
                    depthWrite={false}
                />
            {/* @ts-ignore */}
            </mesh>
        {/* @ts-ignore */}
        </group>
    );
};

const PrimitiveGizmo: React.FC<{ node: SDFPrimitive }> = ({ node }) => {
    const { state, dispatch } = useStore();
    const isSelected = state.selectedId === node.id;
    const onUpdate = (updates: Partial<SDFPrimitive>, noHistory?: boolean) => dispatch({ type: 'UPDATE_NODE', payload: { id: node.id, updates, noHistory } });
    const onStart = () => dispatch({ type: 'START_TRANSACTION' });
    const onEnd = () => dispatch({ type: 'COMMIT_TRANSACTION' });
    const { startDrag, draggingMode } = useGizmoDrag(node, onUpdate, onStart, onEnd);

    let handles: React.ReactNode[] = [];
    const hOffset = 0.08;

    if (node.type === 'circle') {
        const r = node.radius || 0.3;
        handles.push(<Handle key="rot" position={[0, r + 0.25, 0]} mode="rotate" activeMode={draggingMode} onDown={(e: any) => startDrag(e, 'rotate')} />);
        handles.push(<Handle key="rad" position={[r + hOffset, 0, 0]} mode="radius" activeMode={draggingMode} onDown={(e: any) => startDrag(e, 'radius')} />);
    } else if (node.type === 'box') {
        const [hx, hy] = node.size || [0.3, 0.2];
        handles.push(<Handle key="rot" position={[0, hy + 0.25, 0]} mode="rotate" activeMode={draggingMode} onDown={(e: any) => startDrag(e, 'rotate')} />);
        handles.push(<Handle key="sx" position={[hx + hOffset, 0, 0]} mode="size_x" activeMode={draggingMode} onDown={(e: any) => startDrag(e, 'size_x')} />);
        handles.push(<Handle key="sy" position={[0, hy + hOffset, 0]} mode="size_y" activeMode={draggingMode} onDown={(e: any) => startDrag(e, 'size_y')} />);
    } else if (node.type === 'capsule') {
        const r = node.radius || 0.15;
        const l = node.length || 0.4;
        handles.push(<Handle key="rot" position={[0, (l / 2 + r) + 0.25, 0]} mode="rotate" activeMode={draggingMode} onDown={(e: any) => startDrag(e, 'rotate')} />);
        handles.push(<Handle key="rad" position={[r + hOffset, 0, 0]} mode="radius" activeMode={draggingMode} onDown={(e: any) => startDrag(e, 'radius')} />);
        handles.push(<Handle key="len" position={[0, l / 2 + r + hOffset, 0]} mode="length" activeMode={draggingMode} onDown={(e: any) => startDrag(e, 'length')} />);
    }

    return (
        /* @ts-ignore */
        <group position={[node.position[0], node.position[1], 0]} rotation={[0, 0, node.rotation]}>
            {/* @ts-ignore */}
            <mesh onPointerDown={(e: any) => { e.stopPropagation(); dispatch({type: 'SELECT_NODE', payload: node.id}); startDrag(e, 'translate'); }} visible={false}>
                {/* @ts-ignore */}
                <circleGeometry args={[0.5, 32]} />
                {/* @ts-ignore */}
                <meshBasicMaterial />
            {/* @ts-ignore */}
            </mesh>
            {isSelected && handles}
        {/* @ts-ignore */}
        </group>
    );
};

const getNodeCenter = (node: SDFNode): [number, number] => {
    if (isPrimitive(node)) {
        return node.position;
    } else if (isOperation(node)) {
        if (node.children.length === 0) return [0, 0];
        let x = 0, y = 0;
        node.children.forEach(child => {
            const [cx, cy] = getNodeCenter(child);
            x += cx; y += cy;
        });
        return [x / node.children.length, y / node.children.length];
    }
    return [0, 0];
};

const OpGizmo: React.FC<{ node: SDFOperation }> = ({ node }) => {
    const { state, dispatch } = useStore();
    const isSelected = state.selectedId === node.id;
    if (!isSelected) return null;

    const center = useMemo(() => getNodeCenter(node), [node]);
    const centerVec = useMemo(() => new THREE.Vector3(center[0], center[1], 0), [center]);
    
    const onUpdate = (updates: any, noHistory?: boolean) => dispatch({ type: 'UPDATE_NODE', payload: { id: node.id, updates, noHistory } });
    const onStart = () => dispatch({ type: 'START_TRANSACTION' });
    const onEnd = () => dispatch({ type: 'COMMIT_TRANSACTION' });
    const { startDrag, draggingMode } = useGizmoDrag(node, onUpdate, onStart, onEnd);

    const isBoolean = OPERATOR_REGISTRY[node.type].category === 'Boolean';
    const isShell = node.type === 'shell';
    const isRadiusOp = ['dilate', 'erode'].includes(node.type);
    const isMirror = node.type === 'mirror';
    const isClamp = node.type === 'clamp';

    return (
        /* @ts-ignore */
        <group position={[center[0], center[1], 0.2]}>
            {isBoolean && (
                <>
                    <Handle mode="blend" activeMode={draggingMode} onDown={(e: any) => startDrag(e, 'blend')} color={COLOR_BLEND} position={[0, (node.blend - 0.25) * 1.0, 0]} />
                    {/* @ts-ignore */}
                    <mesh renderOrder={GIZMO_LAYER}>
                        {/* @ts-ignore */}
                        <planeGeometry args={[0.005, 1.0]} />
                        {/* @ts-ignore */}
                        <meshBasicMaterial color={COLOR_BLEND} transparent opacity={0.3} depthTest={false} depthWrite={false} />
                    {/* @ts-ignore */}
                    </mesh>
                </>
            )}

            {isShell && (
                <Handle mode="thickness" activeMode={draggingMode} onDown={(e: any) => startDrag(e, 'thickness', { opCenter: centerVec })} color={COLOR_METRIC} position={[node.thickness + 0.1, 0, 0.3]} />
            )}

            {isRadiusOp && (
                <Handle mode="opRadius" activeMode={draggingMode} onDown={(e: any) => startDrag(e, 'opRadius', { opCenter: centerVec })} color={COLOR_METRIC} position={[node.opRadius + 0.1, 0, 0.3]} />
            )}

            {isClamp && (
                <>
                    <Handle mode="maxLimit" activeMode={draggingMode} onDown={(e: any) => startDrag(e, 'maxLimit', { opCenter: centerVec })} color={COLOR_LIMIT_MAX} position={[node.maxLimit! + 0.12, 0.08, 0.3]} />
                    <Handle mode="minLimit" activeMode={draggingMode} onDown={(e: any) => startDrag(e, 'minLimit', { opCenter: centerVec })} color={COLOR_LIMIT_MIN} position={[node.minLimit! + 0.12, -0.08, 0.3]} />
                    
                    {/* @ts-ignore */}
                    <mesh renderOrder={GIZMO_LAYER}>
                        {/* @ts-ignore */}
                        <ringGeometry args={[Math.max(0.001, Math.abs(node.maxLimit!)), Math.max(0.001, Math.abs(node.maxLimit!)) + 0.008, 64]} />
                        {/* @ts-ignore */}
                        <meshBasicMaterial color={COLOR_LIMIT_MAX} transparent opacity={0.5} depthTest={false} depthWrite={false} />
                    {/* @ts-ignore */}
                    </mesh>
                    {/* @ts-ignore */}
                    <mesh renderOrder={GIZMO_LAYER}>
                        {/* @ts-ignore */}
                        <ringGeometry args={[Math.max(0.001, Math.abs(node.minLimit!)), Math.max(0.001, Math.abs(node.minLimit!)) + 0.008, 64]} />
                        {/* @ts-ignore */}
                        <meshBasicMaterial color={COLOR_LIMIT_MIN} transparent opacity={0.5} depthTest={false} depthWrite={false} />
                    {/* @ts-ignore */}
                    </mesh>
                </>
            )}

            {isMirror && (
                <>
                    <Handle 
                        mode="offset" 
                        activeMode={draggingMode} 
                        onDown={(e: any) => startDrag(e, 'offset')} 
                        color={COLOR_METRIC} 
                        position={node.axis === 'x' ? [node.offset, 0, 0.1] : [0, node.offset, 0.1]} 
                    />
                    {/* @ts-ignore */}
                    <mesh rotation={node.axis === 'y' ? [0, 0, Math.PI/2] : [0, 0, 0]} position={node.axis === 'x' ? [node.offset, 0, -0.1] : [0, node.offset, -0.1]}>
                        {/* @ts-ignore */}
                        <planeGeometry args={[0.005, 10.0]} />
                        {/* @ts-ignore */}
                        <meshBasicMaterial color={COLOR_METRIC} transparent opacity={0.6} depthTest={false} depthWrite={false} />
                    {/* @ts-ignore */}
                    </mesh>
                </>
            )}
        {/* @ts-ignore */}
        </group>
    );
};

export const GizmoLayer = () => {
    const { state } = useStore();
    
    const findNode = (root: SDFNode | null, id: string): SDFNode | null => {
        if (!root) return null;
        if (root.id === id) return root;
        if (isOperation(root)) {
            for (const c of root.children) {
                const f = findNode(c, id);
                if (f) return f;
            }
        }
        return null;
    };

    const selectedNode = state.selectedId ? findNode(state.root, state.selectedId) : null;
    const primitives = useMemo(() => collectPrimitives(state.root), [state.root]);

    return (
        <>
            {primitives.map((node) => <PrimitiveGizmo key={node.id} node={node} />)}
            {selectedNode && isOperation(selectedNode) && <OpGizmo node={selectedNode} />}
        </>
    );
};

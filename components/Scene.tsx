
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import { compileTreeToGLSL } from '../services/compiler';
import { GizmoLayer } from './Gizmos';
import { isOperation, SDFNode } from '../types';

export class FieldMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2() },
        uDebugMode: { value: 0 }, 
      },
      vertexShader: `
        varying vec2 vWorldPos;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xy;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }`
    });
  }
}

extend({ FieldMaterial });

const DropHandler = () => {
    const { gl, camera } = useThree();
    const { dispatch } = useStore();
    useEffect(() => {
        const handleDragOver = (e: DragEvent) => e.preventDefault();
        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            const data = e.dataTransfer?.getData('application/json');
            if (!data) return;
            const { type } = JSON.parse(data);
            const rect = gl.domElement.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            const vec = new THREE.Vector3(x, y, 0).unproject(camera);
            dispatch({ type: 'ADD_NODE', payload: { type, position: [vec.x, vec.y] } });
        };
        const canvas = gl.domElement;
        canvas.addEventListener('dragover', handleDragOver);
        canvas.addEventListener('drop', handleDrop);
        return () => { 
            canvas.removeEventListener('dragover', handleDragOver); 
            canvas.removeEventListener('drop', handleDrop); 
        };
    }, [gl, camera, dispatch]);
    return null;
};

const InputOverlay = ({ blendValue, active }: { blendValue: number | null, active: boolean }) => {
    if (!active || blendValue === null) return null;
    return (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-50">
            <div className="bg-slate-900/80 backdrop-blur-sm border border-purple-500/50 rounded px-3 py-1.5 flex flex-col items-center">
                <span className="text-[10px] text-purple-400 font-mono uppercase tracking-widest mb-1 opacity-70">Smooth_Blend</span>
                <span className="text-xl text-white font-mono font-bold leading-none">{blendValue.toFixed(3)}</span>
            </div>
        </div>
    );
};

const CameraHandler = () => {
  const { camera, size, gl } = useThree();
  const { state, dispatch } = useStore();
  const zoomRef = useRef(1.0);
  const isPanning = useRef(false);
  const lastPos = useRef([0, 0]);
  const isBDown = useRef(false);
  
  const findSelected = (root: SDFNode | null, id: string | null): SDFNode | null => {
      if (!root || !id) return null;
      if (root.id === id) return root;
      if (isOperation(root)) {
          for (const c of root.children) {
              const f = findSelected(c, id);
              if (f) return f;
          }
      }
      return null;
  };

  const selectedNode = findSelected(state.root, state.selectedId);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      if (isBDown.current && selectedNode && isOperation(selectedNode)) {
          const delta = e.deltaY * -0.001;
          const newVal = Math.max(0, Math.min(1, selectedNode.blend + delta));
          dispatch({ type: 'UPDATE_NODE', payload: { id: selectedNode.id, updates: { blend: newVal } } });
          return;
      }

      zoomRef.current = Math.max(0.1, Math.min(20, zoomRef.current - e.deltaY * 0.001 * zoomRef.current));
      (camera as THREE.OrthographicCamera).zoom = zoomRef.current;
      camera.updateProjectionMatrix();
    };

    const handleKeyDown = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'b') isBDown.current = true; };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'b') isBDown.current = false; };

    gl.domElement.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        gl.domElement.removeEventListener('wheel', handleWheel);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [camera, gl, selectedNode, dispatch]);

  useEffect(() => {
      const onMouseDown = (e: MouseEvent) => {
          if (e.button === 1 || (e.button === 0 && e.altKey)) {
              isPanning.current = true;
              lastPos.current = [e.clientX, e.clientY];
              gl.domElement.style.cursor = 'grabbing';
          }
      };
      const onMouseMove = (e: MouseEvent) => {
          if (isBDown.current && selectedNode && isOperation(selectedNode) && e.buttons === 1 && !e.altKey) {
              const dx = e.movementX * 0.005;
              const newVal = Math.max(0, Math.min(1, selectedNode.blend + dx));
              dispatch({ type: 'UPDATE_NODE', payload: { id: selectedNode.id, updates: { blend: newVal } } });
              return;
          }

          if (!isPanning.current) return;
          const dx = e.clientX - lastPos.current[0];
          const dy = e.clientY - lastPos.current[1];
          lastPos.current = [e.clientX, e.clientY];
          const cam = camera as THREE.OrthographicCamera;
          cam.position.x -= dx / (cam.zoom * 100) * 2;
          cam.position.y += dy / (cam.zoom * 100) * 2;
      };
      const onMouseUp = () => { isPanning.current = false; gl.domElement.style.cursor = 'default'; };
      gl.domElement.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => { 
          gl.domElement.removeEventListener('mousedown', onMouseDown); 
          window.removeEventListener('mousemove', onMouseMove); 
          window.removeEventListener('mouseup', onMouseUp); 
      };
  }, [camera, gl, selectedNode, dispatch]);

  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    const aspect = size.width / size.height;
    cam.left = -aspect; cam.right = aspect; cam.top = 1; cam.bottom = -1;
    cam.updateProjectionMatrix();
  }, [camera, size]);

  return <InputOverlay blendValue={selectedNode && isOperation(selectedNode) ? selectedNode.blend : null} active={isBDown.current} />;
};

const FullScreenQuad: React.FC = () => {
  const materialRef = useRef<any>(null);
  const { state, dispatch } = useStore();
  const shaderCode = useMemo(() => compileTreeToGLSL(state.root), [state.root]);

  useFrame((sceneState) => {
    if (materialRef.current) {
      const mat = materialRef.current;
      mat.uniforms.uTime.value = sceneState.clock.getElapsedTime();
      mat.uniforms.uResolution.value.set(sceneState.size.width, sceneState.size.height);
      mat.uniforms.uDebugMode.value = state.debugMode === 'normal' ? 0 : 1;

      const fullFrag = `
      varying vec2 vWorldPos; 
      uniform vec2 uResolution; 
      uniform float uTime;
      uniform int uDebugMode;

      ${shaderCode}

      float grid(vec2 uv, float scale) { 
          vec2 grid = abs(fract(uv * scale - 0.5) - 0.5) / scale; 
          return 1.0 - smoothstep(0.0, 1.0 * length(fwidth(uv)), min(grid.x, grid.y)); 
      }

      void main() {
          vec2 p = vWorldPos;
          float d = map(p);
          
          vec3 baseColor = vec3(0.02, 0.03, 0.05);
          vec3 gridColor = vec3(0.1) * grid(p, 5.0) + vec3(0.05) * grid(p, 1.0);
          vec3 col = baseColor + gridColor;

          if (uDebugMode == 0) {
              col = mix(col, vec3(0.1, 0.4, 0.8), (1.0 - smoothstep(0.0, 0.02, d)) * 0.5);
              col = mix(col, vec3(1.0), 1.0 - smoothstep(0.0, 1.5 * length(fwidth(p)), abs(d)));
          } else {
              col = vec3(0.5 + 0.5 * sin(d * 20.0 - uTime * 2.0));
              col *= exp(-abs(d) * 0.5);
              col = mix(col, vec3(1.0, 0.0, 0.0), 1.0 - smoothstep(0.0, 0.02, abs(d)));
          }
          
          gl_FragColor = vec4(col, 1.0);
      }`;

      if (mat.fragmentShader !== fullFrag) { 
          mat.fragmentShader = fullFrag; 
          mat.needsUpdate = true; 
      }
    }
  });

  return (
    /* @ts-ignore */
    <mesh 
      position={[0, 0, -1]} 
      renderOrder={-1}
      onPointerDown={(e) => {
        // Deselect if clicking on background. 
        // Other interactive items should call stopPropagation()
        dispatch({ type: 'SELECT_NODE', payload: null });
      }}
    >
      {/* @ts-ignore */}
      <planeGeometry args={[100, 100]} />
      {/* @ts-ignore */}
      <fieldMaterial ref={materialRef} transparent={false} depthTest={false} depthWrite={false} />
    {/* @ts-ignore */}
    </mesh>
  );
};

export default function Scene() {
  return (
    <div className="w-full h-full bg-black cursor-crosshair relative" onContextMenu={(e) => e.preventDefault()}>
      <Canvas orthographic camera={{ zoom: 100 }}>
        <DropHandler />
        <CameraHandler />
        <FullScreenQuad />
        <GizmoLayer />
      </Canvas>
    </div>
  );
}


import { SDFNode, isPrimitive, isOperation, SDFPrimitive, SDFOperation, IR, IRNode, OPERATOR_REGISTRY } from '../types';

const PREAMBLE = `
precision highp float;

float sdCircle( vec2 p, float r ) {
    return length(p) - r;
}

float sdBox( in vec2 p, in vec2 b ) {
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

float sdCapsule( vec2 p, float h, float r ) {
    p.y -= clamp( p.y, -h*0.5, h*0.5 );
    return length( p ) - r;
}

float opSmoothUnion( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/max(k,0.0001), 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

float opSmoothSubtraction( float d1, float d2, float k ) {
    float h = clamp( 0.5 - 0.5*(d2-d1)/max(k,0.0001), 0.0, 1.0 );
    return mix( d2, -d1, h ) + k*h*(1.0-h);
}

float opSmoothIntersection( float d1, float d2, float k ) {
    float h = clamp( 0.5 - 0.5*(d2-d1)/max(k,0.0001), 0.0, 1.0 );
    return mix( d2, d1, h ) + k*h*(1.0-h);
}

float opXor(float d1, float d2) {
    return max(min(d1, d2), -max(d1, d2));
}

vec2 rotate(vec2 p, float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c) * p;
}

vec2 opRepeat(vec2 p, vec2 period) {
    return mod(p + 0.5*period, period) - 0.5*period;
}

vec2 opMirror(vec2 p, float offset, bool isX) {
    if(isX) p.x = abs(p.x - offset);
    else p.y = abs(p.y - offset);
    return p;
}

vec2 opBend(vec2 p, float k, bool isX) {
    float c = cos(k*(isX ? p.x : p.y));
    float s = sin(k*(isX ? p.x : p.y));
    mat2 m = mat2(c,-s,s,c);
    return m*p;
}

vec2 opTwist(vec2 p, float k) {
    float a = k*length(p);
    float s = sin(a);
    float c = cos(a);
    return mat2(c,-s,s,c)*p;
}
`;

/**
 * COMPILER: GRAPH -> IR
 * Deterministically flattens and annotates the graph.
 */
export const compileToIR = (root: SDFNode | null): IR => {
  const ir: IR = {
    nodes: {},
    rootId: root?.id || '',
    evaluationOrder: []
  };

  if (!root) return ir;

  const traverse = (node: SDFNode, currentDomainStack: string[]) => {
    const meta = OPERATOR_REGISTRY[node.type];
    const isDomain = meta.category === 'Domain';
    const domainStack = [...currentDomainStack];
    if (isDomain) domainStack.push(node.id);

    const children: string[] = [];
    if (isOperation(node)) {
      node.children.forEach(child => {
        children.push(child.id);
        traverse(child, domainStack);
      });
    }

    // Extract params and normalize for serialization
    const params: Record<string, any> = {};
    if (isPrimitive(node)) {
      params.position = node.position;
      params.rotation = node.rotation;
      params.scale = node.scale;
      if (node.radius !== undefined) params.radius = node.radius;
      if (node.size !== undefined) params.size = node.size;
      if (node.length !== undefined) params.length = node.length;
    } else {
      params.blend = node.blend;
      if (node.opRadius !== undefined) params.opRadius = node.opRadius;
      if (node.thickness !== undefined) params.thickness = node.thickness;
      if (node.period !== undefined) params.period = node.period;
      if (node.axis !== undefined) params.axis = node.axis;
      if (node.offset !== undefined) params.offset = node.offset;
      if (node.strength !== undefined) params.strength = node.strength;
      if (node.frequency !== undefined) params.frequency = node.frequency;
      if (node.amplitude !== undefined) params.amplitude = node.amplitude;
      if (node.minLimit !== undefined) params.minLimit = node.minLimit;
      if (node.maxLimit !== undefined) params.maxLimit = node.maxLimit;
    }

    const irNode: IRNode = {
      id: node.id,
      type: node.type,
      params,
      domainStack: currentDomainStack, // inherited, not including self
      children
    };

    ir.nodes[node.id] = irNode;
    ir.evaluationOrder.push(node.id);
  };

  traverse(root, []);
  return ir;
};

// Add collectPrimitives utility to traverse the SDF tree and return all primitive nodes.
export const collectPrimitives = (root: SDFNode | null): SDFPrimitive[] => {
  const result: SDFPrimitive[] = [];
  const traverse = (node: SDFNode) => {
    if (isPrimitive(node)) {
      result.push(node);
    } else if (isOperation(node)) {
      node.children.forEach(traverse);
    }
  };
  if (root) traverse(root);
  return result;
};

export const compileTreeToGLSL = (root: SDFNode | null): string => {
  if (!root) return PREAMBLE + `float map(vec2 p) { return 100.0; }`;

  let codeBody = "";
  
  const processNode = (node: SDFNode, parentP: string): string => {
    const id = node.id.replace(/-/g, '_');
    const pVar = `p_${id}`;
    const dVar = `d_${id}`;

    if (isPrimitive(node)) {
      const [tx, ty] = node.position;
      let transformCode = `    vec2 ${pVar} = ${parentP} - vec2(${tx.toFixed(4)}, ${ty.toFixed(4)});\n`;
      if (node.rotation !== 0) transformCode += `    ${pVar} = rotate(${pVar}, ${node.rotation.toFixed(4)});\n`;
      
      let distCode = "";
      if (node.type === 'circle') distCode = `    float ${dVar} = sdCircle(${pVar}, ${node.radius?.toFixed(4) ?? 0.5});\n`;
      else if (node.type === 'box') {
        const [hx, hy] = node.size ?? [0.5, 0.5];
        distCode = `    float ${dVar} = sdBox(${pVar}, vec2(${hx.toFixed(4)}, ${hy.toFixed(4)}));\n`;
      } else if (node.type === 'capsule') {
        const h = node.length ?? 0.5, r = node.radius ?? 0.1;
        distCode = `    float ${dVar} = sdCapsule(${pVar}, ${h.toFixed(4)}, ${r.toFixed(4)});\n`;
      }
      codeBody += transformCode + distCode;
      return dVar;
    } else if (isOperation(node)) {
        const op = node as SDFOperation;
        if (op.children.length === 0) return '100.0';
        let currentP = parentP;
        if (op.type === 'repeat') {
            const [px, py] = op.period ?? [1,1];
            codeBody += `    vec2 ${pVar} = opRepeat(${parentP}, vec2(${px.toFixed(4)}, ${py.toFixed(4)}));\n`;
            currentP = pVar;
        } else if (op.type === 'mirror') {
            codeBody += `    vec2 ${pVar} = opMirror(${parentP}, ${op.offset?.toFixed(4) ?? 0.0}, ${op.axis === 'x'});\n`;
            currentP = pVar;
        } else if (op.type === 'bend') {
            codeBody += `    vec2 ${pVar} = opBend(${parentP}, ${op.strength?.toFixed(4) ?? 1.0}, ${op.axis === 'x'});\n`;
            currentP = pVar;
        } else if (op.type === 'twist') {
            codeBody += `    vec2 ${pVar} = opTwist(${parentP}, ${op.strength?.toFixed(4) ?? 1.0});\n`;
            currentP = pVar;
        }

        if (op.type === 'displace') {
            const baseVar = processNode(op.children[0], currentP);
            const strength = op.strength?.toFixed(4) ?? "0.5000";
            if (op.children.length >= 2) {
                const sourceVar = processNode(op.children[1], currentP);
                codeBody += `    float mod_${id} = ${baseVar} + ${strength} * ${sourceVar};\n`;
            } else {
                codeBody += `    float mod_${id} = ${baseVar} + ${strength} * sin(${currentP}.x * 4.0) * sin(${currentP}.y * 4.0);\n`;
            }
            return `mod_${id}`;
        }

        const childVars = op.children.map(c => processNode(c, currentP));
        let resultVar = childVars[0];
        const k = op.blend.toFixed(4);

        if (op.type === 'subtract' || op.type === 'smooth_subtract') {
            let cutterVar = childVars[1];
            for (let i = 2; i < childVars.length; i++) {
                const nextCutter = `cut_${id}_${i}`;
                codeBody += `    float ${nextCutter} = min(${cutterVar}, ${childVars[i]});\n`;
                cutterVar = nextCutter;
            }
            const fn = (op.type === 'subtract' && op.blend === 0) ? 'max' : 'opSmoothSubtraction';
            codeBody += `    float res_${id} = ${fn === 'max' ? `max(${resultVar}, -${cutterVar})` : `opSmoothSubtraction(${cutterVar}, ${resultVar}, ${k})`};\n`;
            resultVar = `res_${id}`;
        } else if (op.type === 'intersect' || op.type === 'smooth_intersect') {
            for (let i = 1; i < childVars.length; i++) {
                const nextVar = `tmp_${id}_${i}`;
                if (op.blend === 0) codeBody += `    float ${nextVar} = max(${resultVar}, ${childVars[i]});\n`;
                else codeBody += `    float ${nextVar} = opSmoothIntersection(${resultVar}, ${childVars[i]}, ${k});\n`;
                resultVar = nextVar;
            }
        } else if (op.type === 'xor') {
            for (let i = 1; i < childVars.length; i++) {
                const nextVar = `tmp_${id}_${i}`;
                codeBody += `    float ${nextVar} = opXor(${resultVar}, ${childVars[i]});\n`;
                resultVar = nextVar;
            }
        } else {
            const useSmooth = (op.type === 'smooth_union' || (op.blend > 0));
            for (let i = 1; i < childVars.length; i++) {
                const nextVar = `tmp_${id}_${i}`;
                if (useSmooth) codeBody += `    float ${nextVar} = opSmoothUnion(${resultVar}, ${childVars[i]}, ${k});\n`;
                else codeBody += `    float ${nextVar} = min(${resultVar}, ${childVars[i]});\n`;
                resultVar = nextVar;
            }
        }

        if (op.type === 'dilate') resultVar = `(${resultVar} - ${op.opRadius?.toFixed(4) ?? 0.1})`;
        else if (op.type === 'erode') resultVar = `(${resultVar} + ${op.opRadius?.toFixed(4) ?? 0.1})`;
        else if (op.type === 'shell') resultVar = `(abs(${resultVar}) - ${op.thickness?.toFixed(4) ?? 0.05})`;
        else if (op.type === 'invert') resultVar = `(-${resultVar})`;
        else if (op.type === 'clamp') resultVar = `clamp(${resultVar}, ${op.minLimit?.toFixed(4) ?? -1.0}, ${op.maxLimit?.toFixed(4) ?? 1.0})`;
        
        return resultVar;
    }
    return '100.0';
  };

  const finalDistVar = processNode(root, 'p');
  return `${PREAMBLE}\nfloat map(vec2 p) {\n${codeBody}\n    return ${finalDistVar};\n}`;
};

import { useEffect,useMemo } from 'react';
import { ReactFlow,Background,Controls,Handle,Position,useNodesState,type NodeProps,type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Component } from '../../shared/schemas/modelResponses';
import type { EvidenceManifest } from '../../shared/schemas/evidenceManifest';
import { objectUrl } from '../api/client';
type ComponentNode = Node<{ component: Component; page: EvidenceManifest['pages'][number]; projectId: string }>;
function SourceCard({ data,selected }: NodeProps<ComponentNode>) {
  const { component,page,projectId } = data,crop = page.regions.find(region => region.id === component.regionId)!;
  const scale = Math.min(228 / crop.width,135 / crop.height);
  return <div className={`source-node ${selected ? 'selected' : ''}`}><Handle type="target" position={Position.Left} /><div className="node-image"><div style={{ width: crop.width * scale,height: crop.height * scale,backgroundImage: `url("${objectUrl(projectId,page.screenshot.objectKey)}")`,backgroundSize: `${page.viewport.width * scale}px ${page.viewport.height * scale}px`,backgroundPosition: `${-crop.x * scale}px ${-crop.y * scale}px` }} /></div><div className="node-content"><span className="eyebrow">{component.semanticRole}</span><h3>{component.label}</h3><div className="node-meta"><span>{page.title}</span><span className="pill">{component.recommendation}</span></div></div><Handle type="source" position={Position.Right} /></div>;
}
const nodeTypes = { source: SourceCard };
export function ComponentCanvas({ components,manifest,projectId,onSelect }: { components: Component[]; manifest: EvidenceManifest; projectId: string; onSelect: (component: Component) => void }) {
  const initial = useMemo(() => components.map((component,index) => ({ id: component.stableId,type: 'source',position: { x: (index % 3) * 310,y: Math.floor(index / 3) * 270 },data: { component,page: manifest.pages.find(page => page.id === component.sourcePageId)!,projectId } })),[components,manifest,projectId]);
  const [nodes,setNodes,onNodesChange] = useNodesState(initial);
  useEffect(() => setNodes(initial),[initial,setNodes]);
  const edges = components.flatMap((component,index) => { const previous = components.slice(0,index).find(item => item.reusableGroupId === component.reusableGroupId); return previous ? [{ id: `${previous.stableId}-${component.stableId}`,source: previous.stableId,target: component.stableId,style: { stroke: '#bcb3e8',strokeWidth: 1.5 },type: 'smoothstep' }] : []; });
  return <div className="component-canvas"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onNodeClick={(_,node) => onSelect(node.data.component)} fitView minZoom={0.25} maxZoom={1.8} nodesConnectable={false}><Background color="#d9d6e1" gap={20} /><Controls showInteractive={false} /></ReactFlow></div>;
}

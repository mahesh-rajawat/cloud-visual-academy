import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo } from 'react'
import type { Lesson } from '../services/types'

const KIND_COLOR: Record<string, string> = {
  compute: '#0a7cd6', network: '#0891b2', security: '#b45309', storage: '#4f46e5', identity: '#7c4dcc', scope: '#475569', user: '#475569',
}
const W = 180
const H = 56
const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left] as const

type BoxData = { label: string; color: string }

/** A box with an invisible handle on every side, so each arrow can leave and arrive on the side facing the other box. */
function Box({ data }: NodeProps<Node<BoxData>>) {
  return (
    <div className="flex items-center justify-center rounded-lg border-2 bg-white px-2 text-center text-xs leading-tight text-slate-800 dark:bg-slate-800 dark:text-slate-100"
      style={{ width: W, minHeight: H, borderColor: data.color }}>
      {data.label}
      {SIDES.map((s) => (
        <span key={s}>
          <Handle type="source" position={s} id={`s-${s}`} isConnectable={false} style={{ opacity: 0 }} />
          <Handle type="target" position={s} id={`t-${s}`} isConnectable={false} style={{ opacity: 0 }} />
        </span>
      ))}
    </div>
  )
}
const nodeTypes = { box: Box }

/** Pick the facing sides: left/right when the boxes are mostly side by side, top/bottom when stacked. */
export function edgeSides(from: { x: number; y: number }, to: { x: number; y: number }): [Position, Position] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? [Position.Right, Position.Left] : [Position.Left, Position.Right]
  return dy >= 0 ? [Position.Bottom, Position.Top] : [Position.Top, Position.Bottom]
}

export function ArchitectureDiagram({ diagram }: { diagram: Lesson['diagram'] }) {
  const nodes = useMemo<Node<BoxData>[]>(() => diagram.nodes.map((n) => ({
    id: n.id, type: 'box', position: { x: n.x, y: n.y }, draggable: false,
    data: { label: n.label, color: KIND_COLOR[n.kind ?? 'scope'] ?? '#475569' },
  })), [diagram])
  const edges = useMemo<Edge[]>(() => diagram.edges.map((e, i) => {
    const a = diagram.nodes.find((n) => n.id === e.from)!
    const b = diagram.nodes.find((n) => n.id === e.to)!
    const [out, into] = edgeSides(a, b)
    return {
      id: `e${i}`, source: e.from, target: e.to, sourceHandle: `s-${out}`, targetHandle: `t-${into}`, type: 'smoothstep',
      label: e.label, labelBgPadding: [4, 2] as [number, number], labelBgBorderRadius: 4, labelStyle: { fontSize: 11 },
      markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 1.5 },
    }
  }), [diagram])
  return (
    <div className="h-80 w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800" aria-label="Architecture diagram (pan and zoom)">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15 }} nodesConnectable={false} proOptions={{ hideAttribution: true }}>
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
      <ul className="sr-only">
        {diagram.edges.map((e, i) => <li key={i}>{diagram.nodes.find((n) => n.id === e.from)?.label} to {diagram.nodes.find((n) => n.id === e.to)?.label}{e.label ? `: ${e.label}` : ''}</li>)}
      </ul>
    </div>
  )
}

'use client';

import { useMemo } from 'react';
import type { LearningPathNode } from '@/lib/types/learning-path';

interface Props {
  nodes: LearningPathNode[];
  activeNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
}

interface KGNode {
  id: string;
  label: string;
  status: 'completed' | 'active' | 'locked';
}

interface KGEdge {
  from: string;
  to: string;
}

/**
 * 简洁知识图谱条：用纯 SVG 渲染当前学习路径的知识点拓扑。
 * 当前正在学习的节点高亮，已完成节点绿色，未解锁节点灰色。
 */
export function KnowledgeGraphBar({ nodes, activeNodeId, onNodeClick }: Props) {
  const { kgNodes, kgEdges } = useMemo(() => {
    if (!nodes.length) return { kgNodes: [], kgEdges: [] };

    const kgNodes: KGNode[] = nodes.map((node) => {
      let status: KGNode['status'] = 'locked';
      if (node.status === 'completed') status = 'completed';
      else if (node.id === activeNodeId || node.status === 'in_progress') status = 'active';
      else if (node.status === 'available') status = 'active';
      return { id: node.id, label: node.title, status };
    });

    const kgEdges: KGEdge[] = [];
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const node of nodes) {
      for (const prereq of node.prerequisites) {
        if (nodeIds.has(prereq)) {
          kgEdges.push({ from: prereq, to: node.id });
        }
      }
    }

    // 对于没有显式 prerequisites 的节点，按顺序创建线性链
    if (kgEdges.length === 0 && nodes.length > 1) {
      for (let i = 0; i < nodes.length - 1; i++) {
        kgEdges.push({ from: nodes[i].id, to: nodes[i + 1].id });
      }
    }

    return { kgNodes, kgEdges };
  }, [nodes, activeNodeId]);

  if (kgNodes.length === 0) return null;

  // 布局参数
  const nodeWidth = 120;
  const nodeHeight = 36;
  const gapX = 60;
  const padX = 20;
  const padY = 12;
  const totalWidth = padX * 2 + kgNodes.length * nodeWidth + (kgNodes.length - 1) * gapX;
  const totalHeight = padY * 2 + nodeHeight;

  const nodePositions = new Map<string, { x: number; y: number }>();
  kgNodes.forEach((node, i) => {
    nodePositions.set(node.id, {
      x: padX + i * (nodeWidth + gapX),
      y: padY,
    });
  });

  const statusColors: Record<KGNode['status'], { fill: string; stroke: string; text: string }> = {
    completed: { fill: '#dcfce7', stroke: '#22c55e', text: '#166534' },
    active: { fill: '#dbeafe', stroke: '#3b82f6', text: '#1e40af' },
    locked: { fill: '#f3f4f6', stroke: '#d1d5db', text: '#6b7280' },
  };

  return (
    <div className="overflow-x-auto border rounded-lg bg-background p-2">
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="mx-auto block"
      >
        {/* 边 */}
        {kgEdges.map((edge, i) => {
          const from = nodePositions.get(edge.from);
          const to = nodePositions.get(edge.to);
          if (!from || !to) return null;
          const x1 = from.x + nodeWidth;
          const y1 = from.y + nodeHeight / 2;
          const x2 = to.x;
          const y2 = to.y + nodeHeight / 2;
          return (
            <line
              key={`edge-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#d1d5db"
              strokeWidth={1.5}
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {/* 箭头标记 */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="4"
            refX="6"
            refY="2"
            orient="auto"
          >
            <polygon points="0 0, 6 2, 0 4" fill="#d1d5db" />
          </marker>
        </defs>

        {/* 节点 */}
        {kgNodes.map((node) => {
          const pos = nodePositions.get(node.id);
          if (!pos) return null;
          const colors = statusColors[node.status];
          const isActive = node.status === 'active';
          return (
            <g
              key={node.id}
              className="cursor-pointer"
              onClick={() => onNodeClick?.(node.id)}
            >
              <rect
                x={pos.x}
                y={pos.y}
                width={nodeWidth}
                height={nodeHeight}
                rx={8}
                ry={8}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={isActive ? 2 : 1.5}
                className={isActive ? 'animate-pulse' : ''}
              />
              <text
                x={pos.x + nodeWidth / 2}
                y={pos.y + nodeHeight / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={colors.text}
                fontSize={12}
                fontWeight={isActive ? 600 : 400}
              >
                {node.label.length > 8 ? node.label.slice(0, 8) + '...' : node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

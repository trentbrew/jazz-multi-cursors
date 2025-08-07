import { useAccount, useCoState } from 'jazz-tools/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CursorFeed } from '../schema';
import { getColor } from '../utils/getColor';
import { getName } from '../utils/getName';
import { Cursor } from './Cursor';

const OLD_CURSOR_AGE_SECONDS = Number(
  import.meta.env.VITE_OLD_CURSOR_AGE_SECONDS,
);

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Start' },
    position: { x: 250, y: 25 },
  },
  {
    id: '2',
    data: { label: 'Process' },
    position: { x: 100, y: 125 },
  },
  {
    id: '3',
    type: 'output',
    data: { label: 'End' },
    position: { x: 250, y: 250 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
];

interface FlowCanvasProps {
  cursorFeedID: string;
}

export function FlowCanvas({ cursorFeedID }: FlowCanvasProps) {
  const { me } = useAccount();
  const cursors = useCoState(CursorFeed, cursorFeedID, { resolve: true });
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const remoteCursors = useMemo(() => {
    if (!cursors?.perSession) return [];

    return Object.values(cursors.perSession)
      .map((entry) => ({
        entry,
        position: entry.value.position,
        color: getColor(entry.tx.sessionID),
        name: getName(entry.by?.profile?.name, entry.tx.sessionID),
        age: new Date().getTime() - new Date(entry.madeAt).getTime(),
        active:
          !OLD_CURSOR_AGE_SECONDS ||
          entry.madeAt >= new Date(Date.now() - 1000 * OLD_CURSOR_AGE_SECONDS),
        isMe: entry.tx.sessionID === me?.sessionID,
      }))
      .sort((a, b) => {
        return b.entry.madeAt.getTime() - a.entry.madeAt.getTime();
      });
  }, [cursors, me?.sessionID]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onCursorMove = useCallback(
    (event: any) => {
      if (!(cursors && me)) return;

      // Get the ReactFlow instance to convert coordinates
      const reactFlowInstance = reactFlowRef.current;
      if (!reactFlowInstance) return;

      // Convert screen coordinates to flow coordinates
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      cursors.push({
        position,
      });
    },
    [cursors, me],
  );

  const onNodeDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const onNodeDragStop = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowRef.current = instance;
  }, []);

  const onDoubleClick = useCallback(
    (event: any) => {
      if (!reactFlowRef.current) return;

      const reactFlowInstance = reactFlowRef.current;
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: 'default',
        data: { label: 'New Node' },
        position,
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes],
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMouseMove={onCursorMove}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onDoubleClick={onDoubleClick}
        onInit={onInit}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {/* Render remote cursors in a separate SVG overlay */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {remoteCursors.map((cursor) =>
          !cursor.isMe && cursor.active ? (
            <Cursor
              key={cursor.entry.tx.sessionID}
              position={cursor.position}
              color={cursor.color}
              isDragging={isDragging}
              isRemote={true}
              name={cursor.name}
              age={cursor.age}
              centerOfBounds={{ x: 0, y: 0 }}
              bounds={{
                x: 0,
                y: 0,
                width: window.innerWidth,
                height: window.innerHeight,
              }}
            />
          ) : null,
        )}
      </svg>
    </div>
  );
}

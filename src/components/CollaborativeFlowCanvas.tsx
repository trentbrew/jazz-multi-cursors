import { useAccount, useCoState } from 'jazz-tools/react';
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
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
  type Viewport,
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

interface CollaborativeFlowCanvasProps {
  cursorFeedID: string;
}

export function CollaborativeFlowCanvas({
  cursorFeedID,
}: CollaborativeFlowCanvasProps) {
  const { me } = useAccount();
  const cursors = useCoState(CursorFeed, cursorFeedID, { resolve: true });

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });

  // Refs to track current state and prevent infinite loops
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const lastSyncRef = useRef<number>(0);
  const isReceivingUpdateRef = useRef(false);

  // Update refs when state changes
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Sync nodes and edges to cursor feed for real-time collaboration
  const syncFlowData = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      if (!cursors || isReceivingUpdateRef.current) return;

      // Debounce sync to prevent excessive updates
      const now = Date.now();
      if (now - lastSyncRef.current < 100) return; // 100ms debounce
      lastSyncRef.current = now;

      // Store flow data in cursor feed as JSON strings
      cursors.push({
        position: { x: 0, y: 0 }, // Dummy position
        flowData: {
          nodes: JSON.stringify(newNodes),
          edges: JSON.stringify(newEdges),
          timestamp: now,
        },
      });
    },
    [cursors],
  );

  // Listen for flow data changes from other users
  useEffect(() => {
    if (!cursors?.perSession) return;

    Object.values(cursors.perSession).forEach((entry) => {
      if (entry.value.flowData && entry.tx.sessionID !== me?.sessionID) {
        try {
          const { nodes: remoteNodesStr, edges: remoteEdgesStr } =
            entry.value.flowData;
          if (remoteNodesStr && remoteEdgesStr) {
            const remoteNodes = JSON.parse(remoteNodesStr);
            const remoteEdges = JSON.parse(remoteEdgesStr);

            // Only update if the data is actually different to prevent infinite loops
            const currentNodesStr = JSON.stringify(nodesRef.current);
            const currentEdgesStr = JSON.stringify(edgesRef.current);

            if (remoteNodesStr !== currentNodesStr) {
              isReceivingUpdateRef.current = true;
              setNodes(remoteNodes);
              setTimeout(() => {
                isReceivingUpdateRef.current = false;
              }, 50);
            }
            if (remoteEdgesStr !== currentEdgesStr) {
              isReceivingUpdateRef.current = true;
              setEdges(remoteEdges);
              setTimeout(() => {
                isReceivingUpdateRef.current = false;
              }, 50);
            }
          }
        } catch (error) {
          console.error('Error parsing flow data:', error);
        }
      }
    });
  }, [cursors?.perSession, me?.sessionID]); // Remove setNodes and setEdges from dependencies

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
    (params: Connection) => {
      const newEdges = addEdge(params, edges);
      setEdges(newEdges);
      syncFlowData(nodes, newEdges);
    },
    [setEdges, edges, nodes, syncFlowData],
  );

  const onCursorMove = useCallback(
    (event: any) => {
      if (!(cursors && me)) return;

      // Get the ReactFlow instance to convert coordinates
      const reactFlowInstance = reactFlowRef.current;
      if (!reactFlowInstance) return;

      // Convert screen coordinates to flow coordinates (accounting for zoom/pan)
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

      const newNodes = [...nodes, newNode];
      setNodes(newNodes);
      syncFlowData(newNodes, edges);
    },
    [setNodes, nodes, edges, syncFlowData],
  );

  const onViewportChange = useCallback((newViewport: Viewport) => {
    setViewport(newViewport);
  }, []);

  // Handle node changes and sync
  const onNodesChangeWithSync = useCallback(
    (changes: any) => {
      onNodesChange(changes);

      // Sync after position changes
      const hasPositionChange = changes.some(
        (change: any) =>
          change.type === 'position' && change.dragging === false,
      );

      if (hasPositionChange) {
        // Get updated nodes after the change
        const updatedNodes = changes.reduce((acc: Node[], change: any) => {
          if (change.type === 'position') {
            return acc.map((node) =>
              node.id === change.id
                ? { ...node, position: change.position }
                : node,
            );
          }
          return acc;
        }, nodes);

        syncFlowData(updatedNodes, edges);
      }
    },
    [onNodesChange, nodes, edges, syncFlowData],
  );

  // Convert flow coordinates to screen coordinates for cursor display
  const convertFlowToScreen = useCallback(
    (flowPosition: { x: number; y: number }) => {
      if (!reactFlowRef.current) return flowPosition;

      const screenPosition =
        reactFlowRef.current.flowToScreenPosition(flowPosition);
      return screenPosition;
    },
    [],
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeWithSync}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMouseMove={onCursorMove}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onDoubleClick={onDoubleClick}
        onInit={onInit}
        onViewportChange={onViewportChange}
        viewport={viewport}
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
              position={convertFlowToScreen(cursor.position)}
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

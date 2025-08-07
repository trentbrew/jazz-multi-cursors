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
import { CursorFeed, CursorContainer } from '../schema';
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
  containerID: string;
}

export function CollaborativeFlowCanvas({
  cursorFeedID,
  containerID,
}: CollaborativeFlowCanvasProps) {
  const { me } = useAccount();
  const cursors = useCoState(CursorFeed, cursorFeedID, { resolve: true });
  const cursorContainer = useCoState(CursorContainer, containerID, {
    resolve: true,
  });
  const flowDiagram = cursorContainer?.flowDiagram;
  const flowViewport = cursorContainer?.flowViewport;

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
  const isInitialLoadRef = useRef(true);
  const hasLoadedPersistedDataRef = useRef(false);

  // Update refs when state changes
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Load persisted flow data on mount
  useEffect(() => {
    if (
      flowDiagram?.nodes &&
      flowDiagram?.edges &&
      !hasLoadedPersistedDataRef.current
    ) {
      hasLoadedPersistedDataRef.current = true;

      // Convert Jazz nodes to ReactFlow nodes
      const persistedNodes: Node[] = flowDiagram.nodes.map((jazzNode: any) => ({
        id: String(jazzNode.id || ''),
        type: String(jazzNode.type || 'default'),
        data: { label: String(jazzNode.data?.label || '') },
        position: {
          x: Number(jazzNode.position?.x || 0),
          y: Number(jazzNode.position?.y || 0),
        },
      }));

      // Convert Jazz edges to ReactFlow edges
      const persistedEdges: Edge[] = flowDiagram.edges.map((jazzEdge: any) => ({
        id: String(jazzEdge.id || ''),
        source: String(jazzEdge.source || ''),
        target: String(jazzEdge.target || ''),
        type: String(jazzEdge.type || 'default'),
      }));

      // Only set if we have persisted data, otherwise keep initial nodes
      if (persistedNodes.length > 0) {
        setNodes(persistedNodes);
      }
      if (persistedEdges.length > 0) {
        setEdges(persistedEdges);
      }
    }
  }, [flowDiagram, setNodes, setEdges]);

  // Load persisted viewport
  useEffect(() => {
    if (
      flowViewport &&
      reactFlowRef.current &&
      !hasLoadedPersistedDataRef.current
    ) {
      const newViewport = {
        x: Number(flowViewport.x || 0),
        y: Number(flowViewport.y || 0),
        zoom: Number(flowViewport.zoom || 1),
      };
      setViewport(newViewport);
      reactFlowRef.current.setViewport(newViewport);
    }
  }, [flowViewport]);

  // Sync nodes and edges to cursor feed for real-time collaboration
  const syncFlowData = useCallback(
    (newNodes: Node[], newEdges: Edge[], isDragging = false) => {
      if (!cursors || isReceivingUpdateRef.current || isInitialLoadRef.current)
        return;

      // Use different debounce times for dragging vs non-dragging
      const now = Date.now();
      const debounceTime = isDragging ? 50 : 100; // Faster sync during dragging
      if (now - lastSyncRef.current < debounceTime) return;
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

  // Persist flow data to Jazz database (simplified)
  const persistFlowData = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      if (!flowDiagram || isInitialLoadRef.current) return;

      // For now, just sync to cursor feed for persistence
      // The Jazz database persistence can be implemented later
      syncFlowData(newNodes, newEdges, false);
    },
    [flowDiagram, syncFlowData],
  );

  // Persist viewport to Jazz database
  const persistViewport = useCallback(
    (newViewport: Viewport) => {
      if (!flowViewport || isInitialLoadRef.current) return;

      // For now, just update the viewport state
      // The Jazz database persistence can be implemented later
      setViewport(newViewport);
    },
    [flowViewport],
  );

  // Mark initial load as complete after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialLoadRef.current = false;
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

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
      syncFlowData(nodes, newEdges, false);
      persistFlowData(nodes, newEdges);
    },
    [setEdges, edges, nodes, syncFlowData, persistFlowData],
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
    // Persist the final state after dragging
    persistFlowData(nodes, edges);
  }, [nodes, edges, persistFlowData]);

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
      syncFlowData(newNodes, edges, false);
      persistFlowData(newNodes, edges);
    },
    [setNodes, nodes, edges, syncFlowData, persistFlowData],
  );

  const onViewportChange = useCallback(
    (newViewport: Viewport) => {
      setViewport(newViewport);
      persistViewport(newViewport);
    },
    [persistViewport],
  );

  // Handle node changes and sync
  const onNodesChangeWithSync = useCallback(
    (changes: any) => {
      onNodesChange(changes);

      // Sync during dragging for real-time movement
      const hasPositionChange = changes.some(
        (change: any) => change.type === 'position',
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

        // Sync immediately during drag for real-time movement
        syncFlowData(updatedNodes, edges, isDragging);

        // Persist when dragging stops
        if (!isDragging) {
          persistFlowData(updatedNodes, edges);
        }
      }
    },
    [onNodesChange, nodes, edges, syncFlowData, isDragging, persistFlowData],
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

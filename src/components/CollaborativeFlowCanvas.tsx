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
  Panel,
  SelectionMode,
  PanOnScrollMode,
  type SelectionDragHandler,
  useReactFlow,
  useOnSelectionChange,
  useOnViewportChange,
  ReactFlowProvider,
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
    type: 'custom',
    data: { label: 'Start' },
    position: { x: 250, y: 25 },
  },
  {
    id: '2',
    type: 'custom',
    data: { label: 'Process' },
    position: { x: 100, y: 125 },
  },
  {
    id: '3',
    type: 'custom',
    data: { label: 'End' },
    position: { x: 250, y: 250 },
  },
];

// Custom node component with selection styling
const CustomNode = ({ data, selected }: { data: any; selected: boolean }) => (
  <div
    style={{
      padding: '10px',
      borderRadius: '5px',
      backgroundColor: selected ? '#e3f2fd' : '#fff',
      border: selected ? '2px solid #2196f3' : '1px solid #ccc',
      boxShadow: selected
        ? '0 0 10px rgba(33, 150, 243, 0.3)'
        : '0 2px 4px rgba(0,0,0,0.1)',
      transition: 'all 0.2s ease',
    }}
  >
    {data.label}
  </div>
);

const nodeTypes = {
  custom: CustomNode,
};

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
];

interface CollaborativeFlowCanvasProps {
  cursorFeedID: string;
  containerID: string;
}

// Inner component that uses React Flow hooks
function FlowCanvasInner({
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

  // React Flow hooks
  const reactFlowInstance = useReactFlow();

  // Marquee selection state
  const [selectionBox, setSelectionBox] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
    isSelecting: boolean;
  } | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);

  // Gesture control state
  const [isPanning, setIsPanning] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(
    null,
  );
  const [lastTouchCenter, setLastTouchCenter] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Refs to track current state and prevent infinite loops
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const lastSyncRef = useRef<number>(0);
  const isReceivingUpdateRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  const hasLoadedPersistedDataRef = useRef(false);
  const localStorageKeyRef = useRef(`flow-state-${containerID}`);

  // Update refs when state changes
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Load persisted flow data on mount with localStorage backup
  useEffect(() => {
    if (hasLoadedPersistedDataRef.current) return;

    let loadedFromJazz = false;
    let loadedFromLocalStorage = false;

    // First, try to load from Jazz database
    if (flowDiagram?.nodes && flowDiagram?.edges) {
      loadedFromJazz = true;
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
        console.log('Loaded flow data from Jazz database');
      }
      if (persistedEdges.length > 0) {
        setEdges(persistedEdges);
      }
    }

    // If no Jazz data, try localStorage as backup
    if (!loadedFromJazz) {
      try {
        const localStorageData = localStorage.getItem(
          localStorageKeyRef.current,
        );
        if (localStorageData) {
          const parsedData = JSON.parse(localStorageData);
          if (parsedData.nodes && parsedData.edges) {
            setNodes(parsedData.nodes);
            setEdges(parsedData.edges);
            loadedFromLocalStorage = true;
            console.log('Loaded flow data from localStorage backup');
          }
        }
      } catch (error) {
        console.error('Error loading from localStorage:', error);
      }
    }

    // If neither Jazz nor localStorage has data, use initial state
    if (!loadedFromJazz && !loadedFromLocalStorage) {
      console.log('Using initial flow state');
    }

    hasLoadedPersistedDataRef.current = true;
  }, [flowDiagram, setNodes, setEdges]);

  // Load persisted viewport
  useEffect(() => {
    if (!reactFlowRef.current || hasLoadedPersistedDataRef.current) return;

    let loadedViewport = false;

    // First, try to load from Jazz database
    if (flowViewport) {
      const newViewport = {
        x: Number(flowViewport.x || 0),
        y: Number(flowViewport.y || 0),
        zoom: Number(flowViewport.zoom || 1),
      };
      setViewport(newViewport);
      reactFlowRef.current.setViewport(newViewport);
      loadedViewport = true;
      console.log('Loaded viewport from Jazz database');
    }

    // If no Jazz viewport, try localStorage as backup
    if (!loadedViewport) {
      try {
        const viewportData = localStorage.getItem(
          `${localStorageKeyRef.current}-viewport`,
        );
        if (viewportData) {
          const parsedData = JSON.parse(viewportData);
          if (parsedData.viewport) {
            setViewport(parsedData.viewport);
            reactFlowRef.current.setViewport(parsedData.viewport);
            loadedViewport = true;
            console.log('Loaded viewport from localStorage backup');
          }
        }
      } catch (error) {
        console.error('Error loading viewport from localStorage:', error);
      }
    }

    // If neither Jazz nor localStorage has viewport data, use default
    if (!loadedViewport) {
      console.log('Using default viewport');
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

  // Persist flow data to Jazz database and localStorage
  const persistFlowData = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      if (isInitialLoadRef.current) return;

      console.log('Persisting flow data:', {
        nodesCount: newNodes.length,
        edgesCount: newEdges.length,
        timestamp: Date.now(),
      });

      // Save to localStorage as backup
      try {
        const flowData = {
          nodes: newNodes,
          edges: newEdges,
          timestamp: Date.now(),
        };
        localStorage.setItem(
          localStorageKeyRef.current,
          JSON.stringify(flowData),
        );
      } catch (error) {
        console.error('Error saving to localStorage:', error);
      }

      // Sync to cursor feed for real-time collaboration
      syncFlowData(newNodes, newEdges, false);

      // TODO: Implement proper Jazz database persistence
      // For now, the cursor feed serves as the primary persistence mechanism
    },
    [syncFlowData],
  );

  // Persist viewport to Jazz database and localStorage
  const persistViewport = useCallback((newViewport: Viewport) => {
    if (isInitialLoadRef.current) return;

    // Save viewport to localStorage
    try {
      const viewportData = {
        viewport: newViewport,
        timestamp: Date.now(),
      };
      localStorage.setItem(
        `${localStorageKeyRef.current}-viewport`,
        JSON.stringify(viewportData),
      );
    } catch (error) {
      console.error('Error saving viewport to localStorage:', error);
    }

    // Update local state
    setViewport(newViewport);

    // TODO: Implement proper Jazz database persistence for viewport
  }, []);

  // Mark initial load as complete after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialLoadRef.current = false;
      console.log('Initial load complete, persistence enabled');
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Clear localStorage when component unmounts (optional cleanup)
  useEffect(() => {
    return () => {
      // Optionally clear old localStorage data on unmount
      // Uncomment the next line if you want to clear localStorage on unmount
      // localStorage.removeItem(localStorageKeyRef.current);
    };
  }, []);

  // Periodic cleanup of stale sessions
  useEffect(() => {
    if (!cursors) return;

    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 60000; // 1 minute for stale sessions

      // Log current session state for debugging
      const sessionCount = Object.keys(cursors.perSession || {}).length;
      console.log(`Current sessions: ${sessionCount}`);

      // Find stale sessions
      const staleSessions = Object.entries(cursors.perSession || {})
        .filter(([sessionID, entry]) => {
          const age = now - new Date(entry.madeAt).getTime();
          return age > staleThreshold;
        })
        .map(([sessionID, entry]) => ({
          sessionID,
          name: getName(entry.by?.profile?.name, entry.tx.sessionID),
          age: now - new Date(entry.madeAt).getTime(),
        }));

      if (staleSessions.length > 0) {
        console.log('Stale sessions detected:', staleSessions);
        // Note: In a real implementation, you would remove these from the cursor feed
        // For now, we just log them for debugging
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(cleanupInterval);
  }, [cursors]);

  // Function to get current flow data for sharing
  const getCurrentFlowData = useCallback(() => {
    return {
      nodes: nodesRef.current,
      edges: edgesRef.current,
      viewport: viewport,
      timestamp: Date.now(),
    };
  }, [viewport]);

  // Expose the function to parent component
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).getCurrentFlowData = getCurrentFlowData;

      // Add debugging info
      console.log('Canvas persistence setup:', {
        containerID,
        localStorageKey: localStorageKeyRef.current,
        hasLocalStorage: typeof localStorage !== 'undefined',
        isSafari:
          navigator.userAgent.includes('Safari') &&
          !navigator.userAgent.includes('Chrome'),
        isFirefox: navigator.userAgent.includes('Firefox'),
        isEdge:
          navigator.userAgent.includes('Edg') ||
          navigator.userAgent.includes('Edge'),
      });
    }
  }, [getCurrentFlowData, containerID]);

  // Listen for flow data changes from other users
  useEffect(() => {
    if (!cursors?.perSession || isInitialLoadRef.current) return;

    Object.values(cursors.perSession).forEach((entry) => {
      if (entry.value.flowData && entry.tx.sessionID !== me?.sessionID) {
        try {
          const {
            nodes: remoteNodesStr,
            edges: remoteEdgesStr,
            timestamp: remoteTimestamp,
          } = entry.value.flowData;
          if (remoteNodesStr && remoteEdgesStr) {
            const remoteNodes = JSON.parse(remoteNodesStr);
            const remoteEdges = JSON.parse(remoteEdgesStr);

            // Always sync if data is different (remove timestamp restriction)
            const currentNodesStr = JSON.stringify(nodesRef.current);
            const currentEdgesStr = JSON.stringify(edgesRef.current);

            if (remoteNodesStr !== currentNodesStr) {
              console.log('Syncing nodes from remote user');
              isReceivingUpdateRef.current = true;
              setNodes(remoteNodes);
              // Also update localStorage with remote data
              try {
                const flowData = {
                  nodes: remoteNodes,
                  edges: edgesRef.current,
                  timestamp: remoteTimestamp || Date.now(),
                };
                localStorage.setItem(
                  localStorageKeyRef.current,
                  JSON.stringify(flowData),
                );
              } catch (error) {
                console.error(
                  'Error updating localStorage with remote data:',
                  error,
                );
              }
              setTimeout(() => {
                isReceivingUpdateRef.current = false;
              }, 50);
            }
            if (remoteEdgesStr !== currentEdgesStr) {
              console.log('Syncing edges from remote user');
              isReceivingUpdateRef.current = true;
              setEdges(remoteEdges);
              // Also update localStorage with remote data
              try {
                const flowData = {
                  nodes: nodesRef.current,
                  edges: remoteEdges,
                  timestamp: remoteTimestamp || Date.now(),
                };
                localStorage.setItem(
                  localStorageKeyRef.current,
                  JSON.stringify(flowData),
                );
              } catch (error) {
                console.error(
                  'Error updating localStorage with remote data:',
                  error,
                );
              }
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

    const now = Date.now();
    const maxAgeMs = OLD_CURSOR_AGE_SECONDS * 1000;
    const ghostDetectionThreshold = 30000; // 30 seconds for ghost detection

    return Object.values(cursors.perSession)
      .map((entry) => {
        const age = now - new Date(entry.madeAt).getTime();
        const isActive = age <= maxAgeMs;
        const isGhost = age > ghostDetectionThreshold;

        return {
          entry,
          position: entry.value.position,
          color: getColor(entry.tx.sessionID),
          name: getName(entry.by?.profile?.name, entry.tx.sessionID),
          age,
          active: isActive,
          isGhost,
          isMe: entry.tx.sessionID === me?.sessionID,
          sessionID: entry.tx.sessionID,
          lastActivity: entry.madeAt,
        };
      })
      .filter((cursor) => {
        // Filter out ghosts and inactive cursors
        if (cursor.isGhost) {
          console.log(
            `Filtering out ghost cursor: ${cursor.name} (age: ${cursor.age}ms)`,
          );
          return false;
        }

        if (!cursor.active) {
          console.log(
            `Filtering out inactive cursor: ${cursor.name} (age: ${cursor.age}ms)`,
          );
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        return b.entry.madeAt.getTime() - a.entry.madeAt.getTime();
      });
  }, [cursors, me?.sessionID]);

  // Add debug function to clear ghost cursors
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).clearGhostCursors = () => {
        console.log('Manual ghost cursor cleanup triggered');
        console.log(
          'Current sessions:',
          Object.keys(cursors?.perSession || {}),
        );
        console.log('Active cursors:', remoteCursors.length);

        // Force a re-render by updating a dummy state
        // This will trigger the filtering logic again
        setViewport((prev) => ({ ...prev }));
      };

      // Add debug function to show ghost cursor details
      (window as any).showGhostCursors = () => {
        console.log('=== GHOST CURSOR DEBUG ===');
        console.log('All sessions:', Object.keys(cursors?.perSession || {}));
        console.log('Active cursors:', remoteCursors.length);

        // Show details of each cursor
        remoteCursors.forEach((cursor, index) => {
          console.log(`Cursor ${index + 1}:`, {
            name: cursor.name,
            sessionID: cursor.sessionID,
            age: cursor.age,
            active: cursor.active,
            isGhost: cursor.isGhost,
            lastActivity: cursor.lastActivity,
          });
        });

        // Show all sessions with their ages
        Object.entries(cursors?.perSession || {}).forEach(
          ([sessionID, entry]) => {
            const age = Date.now() - new Date(entry.madeAt).getTime();
            const name = getName(entry.by?.profile?.name, entry.tx.sessionID);
            console.log(`Session ${sessionID}:`, {
              name,
              age: `${Math.round(age / 1000)}s`,
              isActive: age <= OLD_CURSOR_AGE_SECONDS * 1000,
              isGhost: age > 30000,
            });
          },
        );
        console.log('=== END GHOST CURSOR DEBUG ===');
      };

      // Add debug function to force synchronization
      (window as any).forceSync = () => {
        console.log('=== FORCE SYNC DEBUG ===');
        console.log('Current nodes:', nodesRef.current);
        console.log('Current edges:', edgesRef.current);
        console.log('Current viewport:', viewport);

        // Force sync current state to all other users
        if (cursors) {
          const flowData = {
            nodes: nodesRef.current,
            edges: edgesRef.current,
            timestamp: Date.now(),
          };
          cursors.push({
            position: { x: 0, y: 0 }, // Dummy position
            flowData: {
              nodes: JSON.stringify(flowData.nodes),
              edges: JSON.stringify(flowData.edges),
              timestamp: flowData.timestamp,
            },
          });
          console.log('Forced sync sent to cursor feed');
        }
        console.log('=== END FORCE SYNC DEBUG ===');
      };

      // Add debug function to clear localStorage and force fresh start
      (window as any).clearAndResync = () => {
        console.log('=== CLEAR AND RESYNC DEBUG ===');

        // Clear localStorage
        try {
          localStorage.removeItem(localStorageKeyRef.current);
          localStorage.removeItem(`${localStorageKeyRef.current}-viewport`);
          console.log('Cleared localStorage');
        } catch (error) {
          console.error('Error clearing localStorage:', error);
        }

        // Reset the loaded flag to force reload from Jazz database
        hasLoadedPersistedDataRef.current = false;
        isInitialLoadRef.current = true;

        // Force a re-render
        setViewport((prev) => ({ ...prev }));

        console.log(
          'Reset flags, will reload from Jazz database on next render',
        );
        console.log('=== END CLEAR AND RESYNC DEBUG ===');
      };

      // Add debug function to test panning and selection
      (window as any).testPanning = () => {
        console.log('=== TEST PANNING DEBUG ===');
        console.log('Current viewport:', viewport);
        console.log('Is panning:', isPanning);
        console.log('Last touch distance:', lastTouchDistance);
        console.log('Last touch center:', lastTouchCenter);
        console.log('=== END TEST PANNING DEBUG ===');
      };

      // Add debug function to test selection
      (window as any).testSelection = () => {
        console.log('=== TEST SELECTION DEBUG ===');
        console.log('Selected nodes:', selectedNodes);
        console.log('Selection box:', selectionBox);
        console.log('Is marquee selecting:', isMarqueeSelecting);
        console.log(
          'All nodes:',
          nodes.map((n) => ({ id: n.id, position: n.position })),
        );
        console.log('=== END TEST SELECTION DEBUG ===');
      };
    }
  }, [cursors, remoteCursors]);

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

  // Convert screen coordinates to flow coordinates
  const convertScreenToFlow = useCallback(
    (screenPosition: { x: number; y: number }) => {
      if (!reactFlowRef.current) return screenPosition;

      const flowPosition =
        reactFlowRef.current.screenToFlowPosition(screenPosition);
      return flowPosition;
    },
    [],
  );

  // Enhanced selection detection using flow coordinates and React Flow's selection system
  const getNodesInSelectionBox = useCallback(
    (boxStart: { x: number; y: number }, boxEnd: { x: number; y: number }) => {
      if (!reactFlowRef.current) return [];

      // Convert screen coordinates to flow coordinates
      const flowStart = convertScreenToFlow(boxStart);
      const flowEnd = convertScreenToFlow(boxEnd);

      const boxLeft = Math.min(flowStart.x, flowEnd.x);
      const boxRight = Math.max(flowStart.x, flowEnd.x);
      const boxTop = Math.min(flowStart.y, flowEnd.y);
      const boxBottom = Math.max(flowStart.y, flowEnd.y);

      return nodes.filter((node) => {
        // Get the actual node element to determine its real dimensions
        const nodeElement = document.querySelector(
          `[data-id="${node.id}"]`,
        ) as HTMLElement;

        if (nodeElement) {
          // Use actual node dimensions if available
          const nodeRect = nodeElement.getBoundingClientRect();
          const nodeFlowRect = reactFlowRef.current!.screenToFlowPosition({
            x: nodeRect.left,
            y: nodeRect.top,
          });
          const nodeFlowBottomRight =
            reactFlowRef.current!.screenToFlowPosition({
              x: nodeRect.right,
              y: nodeRect.bottom,
            });

          const nodeLeft = nodeFlowRect.x;
          const nodeRight = nodeFlowBottomRight.x;
          const nodeTop = nodeFlowRect.y;
          const nodeBottom = nodeFlowBottomRight.y;

          return (
            nodeLeft < boxRight &&
            nodeRight > boxLeft &&
            nodeTop < boxBottom &&
            nodeBottom > boxTop
          );
        } else {
          // Fallback to approximate dimensions
          const nodeLeft = node.position.x;
          const nodeRight = node.position.x + 120; // Slightly larger approximation
          const nodeTop = node.position.y;
          const nodeBottom = node.position.y + 60; // Slightly larger approximation

          return (
            nodeLeft < boxRight &&
            nodeRight > boxLeft &&
            nodeTop < boxBottom &&
            nodeBottom > boxTop
          );
        }
      });
    },
    [nodes, convertScreenToFlow],
  );

  // Gesture control functions
  const calculateTouchDistance = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2),
    );
  }, []);

  const calculateTouchCenter = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  }, []);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (event.touches.length === 2) {
        // Two finger gesture - pan or zoom
        const distance = calculateTouchDistance(event.touches);
        const center = calculateTouchCenter(event.touches);

        setLastTouchDistance(distance);
        setLastTouchCenter(center);
        setIsPanning(true);
        event.preventDefault(); // Prevent default to avoid conflicts
        event.stopPropagation(); // Stop event propagation
      } else if (event.touches.length === 1) {
        // Single finger - potential marquee selection
        const touch = event.touches[0];
        const target = event.target as HTMLElement;

        // Only start marquee selection if not clicking on a node
        if (!target.closest('.react-flow__node')) {
          setSelectionBox({
            start: { x: touch.clientX, y: touch.clientY },
            end: { x: touch.clientX, y: touch.clientY },
            isSelecting: true,
          });
          setIsMarqueeSelecting(true);
        }
      }
    },
    [calculateTouchDistance, calculateTouchCenter],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (event.touches.length === 2 && lastTouchDistance && lastTouchCenter) {
        // Two finger gesture
        event.preventDefault(); // Prevent default to avoid conflicts
        event.stopPropagation(); // Stop event propagation
        const currentDistance = calculateTouchDistance(event.touches);
        const currentCenter = calculateTouchCenter(event.touches);

        if (currentDistance && currentCenter) {
          // Calculate zoom
          const zoomDelta = currentDistance / lastTouchDistance;
          const newZoom = Math.max(0.1, Math.min(2, viewport.zoom * zoomDelta));

          // Calculate pan
          const deltaX = currentCenter.x - lastTouchCenter.x;
          const deltaY = currentCenter.y - lastTouchCenter.y;

          reactFlowRef.current?.setViewport({
            ...viewport,
            x: viewport.x - deltaX / viewport.zoom,
            y: viewport.y - deltaY / viewport.zoom,
            zoom: newZoom,
          });

          setLastTouchDistance(currentDistance);
          setLastTouchCenter(currentCenter);
        }
      } else if (event.touches.length === 1 && selectionBox) {
        // Single finger marquee selection
        event.preventDefault(); // Prevent default to avoid conflicts
        const touch = event.touches[0];
        setSelectionBox((prev) =>
          prev
            ? {
                ...prev,
                end: { x: touch.clientX, y: touch.clientY },
              }
            : null,
        );
      }
    },
    [
      lastTouchDistance,
      lastTouchCenter,
      viewport.zoom,
      selectionBox,
      calculateTouchDistance,
      calculateTouchCenter,
    ],
  );

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    setLastTouchDistance(null);
    setLastTouchCenter(null);

    if (selectionBox && isMarqueeSelecting) {
      // Finalize marquee selection using better detection
      const selectedNodes = getNodesInSelectionBox(
        selectionBox.start,
        selectionBox.end,
      );
      const selectedNodeIds = selectedNodes.map((node) => node.id);

      console.log('Marquee selection completed:', selectedNodeIds);
      setSelectedNodes(selectedNodeIds);
      setSelectionBox(null);
      setIsMarqueeSelecting(false);
    }
  }, [selectionBox, isMarqueeSelecting, getNodesInSelectionBox]);

  // Enhanced keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case 'a':
            event.preventDefault();
            setSelectedNodes(nodes.map((node) => node.id));
            console.log(`Selected all ${nodes.length} nodes`);
            break;
          case 'c':
            event.preventDefault();
            // TODO: Implement copy functionality
            console.log('Copy functionality not yet implemented');
            break;
          case 'v':
            event.preventDefault();
            // TODO: Implement paste functionality
            console.log('Paste functionality not yet implemented');
            break;
          case 'z':
            event.preventDefault();
            // TODO: Implement undo functionality
            console.log('Undo functionality not yet implemented');
            break;
          case 'd':
            event.preventDefault();
            // Deselect all
            setSelectedNodes([]);
            console.log('Deselected all nodes');
            break;
        }
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        if (selectedNodes.length > 0) {
          // Remove selected nodes
          setNodes((prev) =>
            prev.filter((node) => !selectedNodes.includes(node.id)),
          );
          setEdges((prev) =>
            prev.filter(
              (edge) =>
                !selectedNodes.includes(edge.source) &&
                !selectedNodes.includes(edge.target),
            ),
          );
          console.log(`Deleted ${selectedNodes.length} selected node(s)`);
          setSelectedNodes([]);
        }
      } else if (event.key === 'Escape') {
        // Clear selection
        setSelectedNodes([]);
        setSelectionBox(null);
        setIsMarqueeSelecting(false);
        console.log('Cleared selection');
      } else if (event.key === ' ') {
        // Space key - enable panning mode (design tool behavior)
        event.preventDefault();
        document.body.style.cursor = 'grab';
        console.log('Space pressed - panning mode enabled');
      } else if (
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight'
      ) {
        // Move selected nodes with arrow keys
        if (selectedNodes.length > 0) {
          event.preventDefault();
          const moveDistance = event.shiftKey ? 10 : 1; // Shift for larger moves
          let deltaX = 0;
          let deltaY = 0;

          switch (event.key) {
            case 'ArrowUp':
              deltaY = -moveDistance;
              break;
            case 'ArrowDown':
              deltaY = moveDistance;
              break;
            case 'ArrowLeft':
              deltaX = -moveDistance;
              break;
            case 'ArrowRight':
              deltaX = moveDistance;
              break;
          }

          setNodes((prev) =>
            prev.map((node) =>
              selectedNodes.includes(node.id)
                ? {
                    ...node,
                    position: {
                      x: node.position.x + deltaX,
                      y: node.position.y + deltaY,
                    },
                  }
                : node,
            ),
          );
        }
      }
    },
    [selectedNodes, nodes, setNodes, setEdges],
  );

  // Design tool viewport controls with React Flow integration
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    // Only start marquee selection if clicking on empty space
    const target = event.target as HTMLElement;

    // Check if clicking on a node or control
    if (
      target &&
      (target.closest('.react-flow__node') ||
        target.closest('.react-flow__controls') ||
        target.closest('.react-flow__minimap') ||
        target.closest('.react-flow__panel'))
    ) {
      // Clicking on a node or control - let ReactFlow handle it
      return;
    }

    if (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey
    ) {
      // Left click without modifier keys on empty space - start marquee selection
      // React Flow's built-in selectionOnDrag will handle most of this
      setSelectionBox({
        start: { x: event.clientX, y: event.clientY },
        end: { x: event.clientX, y: event.clientY },
        isSelecting: true,
      });
      setIsMarqueeSelecting(true);
      event.preventDefault();
      event.stopPropagation();
    } else if (event.button === 1 || event.button === 2 || event.shiftKey) {
      // Middle/right mouse button or shift + left click - start panning
      setIsPanning(true);
      event.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (selectionBox && isMarqueeSelecting) {
        setSelectionBox((prev) =>
          prev
            ? {
                ...prev,
                end: { x: event.clientX, y: event.clientY },
              }
            : null,
        );

        // Real-time selection preview (optional - can be removed if too performance heavy)
        // const selectedNodes = getNodesInSelectionBox(
        //   selectionBox.start,
        //   { x: event.clientX, y: event.clientY }
        // );
        // console.log('Selection preview:', selectedNodes.map(n => n.id));
      }
    },
    [selectionBox, isMarqueeSelecting],
  );

  const handleMouseUp = useCallback(() => {
    if (selectionBox && isMarqueeSelecting) {
      // Finalize marquee selection for mouse using better detection
      const selectedNodes = getNodesInSelectionBox(
        selectionBox.start,
        selectionBox.end,
      );
      const selectedNodeIds = selectedNodes.map((node) => node.id);

      console.log('Mouse marquee selection completed:', selectedNodeIds);

      // Update selected nodes state
      setSelectedNodes(selectedNodeIds);

      // Clear selection box
      setSelectionBox(null);
      setIsMarqueeSelecting(false);

      // Provide user feedback
      if (selectedNodeIds.length > 0) {
        console.log(
          `Selected ${selectedNodeIds.length} node(s):`,
          selectedNodeIds,
        );
      } else {
        console.log('No nodes selected in marquee area');
      }
    }

    // Stop panning
    setIsPanning(false);
  }, [selectionBox, isMarqueeSelecting, getNodesInSelectionBox]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', (event) => {
      if (event.key === ' ') {
        // Reset cursor when space is released
        document.body.style.cursor = 'default';
        console.log('Space released - panning mode disabled');
      }
    });
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', (event) => {
        if (event.key === ' ') {
          document.body.style.cursor = 'default';
        }
      });
    };
  }, [handleKeyDown]);

  // Global mouse event listeners for panning
  useEffect(() => {
    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (isPanning && reactFlowRef.current) {
        const deltaX = event.movementX;
        const deltaY = event.movementY;

        reactFlowRef.current.setViewport({
          ...viewport,
          x: viewport.x - deltaX / viewport.zoom,
          y: viewport.y - deltaY / viewport.zoom,
        });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsPanning(false);
    };

    if (isPanning) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning]);

  // Enhanced selection change handling with React Flow integration
  useOnSelectionChange({
    onChange: ({ nodes }) => {
      const selectedIds = nodes.map((node: Node) => node.id);
      setSelectedNodes(selectedIds);

      // Provide detailed feedback about selection changes
      if (selectedIds.length > 0) {
        console.log(
          `ReactFlow selection changed: ${selectedIds.length} node(s) selected:`,
          selectedIds,
        );
      } else {
        console.log('ReactFlow selection cleared');
      }

      // Clear our custom selection box when React Flow handles selection
      if (selectedIds.length === 0 && selectionBox) {
        setSelectionBox(null);
        setIsMarqueeSelecting(false);
      }
    },
  });

  // Proper viewport change handling
  useOnViewportChange({
    onChange: (viewport) => {
      console.log('Viewport changed:', viewport);
    },
  });

  return (
    <div
      style={{ width: '100vw', height: '100vh' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
        // Design tool viewport controls (Figma-like) per React Flow docs:
        panOnScroll={true} // Enable panning with scroll (trackpad swipe, mouse wheel)
        panOnScrollMode={PanOnScrollMode.Free} // Allow panning in all directions
        panOnDrag={false} // Disable panning with pointer drag (design tool behavior)
        selectionOnDrag={true} // Enable marquee selection by dragging empty space
        selectionMode={SelectionMode.Partial} // Allow partial selection for marquee
        zoomOnScroll={true} // Enable zooming with scroll (when modifier key is pressed)
        zoomOnPinch={true} // Enable pinch-to-zoom on trackpads/touch
        zoomOnDoubleClick={false} // Disable double-click zoom (Figma disables this)
        preventScrolling={true} // Prevent page scrolling when over the flow
        // Enhanced selection behavior
        onSelectionDrag={(event, nodes) => {
          // Handle selection drag events for better performance
          console.log(
            `Dragging ${nodes.length} selected nodes:`,
            nodes.map((n) => n.id),
          );

          // Update cursor style during drag
          const target = event.target as HTMLElement;
          if (target) {
            target.style.cursor = 'grabbing';
          }
        }}
        onSelectionDragStop={(event, nodes) => {
          // Reset cursor when selection drag ends
          const target = event.target as HTMLElement;
          if (target) {
            target.style.cursor = 'default';
          }
          console.log(`Finished dragging ${nodes.length} selected nodes`);
        }}
        // Optionally, you can customize the zoom activation key if you want Cmd/Ctrl+Scroll only:
        // zoomActivationKeyCode="Meta" // Default is 'Meta' (Cmd on Mac, Ctrl on Win)
      >
        <Background />
        <Controls />
        <MiniMap />

        {/* Selection info panel */}
        <Panel position="top-left">
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            {selectedNodes.length > 0 ? (
              <span>
                {selectedNodes.length} node
                {selectedNodes.length !== 1 ? 's' : ''} selected
              </span>
            ) : (
              <span>No selection</span>
            )}
          </div>
        </Panel>

        {/* Help panel */}
        {/* <Panel position="top-right">
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '12px',
              borderRadius: '4px',
              fontSize: '11px',
              maxWidth: '200px',
            }}
          >
            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
              Design Tool Controls:
            </div>
            <div>• Scroll: Pan canvas</div>
            <div>• Middle/Right mouse: Pan</div>
            <div>• Space + drag: Pan</div>
            <div>• Cmd+Scroll: Zoom</div>
            <div>• Two-finger pinch: Zoom</div>
            <div>• Click: Select node</div>
            <div>• Drag empty space: Marquee select</div>
            <div>• Drag selected nodes: Move multiple</div>
            <div>• Cmd+A: Select all</div>
            <div>• Cmd+D: Deselect all</div>
            <div>• Arrow keys: Move selected</div>
            <div>• Shift+Arrow: Move faster</div>
            <div>• Delete: Remove selected</div>
            <div>• Escape: Clear selection</div>
          </div>
        </Panel> */}
      </ReactFlow>

      {/* Enhanced marquee selection overlay */}
      {selectionBox && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <svg
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          >
            <rect
              x={Math.min(selectionBox.start.x, selectionBox.end.x)}
              y={Math.min(selectionBox.start.y, selectionBox.end.y)}
              width={Math.abs(selectionBox.end.x - selectionBox.start.x)}
              height={Math.abs(selectionBox.end.y - selectionBox.start.y)}
              fill="rgba(0, 123, 255, 0.08)"
              stroke="rgba(0, 123, 255, 0.9)"
              strokeWidth="2"
              strokeDasharray="6,6"
              rx="2"
              ry="2"
            />
            {/* Selection count indicator */}
            {Math.abs(selectionBox.end.x - selectionBox.start.x) > 10 &&
              Math.abs(selectionBox.end.y - selectionBox.start.y) > 10 && (
                <text
                  x={Math.min(selectionBox.start.x, selectionBox.end.x) + 10}
                  y={Math.min(selectionBox.start.y, selectionBox.end.y) - 10}
                  fill="rgba(0, 123, 255, 0.9)"
                  fontSize="12"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  {
                    getNodesInSelectionBox(selectionBox.start, selectionBox.end)
                      .length
                  }{' '}
                  selected
                </text>
              )}
          </svg>
        </div>
      )}

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
              isGhost={cursor.isGhost}
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

export function CollaborativeFlowCanvas({
  cursorFeedID,
  containerID,
}: CollaborativeFlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner cursorFeedID={cursorFeedID} containerID={containerID} />
    </ReactFlowProvider>
  );
}

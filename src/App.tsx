import { useAccount } from 'jazz-tools/react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Logo } from './Logo';
import FlowContainer from './components/FlowContainer';
import { getName } from './utils/getName';
import {
  loadSharedCursorContainer,
  clearSessionConflicts,
  forceFreshSession,
  RoomSharing,
  resetSessionConflictTracking,
} from './utils/loadCursorContainer';

const groupIDToLoad = import.meta.env.VITE_GROUP_ID;

function App() {
  const { me } = useAccount();

  // Add debugging for Edge
  useEffect(() => {
    console.log('App mounted, me state:', {
      meId: me?.id,
      meProfile: me?.profile,
      meSessionID: me?.sessionID,
      isEdge:
        navigator.userAgent.includes('Edg') ||
        navigator.userAgent.includes('Edge'),
    });
  }, [me]);

  const [loaded, setLoaded] = useState(false);
  const [cursorFeedID, setCursorFeedID] = useState<string | null>(null);
  const [containerID, setContainerID] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const loadingRef = useRef(false);

  const loadCursorFeed = useCallback(async () => {
    console.log('loadCursorFeed called, me state:', {
      me: me,
      meId: me?.id,
      meProfile: me?.profile,
      hasMe: !!me,
      loadingRef: loadingRef.current,
    });

    if (!me?.id || loadingRef.current) {
      console.log('loadCursorFeed early return - no me.id or already loading');
      return;
    }

    loadingRef.current = true;
    try {
      setError(null);
      console.log('About to call loadSharedCursorContainer with:', {
        meId: me?.id,
        groupIDToLoad,
        hasGroupID: !!groupIDToLoad,
      });
      const result = await loadSharedCursorContainer(me, groupIDToLoad);
      if (result) {
        setCursorFeedID(result.cursorFeedID);
        setContainerID(result.containerID);
        setGroupId(result.groupId);
        setRoomId(result.roomId);
        setLoaded(true);
        // Reset session conflict tracking on successful load
        resetSessionConflictTracking();
      } else {
        setError('Failed to load shared cursor container');
      }
    } catch (err) {
      console.error('Error loading shared cursor container:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      loadingRef.current = false;
    }
  }, [me?.id]);

  useEffect(() => {
    loadCursorFeed();

    // Add timeout for Edge in case it takes too long to initialize
    const isEdge =
      navigator.userAgent.includes('Edg') ||
      navigator.userAgent.includes('Edge');
    if (isEdge) {
      const timeout = setTimeout(() => {
        console.log('Edge timeout reached, checking me state again...');
        if (!me?.id) {
          console.error('Edge: me.id still not available after timeout');
          setError('Edge: Account initialization timeout');
        }
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [loadCursorFeed, me?.id]);

  const handleReset = () => {
    if (
      confirm('This will clear all session data and reload the page. Continue?')
    ) {
      clearSessionConflicts();
    }
  };

  const handleFreshSession = () => {
    if (
      confirm(
        'This will clear all session data and start with a fresh session. Continue?',
      )
    ) {
      forceFreshSession();
    }
  };

  const handleShare = async () => {
    const roomSharing = RoomSharing.getInstance();
    await roomSharing.copyShareableLink();
    alert('Shareable link copied to clipboard!');
  };

  const handleNewRoom = () => {
    const roomSharing = RoomSharing.getInstance();
    const newRoomId = roomSharing.generateRoomId();
    roomSharing.updateRoomURL(newRoomId);
    window.location.reload();
  };

  return (
    <>
      <main className="h-screen">
        {loaded && cursorFeedID && containerID && groupId ? (
          <FlowContainer
            cursorFeedID={cursorFeedID}
            containerID={containerID}
            groupId={groupId}
          />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="text-red-600">Error: {error}</div>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Reset Session
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div>Loading...</div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-4 right-4 flex items-center gap-4">
        <input
          type="text"
          value={getName(me?.profile?.name, me?.sessionID)}
          onChange={(e) => {
            if (!me?.profile) return;
            me.profile.name = e.target.value;
          }}
          placeholder="Your name"
          className="px-2 py-1 rounded border pointer-events-auto"
          autoComplete="off"
          maxLength={32}
        />

        {/* Room Info */}
        {roomId && (
          <div className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
            Room: {roomId.slice(-8)}
          </div>
        )}

        <button
          onClick={handleShare}
          className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
          title="Copy shareable link"
        >
          Share
        </button>

        <button
          onClick={handleNewRoom}
          className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
          title="Create new room"
        >
          New Room
        </button>

        <button
          onClick={handleReset}
          className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs"
          title="Reset session data"
        >
          Reset
        </button>

        <button
          onClick={handleFreshSession}
          className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-xs"
          title="Start a fresh session"
        >
          Fresh
        </button>

        <div className="pointer-events-none">
          <Logo />
        </div>
      </footer>
    </>
  );
}

export default App;

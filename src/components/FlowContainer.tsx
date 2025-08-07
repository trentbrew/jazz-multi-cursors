import { useAccount, useCoState } from 'jazz-tools/react';
import { useState } from 'react';
import { CursorFeed } from '../schema';
import { getColor } from '../utils/getColor';
import { getName } from '../utils/getName';
import { generateShareURL, sendFlowData } from '../utils/loadCursorContainer';
import Container from './Container';
import { FlowCanvas } from './FlowCanvas';
import { CollaborativeFlowCanvas } from './CollaborativeFlowCanvas';

const OLD_CURSOR_AGE_SECONDS = Number(
  import.meta.env.VITE_OLD_CURSOR_AGE_SECONDS,
);

function Avatar({
  name,
  color,
  active,
}: {
  name: string;
  color: string;
  active: boolean;
}) {
  return (
    <span
      title={name}
      className={[
        'size-6 text-xs font-medium uppercase bg-white inline-flex items-center justify-center rounded-full border-2',
        active ? '' : 'opacity-50',
      ].join(' ')}
      style={{ color, borderColor: color }}
    >
      {name.replace('Anonymous ', '')[0]}
    </span>
  );
}

type Mode = 'canvas' | 'flow' | 'collaborative-flow';

/** A higher order component that wraps the canvas with a toggle between modes. */
function FlowContainer({
  cursorFeedID,
  containerID,
  groupId,
}: {
  cursorFeedID: string;
  containerID: string;
  groupId: string;
}) {
  const { me } = useAccount();
  const cursors = useCoState(CursorFeed, cursorFeedID, { resolve: true });
  const [mode, setMode] = useState<Mode>('collaborative-flow');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareURL, setShareURL] = useState<string>('');
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);

  const remoteCursors = Object.values(cursors?.perSession ?? {})
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

  const getNextMode = (currentMode: Mode): Mode => {
    switch (currentMode) {
      case 'canvas':
        return 'flow';
      case 'flow':
        return 'collaborative-flow';
      case 'collaborative-flow':
        return 'canvas';
    }
  };

  const getModeLabel = (mode: Mode): string => {
    switch (mode) {
      case 'canvas':
        return 'Canvas';
      case 'flow':
        return 'Flow';
      case 'collaborative-flow':
        return 'Collaborative Flow';
    }
  };

  const generateShare = async () => {
    if (!me) return;

    setIsGeneratingShare(true);
    try {
      // Get current flow data from the canvas
      const flowData = (window as any).getCurrentFlowData?.() || {
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        timestamp: Date.now(),
      };

      // Send flow data through inbox
      const inboxId = await sendFlowData(me, flowData);

      // Generate share URL with inbox ID
      const url = generateShareURL(groupId, cursorFeedID, inboxId || undefined);
      setShareURL(url);
    } catch (error) {
      console.error('Failed to generate share URL:', error);
      // Fallback to basic share URL
      const url = generateShareURL(groupId, cursorFeedID);
      setShareURL(url);
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareURL);
      alert('Share URL copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  return (
    <>
      {/* Mode Toggle */}
      <div className="absolute top-4 left-4 bg-white p-2 rounded-lg shadow z-10">
        <button
          onClick={() => setMode(getNextMode(mode))}
          className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
        >
          Switch to {getModeLabel(getNextMode(mode))}
        </button>
        <div className="text-xs text-gray-600 mt-1">
          Current: {getModeLabel(mode)}
        </div>
      </div>

      {/* Share Button */}
      <div className="absolute top-4 left-64 bg-white p-2 rounded-lg shadow z-10">
        <button
          onClick={() => {
            setShowShareModal(true);
            generateShare();
          }}
          className="px-3 py-1 rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
          disabled={isGeneratingShare}
        >
          {isGeneratingShare ? 'Generating...' : 'Share'}
        </button>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Share Your Flow</h3>
            <p className="text-sm text-gray-600 mb-4">
              Send this URL to others to collaborate in real-time:
            </p>
            <div className="bg-gray-100 p-3 rounded text-sm font-mono break-all mb-4">
              {shareURL || 'Generating share URL...'}
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={!shareURL}
              >
                Copy URL
              </button>
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Avatars */}
      <div className="absolute top-4 right-4 bg-white p-2 rounded-lg shadow">
        <div className="flex items-center gap-1">
          {remoteCursors.slice(0, 5).map(({ name, color, entry, active }) => (
            <Avatar
              key={entry.tx.sessionID}
              name={name}
              color={color}
              active={active}
            />
          ))}
        </div>
      </div>

      {/* Canvas or Flow */}
      {mode === 'canvas' && <Container cursorFeedID={cursorFeedID} />}
      {mode === 'flow' && <FlowCanvas cursorFeedID={cursorFeedID} />}
      {mode === 'collaborative-flow' && (
        <CollaborativeFlowCanvas
          cursorFeedID={cursorFeedID}
          containerID={containerID}
        />
      )}
    </>
  );
}

export default FlowContainer;

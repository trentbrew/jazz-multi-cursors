import { useAccount, useCoState } from 'jazz-tools/react';
import { useState } from 'react';
import { CursorFeed } from '../schema';
import { getColor } from '../utils/getColor';
import { getName } from '../utils/getName';
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
function FlowContainer({ cursorFeedID }: { cursorFeedID: string }) {
  const { me } = useAccount();
  const cursors = useCoState(CursorFeed, cursorFeedID, { resolve: true });
  const [mode, setMode] = useState<Mode>('collaborative-flow');

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
        <CollaborativeFlowCanvas cursorFeedID={cursorFeedID} />
      )}
    </>
  );
}

export default FlowContainer;

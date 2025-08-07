import { Account, Group, type ID } from 'jazz-tools';
import {
  CursorContainer,
  CursorFeed,
  FlowDiagram,
  FlowViewport,
} from '../schema';

/**
 * Excalidraw-style room-based sharing system
 */
export class RoomSharing {
  private static instance: RoomSharing;
  private currentRoomId: string | null = null;
  private currentContainer: any | null = null;
  private urlUpdated = false;

  static getInstance(): RoomSharing {
    if (!RoomSharing.instance) {
      RoomSharing.instance = new RoomSharing();
    }
    return RoomSharing.instance;
  }

  /**
   * Generate a room ID for sharing
   */
  generateRoomId(): string {
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get room ID from URL or generate new one
   */
  getRoomId(): string {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');

    if (roomId) {
      this.currentRoomId = roomId;
      return roomId;
    }

    // Only generate new room ID and update URL if we haven't already
    if (!this.urlUpdated) {
      const newRoomId = this.generateRoomId();
      this.currentRoomId = newRoomId;
      this.updateRoomURL(newRoomId);
      this.urlUpdated = true;
      return newRoomId;
    }

    return this.currentRoomId || this.generateRoomId();
  }

  /**
   * Update URL with room ID
   */
  updateRoomURL(roomId: string) {
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    params.set('room', roomId);
    const shareURL = `${baseUrl}?${params.toString()}`;
    window.history.replaceState({}, '', shareURL);
    console.log('Updated room URL:', shareURL);
  }

  /**
   * Get shareable link for the current room
   */
  getShareableLink(): string {
    const roomId = this.getRoomId();
    return `${window.location.origin}${window.location.pathname}?room=${roomId}`;
  }

  /**
   * Copy shareable link to clipboard
   */
  async copyShareableLink(): Promise<void> {
    const link = this.getShareableLink();
    try {
      await navigator.clipboard.writeText(link);
      console.log('Shareable link copied to clipboard:', link);
    } catch (error) {
      console.error('Failed to copy link:', error);
      // Fallback for browsers that don't support clipboard API
      prompt('Copy this link:', link);
    }
  }
}

/**
 * Force a fresh session by clearing URL parameters and session data
 */
export function forceFreshSession() {
  console.log('Forcing fresh session...');

  // Clear all session data
  clearSessionConflicts();

  // Clear URL parameters to start fresh
  window.history.replaceState({}, '', window.location.pathname);
}

/**
 * Clear session conflicts by clearing local storage and reloading
 */
export function clearSessionConflicts() {
  console.log('Clearing session conflicts...');

  // Clear any stored session data
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key &&
      (key.includes('jazz') ||
        key.includes('session') ||
        key.includes('cursor'))
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => {
    localStorage.removeItem(key);
  });

  // Also clear sessionStorage
  sessionStorage.clear();

  // Clear any cookies that might be related
  document.cookie.split(';').forEach(function (c) {
    document.cookie = c
      .replace(/^ +/, '')
      .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
  });

  console.log('Cleared session data, reloading page...');
  window.location.reload();
}

/**
 * Creates a new group to own the cursor container.
 * @param me - The account of the current user.
 * @returns The group.
 */
function createGroup(me: Account) {
  const group = Group.create({
    owner: me,
  });
  group.addMember('everyone', 'writer');
  console.log('Created group');
  console.log(`Add "VITE_GROUP_ID=${group.id}" to your .env file`);
  return group;
}

export async function loadGroup(me: Account, groupID: ID<Group>) {
  if (groupID === undefined) {
    console.log('No group ID found in .env, creating group...');
    return createGroup(me);
  }

  try {
    const group = await Group.load(groupID, {});
    if (group === null || group === undefined) {
      console.log('Group not found, creating group...');
      return createGroup(me);
    }
    console.log('Group loaded successfully:', group.id);
    return group;
  } catch (error) {
    console.error('Error loading group:', error);
    console.log('Creating new group due to error...');
    return createGroup(me);
  }
}

/**
 * Get URL parameters for sharing
 */
function getURLParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const params = {
    groupId: urlParams.get('group'),
    cursorFeedId: urlParams.get('feed'),
    inboxId: urlParams.get('inbox'),
  };
  console.log('Extracted URL params:', params);
  return params;
}

/**
 * Generate a fresh share URL that avoids session conflicts
 */
export function generateFreshShareURL(groupId: string) {
  const baseUrl = window.location.origin + window.location.pathname;
  const params = new URLSearchParams();
  params.set('group', groupId);
  params.set('feed', `cursor-feed-${Date.now()}`);
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate shareable URL
 */
export function generateShareURL(
  groupId: string,
  cursorFeedId: string,
  inboxId?: string,
) {
  const baseUrl = window.location.origin + window.location.pathname;
  const params = new URLSearchParams();
  params.set('group', groupId);
  params.set('feed', cursorFeedId);
  if (inboxId) {
    params.set('inbox', inboxId);
  }
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Send flow data through inbox for sharing
 */
export async function sendFlowData(_me: Account, flowData: any) {
  try {
    // For now, we'll use a simple approach that stores the data in the cursor feed
    // This is a temporary solution until the inbox API is available
    console.log('Flow data prepared for sharing:', flowData);

    // In a real implementation, this would send through the inbox
    // For now, we'll return a timestamp-based ID
    const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('Share ID generated:', shareId);
    return shareId;
  } catch (error) {
    console.error('Failed to send flow data:', error);
    return null;
  }
}

/**
 * Receive flow data from inbox
 */
export async function receiveFlowData(_me: Account, inboxId: string) {
  try {
    // For now, we'll use a simple approach that retrieves data from the cursor feed
    // This is a temporary solution until the inbox API is available
    console.log('Attempting to receive flow data with ID:', inboxId);

    // In a real implementation, this would retrieve from the inbox
    // For now, we'll return null to indicate no data available
    return null;
  } catch (error) {
    console.error('Failed to receive flow data:', error);
  }
  return null;
}

/**
 * Synchronize container IDs between browsers by ensuring they use the same feed ID
 */
function synchronizeContainerIds(groupId: string, cursorFeedId: string) {
  const urlParams = new URLSearchParams(window.location.search);
  const urlFeedId = urlParams.get('feed');

  // If the URL has a different feed ID than what we're using, update our URL
  if (urlFeedId && urlFeedId !== cursorFeedId) {
    console.log('Synchronizing container IDs - URL has different feed ID');
    const shareURL = generateShareURL(groupId, urlFeedId);
    window.history.replaceState({}, '', shareURL);
    return urlFeedId;
  }

  return cursorFeedId;
}

/**
 * Debug function to log sharing information
 */
function debugSharingInfo(
  groupId: string,
  cursorFeedId: string,
  containerId: string,
) {
  console.log('=== SHARING DEBUG INFO ===');
  console.log('Group ID:', groupId);
  console.log('Cursor Feed ID:', cursorFeedId);
  console.log('Container ID:', containerId);
  console.log('Current URL:', window.location.href);
  console.log(
    'URL Parameters:',
    Object.fromEntries(new URLSearchParams(window.location.search)),
  );
  console.log('========================');
}

/**
 * Validate and ensure proper sharing URL parameters
 */
function ensureSharingURL(groupId: string, cursorFeedId: string) {
  const currentParams = new URLSearchParams(window.location.search);
  const currentGroup = currentParams.get('group');
  const currentFeed = currentParams.get('feed');

  // If URL parameters don't match what we're using, update them
  if (currentGroup !== groupId || currentFeed !== cursorFeedId) {
    const shareURL = generateShareURL(groupId, cursorFeedId);
    window.history.replaceState({}, '', shareURL);
    console.log('Updated URL for proper sharing:', shareURL);
  }
}

/**
 * Generate a unique session ID to prevent conflicts
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates a new cursor container with conflict resolution
 */
async function createCursorContainerWithRetry(
  group: Group,
  effectiveCursorFeedId: string,
  retryCount = 0,
): Promise<any | null> {
  const maxRetries = 3;

  try {
    // Generate a unique session ID for this creation attempt
    const sessionId = generateSessionId();
    const uniqueId =
      retryCount > 0
        ? `${effectiveCursorFeedId}_${sessionId}`
        : effectiveCursorFeedId;

    const cursorContainer = CursorContainer.create(
      {
        cursorFeed: CursorFeed.create([], group),
        flowDiagram: FlowDiagram.create(
          {
            nodes: [],
            edges: [],
          },
          group,
        ),
        flowViewport: FlowViewport.create(
          {
            x: 0,
            y: 0,
            zoom: 1,
          },
          group,
        ),
      },
      {
        owner: group,
        unique: uniqueId,
      },
    );

    console.log(
      'Created cursor container:',
      cursorContainer.id,
      'with session ID:',
      sessionId,
    );
    return cursorContainer;
  } catch (error) {
    console.error(
      `Failed to create cursor container (attempt ${retryCount + 1}):`,
      error,
    );

    if (error instanceof Error && error.message.includes('verified sessions')) {
      if (retryCount < maxRetries) {
        console.log(
          `Retrying with new unique ID (attempt ${retryCount + 1}/${maxRetries})...`,
        );
        // Clear some session data before retry
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('jazz')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));

        return createCursorContainerWithRetry(
          group,
          effectiveCursorFeedId,
          retryCount + 1,
        );
      } else {
        console.error('Max retries reached, clearing all session data...');
        clearSessionConflicts();
        return null;
      }
    }

    throw error;
  }
}

/**
 * Loads the cursor container for the given cursor feed ID.
 * If the cursor container does not exist, it creates a new one.
 * If the cursor container exists, it loads the existing one.
 * @param me - The account of the current user.
 * @param cursorFeedID - The ID of the cursor feed.
 * @param groupID - The ID of the group.
 */
export async function loadCursorContainer(
  me: Account,
  cursorFeedID = 'cursor-feed',
  groupID: string,
): Promise<
  { cursorFeedID: string; containerID: string; groupId: string } | undefined
> {
  if (!me) return;

  // Check for URL parameters first
  const urlParams = getURLParams();
  const effectiveGroupId = urlParams.groupId || groupID;
  const effectiveCursorFeedId = urlParams.cursorFeedId || cursorFeedID;
  const inboxId = urlParams.inboxId;

  console.log('URL params:', {
    effectiveGroupId,
    effectiveCursorFeedId,
    inboxId,
  });
  console.log('Loading group...');

  // Load the group first
  const group = await loadGroup(me, effectiveGroupId);
  console.log('Group loaded:', group?.id);

  // Synchronize container IDs if needed
  const synchronizedFeedId = synchronizeContainerIds(
    effectiveGroupId,
    effectiveCursorFeedId,
  );
  console.log('Using synchronized feed ID:', synchronizedFeedId);

  // Try to load existing cursor container
  let cursorContainer = null;
  if (synchronizedFeedId && group) {
    try {
      cursorContainer = await CursorContainer.loadUnique(
        synchronizedFeedId,
        group.id,
        {
          resolve: {
            cursorFeed: true,
            flowDiagram: true,
            flowViewport: true,
          },
        },
      );
      console.log(`Attempted to load cursor container: ${cursorContainer?.id}`);
    } catch (error) {
      console.error('Error loading cursor container:', error);

      // If we get a verified sessions error, clear session data and retry loading the same container
      if (
        error instanceof Error &&
        error.message.includes('verified sessions')
      ) {
        console.log(
          'Detected verified sessions conflict, clearing session data and retrying...',
        );

        // Clear session data and retry loading the same container
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('jazz')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        sessionStorage.clear();

        // Retry loading the same container
        try {
          cursorContainer = await CursorContainer.loadUnique(
            synchronizedFeedId,
            group.id,
            {
              resolve: {
                cursorFeed: true,
                flowDiagram: true,
                flowViewport: true,
              },
            },
          );
          console.log(
            `Successfully loaded cursor container after session clear: ${cursorContainer?.id}`,
          );
        } catch (retryError) {
          console.error(
            'Failed to load container after session clear:',
            retryError,
          );

          // If still failing, offer to create a fresh session
          if (
            confirm(
              'Session conflict persists. Would you like to start with a fresh session?',
            )
          ) {
            forceFreshSession();
            return undefined;
          }
          return undefined;
        }
      }
    }
  }

  if (cursorContainer === null || cursorContainer === undefined) {
    console.log('Global cursors does not exist, creating...');

    // Check if we have a cursor feed ID from URL that we should use
    const urlParams = new URLSearchParams(window.location.search);
    const urlCursorFeedId = urlParams.get('feed');

    // If we have a cursor feed ID from URL, try to create with that specific ID
    const effectiveFeedId = urlCursorFeedId || synchronizedFeedId;

    console.log('Creating container with feed ID:', effectiveFeedId);

    // Create new cursor container with retry mechanism
    cursorContainer = await createCursorContainerWithRetry(
      group,
      effectiveFeedId,
    );

    if (cursorContainer === null) {
      console.error('Failed to create cursor container after all retries');
      return undefined;
    }

    console.log('Created global cursors', cursorContainer.id);
    if (cursorContainer.cursorFeed === null) {
      throw new Error('cursorFeed is null');
    }

    // Update URL with the new group and feed IDs
    const shareURL = generateShareURL(group.id, cursorContainer.cursorFeed.id);
    window.history.replaceState({}, '', shareURL);
    ensureSharingURL(group.id, cursorContainer.cursorFeed.id);

    // Debug sharing info
    debugSharingInfo(
      group.id,
      cursorContainer.cursorFeed.id,
      cursorContainer.id,
    );

    return {
      cursorFeedID: cursorContainer.cursorFeed.id,
      containerID: cursorContainer.id,
      groupId: group.id,
    };
  } else {
    console.log(
      'Global cursors already exists, loading...',
      cursorContainer.id,
    );

    // If we have an inbox ID, try to receive flow data
    if (inboxId) {
      console.log('Attempting to receive flow data from inbox...');
      const flowData = await receiveFlowData(me, inboxId);
      if (flowData && cursorContainer.flowDiagram) {
        // Apply the received flow data to the existing container
        console.log('Applying received flow data...');
        // This would update the flow diagram with the received data
        // Implementation depends on the specific Jazz API
      }
    }

    // Update URL with the existing group and feed IDs
    const shareURL = generateShareURL(
      group.id,
      cursorContainer.cursorFeed?.id || '',
    );
    window.history.replaceState({}, '', shareURL);
    ensureSharingURL(group.id, cursorContainer.cursorFeed?.id || '');

    // Debug sharing info
    debugSharingInfo(
      group.id,
      cursorContainer.cursorFeed?.id || '',
      cursorContainer.id,
    );

    return {
      cursorFeedID: cursorContainer.cursorFeed?.id || '',
      containerID: cursorContainer.id,
      groupId: group.id,
    };
  }
}

/**
 * Load or create a shared cursor container for a specific room
 */
let isLoading = false;

export async function loadSharedCursorContainer(
  me: Account,
  groupID: string,
): Promise<
  | {
      cursorFeedID: string;
      containerID: string;
      groupId: string;
      roomId: string;
    }
  | undefined
> {
  if (!me || isLoading) return;

  isLoading = true;
  try {
    const roomSharing = RoomSharing.getInstance();
    const roomId = roomSharing.getRoomId();

    console.log('Loading shared container for room:', roomId);

    // Load the group first
    const group = await loadGroup(me, groupID);
    console.log('Group loaded:', group?.id);

    // Try to load existing cursor container for this room
    let cursorContainer = null;
    try {
      cursorContainer = await CursorContainer.loadUnique(
        `room-${roomId}`,
        group.id,
        {
          resolve: {
            cursorFeed: true,
            flowDiagram: true,
            flowViewport: true,
          },
        },
      );
      console.log(
        `Loaded existing cursor container for room: ${cursorContainer?.id}`,
      );
    } catch (error) {
      console.log('No existing container found for room, creating new one...');
    }

    if (cursorContainer === null || cursorContainer === undefined) {
      console.log('Creating new shared cursor container for room...');

      try {
        cursorContainer = CursorContainer.create(
          {
            cursorFeed: CursorFeed.create([], group),
            flowDiagram: FlowDiagram.create(
              {
                nodes: [],
                edges: [],
              },
              group,
            ),
            flowViewport: FlowViewport.create(
              {
                x: 0,
                y: 0,
                zoom: 1,
              },
              group,
            ),
          },
          {
            owner: group,
            unique: `room-${roomId}`,
          },
        );

        console.log(
          'Created shared cursor container for room:',
          cursorContainer.id,
        );
      } catch (error) {
        console.error('Failed to create shared container:', error);

        // If there's a session conflict, clear session data and retry
        if (
          error instanceof Error &&
          error.message.includes('verified sessions')
        ) {
          console.log(
            'Session conflict detected, clearing session data and retrying...',
          );
          clearSessionConflicts();
          return undefined;
        }

        return undefined;
      }
    }

    if (cursorContainer.cursorFeed === null) {
      throw new Error('cursorFeed is null');
    }

    console.log('=== ROOM SHARING DEBUG INFO ===');
    console.log('Room ID:', roomId);
    console.log('Group ID:', group.id);
    console.log('Container ID:', cursorContainer.id);
    console.log('Cursor Feed ID:', cursorContainer.cursorFeed.id);
    console.log('Shareable Link:', roomSharing.getShareableLink());
    console.log('================================');

    return {
      cursorFeedID: cursorContainer.cursorFeed.id,
      containerID: cursorContainer.id,
      groupId: group.id,
      roomId: roomId,
    };
  } finally {
    isLoading = false;
  }
}

/**
 * Clear session conflicts by clearing local storage and reloading
 */

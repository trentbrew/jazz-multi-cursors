import { Group, co, z } from 'jazz-tools';
import { Camera, Cursor } from './types';

export const CursorFeed = co.feed(Cursor);

export const CursorProfile = co.profile({
  name: z.string(),
});

// Flow diagram data structures for real-time collaboration
export const FlowNode = co.map({
  id: z.string(),
  type: z.string().optional(),
  data: co.map({
    label: z.string(),
  }),
  position: co.map({
    x: z.number(),
    y: z.number(),
  }),
});

export const FlowEdge = co.map({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.string().optional(),
});

export const FlowDiagram = co.map({
  nodes: co.list(FlowNode),
  edges: co.list(FlowEdge),
});

export const FlowViewport = co.map({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

export const CursorRoot = co.map({
  camera: Camera,
  cursors: CursorFeed,
  flowDiagram: FlowDiagram.optional(),
  flowViewport: FlowViewport.optional(),
});

export const CursorContainer = co.map({
  cursorFeed: CursorFeed,
  flowDiagram: FlowDiagram.optional(),
  flowViewport: FlowViewport.optional(),
});

export const CursorAccount = co
  .account({
    profile: CursorProfile,
    root: CursorRoot,
  })
  .withMigration((account: any) => {
    if (account.root === undefined) {
      account.root = CursorRoot.create({
        camera: {
          position: {
            x: 0,
            y: 0,
          },
        },
        cursors: CursorFeed.create([]),
        flowDiagram: FlowDiagram.create({
          nodes: [],
          edges: [],
        }),
        flowViewport: FlowViewport.create({
          x: 0,
          y: 0,
          zoom: 1,
        }),
      });
    }

    if (account.profile === undefined) {
      const group = Group.create();
      group.makePublic(); // The profile info is visible to everyone

      account.profile = CursorProfile.create(
        {
          name: 'Anonymous user',
        },
        group,
      );
    }
  });

# Multi-Cursors with Flow Diagrams

This example demonstrates collaborative cursor tracking with multiple modes:

1. **Canvas Mode**: Original SVG-based canvas with collaborative cursors
2. **Flow Mode**: ReactFlow-based diagram editor with cursor tracking
3. **Collaborative Flow Mode**: Enhanced flow editor with real-time collaboration

## Features

### Canvas Mode

- SVG-based infinite canvas
- Real-time cursor tracking across multiple users
- Pan and zoom functionality
- Visual cursor indicators with user names

### Flow Mode

- ReactFlow-based diagram editor
- Interactive nodes and edges
- Real-time cursor tracking
- Double-click to add new nodes
- Drag and drop functionality

### Collaborative Flow Mode

- Enhanced flow editor with collaboration features
- Real-time cursor tracking
- Interactive diagram editing
- User presence indicators

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the development server:

   ```bash
   pnpm dev
   ```

3. Open multiple browser windows to test collaboration

## Usage

- **Switch Modes**: Use the toggle button in the top-left corner to switch between Canvas, Flow, and Collaborative Flow modes
- **Add Nodes**: Double-click anywhere in Flow mode to add new nodes
- **Connect Nodes**: Drag from one node's handle to another to create connections
- **Move Nodes**: Drag nodes to reposition them
- **Pan Canvas**: Click and drag in empty areas to pan
- **Zoom**: Use mouse wheel or the controls in the bottom-right

## Technical Details

### Dependencies

- `@xyflow/react`: ReactFlow library for diagram editing
- `jazz-tools`: Real-time collaboration framework
- `react-spring`: Smooth animations for cursors

### Architecture

- **Cursor Tracking**: Uses Jazz's `CursorFeed` for real-time cursor synchronization
- **Flow Diagrams**: ReactFlow handles the diagram state and interactions
- **Mode Switching**: Simple state management for switching between different canvas types

### Key Components

- `FlowContainer`: Main container that manages mode switching
- `FlowCanvas`: Basic ReactFlow implementation with cursor tracking
- `CollaborativeFlowCanvas`: Enhanced flow editor with collaboration features
- `Cursor`: Visual cursor component with user information

## Future Enhancements

- [ ] Collaborative node editing (labels, properties)
- [ ] Real-time edge creation and modification
- [ ] Custom node types and styling
- [ ] Export/import functionality
- [ ] Undo/redo with collaboration
- [ ] Comments and annotations
- [ ] Version history and branching

## Contributing

This is part of the Jazz examples. Feel free to contribute by:

1. Adding new flow diagram features
2. Improving cursor visualization
3. Enhancing collaboration features
4. Adding new node types and interactions

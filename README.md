# Mine Visualization System

A production-ready Three.js web application for visualizing an underground mine with real-time vehicle tracking.

## Features

- **3D Mine Visualization**: Load and render large GLTF mine models with transparency
- **Real-Time Vehicle Tracking**: Display and track mining vehicles with smooth interpolation
- **WebSocket Integration**: Real-time data updates with simulated fallback
- **Interactive Controls**: Orbit camera with zoom, pan, and rotate
- **Responsive UI**: Connection status, vehicle count, and selection info overlay

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

## Project Structure

```
├── index.html              # Main HTML entry point
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite bundler configuration
├── public/
│   ├── config/
│   │   └── app-config.json # Application configuration
│   ├── models/
│   │   ├── mine/           # Mine GLTF models
│   │   └── vehicles/       # Vehicle GLTF models
│   └── draco/              # DRACO decoder files
└── src/
    ├── main.js             # Application entry point
    ├── core/
    │   ├── Experience.js   # Main controller
    │   ├── Renderer.js     # WebGL renderer
    │   ├── Camera.js       # Camera & controls
    │   ├── SceneManager.js # Scene management
    │   └── AssetLoader.js  # GLTF/DRACO loading
    ├── components/
    │   ├── MineEnvironment.js    # Mine model handler
    │   ├── Vehicle.js            # Vehicle instance
    │   ├── VehicleManager.js     # Vehicle management
    │   └── LightingSystem.js     # Underground lighting
    ├── services/
    │   ├── WebSocketService.js   # Real-time data
    │   └── UIController.js       # HTML overlay
    ├── utils/
    │   ├── EventBus.js           # Event system
    │   ├── ConfigLoader.js       # Config loading
    │   └── MathUtils.js          # Math helpers
    └── styles/
        └── main.css              # UI styles
```

## Configuration

Edit `public/config/app-config.json` to customize:

### Mine Origin Alignment

The mine model is repositioned so that a real-world coordinate aligns with Three.js origin (0,0,0):

```json
{
  "mine": {
    "modelPath": "/models/mine/scene.gltf",
    "origin": { "x": 1200, "y": -350, "z": 890 }
  }
}
```

### Vehicle Types

Configure available vehicle types and their models:

```json
{
  "vehicles": {
    "types": [
      { "type": "dump_truck", "modelPath": "/models/vehicles/truck.glb" },
      { "type": "loader", "modelPath": "/models/vehicles/loader.glb" }
    ]
  }
}
```

### WebSocket Connection

```json
{
  "websocket": {
    "url": "ws://your-server:8080",
    "simulate": false
  }
}
```

## WebSocket Protocol

### Vehicle Update Message

```json
{
  "id": "TRUCK_01",
  "type": "dump_truck",
  "position": { "x": 124.5, "y": -312.2, "z": 87.9 },
  "heading": 142,
  "speed": 18.5,
  "status": "moving"
}
```

### Batch Update

```json
{
  "type": "vehicle_batch",
  "vehicles": [
    { "id": "TRUCK_01", ... },
    { "id": "TRUCK_02", ... }
  ]
}
```

## Controls

- **Left Mouse**: Rotate camera
- **Right Mouse**: Pan camera
- **Mouse Wheel**: Zoom in/out
- **Click Vehicle**: Select and show info

## Performance Notes

- Mine model uses 50% opacity for vehicle visibility
- Pixel ratio capped at 2x for performance
- Vehicles use lerp interpolation for smooth movement
- Frustum culling enabled by default
- Shadows disabled by default (can enable in config)

## Future Enhancements

The architecture supports:

- Historical playback
- Section clipping planes
- Vehicle path trails
- WebXR walkthrough mode

## License

MIT

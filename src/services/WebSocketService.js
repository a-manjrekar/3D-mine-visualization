/**
 * WebSocketService - Real-Time Data Connection
 * 
 * Handles WebSocket connection for receiving real-time vehicle telemetry.
 * In development mode, simulates vehicles moving inside tunnel paths.
 * 
 * Features:
 * - Auto-reconnection
 * - Connection status events
 * - Raycasting to find valid tunnel positions
 * - Simulation mode for development
 */

import * as THREE from 'three';

export class WebSocketService {
  constructor(options = {}) {
    this.config = options.config || {};
    this.events = options.events;
    
    // Connection state
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = this.config.maxReconnectAttempts || 5;
    this.reconnectDelay = this.config.reconnectDelay || 3000;
    
    // Simulation state
    this.isSimulating = this.config.simulate !== false;
    this.simulationInterval = null;
    this.simulatedVehicles = new Map();
    
    // Mine data for constraining vehicles
    this.mineModel = null;
    this.mineBounds = null;
    this.mineCenter = null;
    this.mineMeshes = [];
    this.tunnelPaths = [];
  }
  
  /**
   * Set mine model and bounds for vehicle path constraints
   */
  setMineData(model, bounds, center) {
    this.mineModel = model;
    this.mineBounds = bounds;
    this.mineCenter = center;
    
    // Collect meshes for raycasting
    this.mineMeshes = [];
    if (model) {
      model.traverse((child) => {
        if (child.isMesh) {
          this.mineMeshes.push(child);
        }
      });
    }
    
    console.log('Mine data received:', {
      meshCount: this.mineMeshes.length,
      center: { x: center.x.toFixed(2), y: center.y.toFixed(2), z: center.z.toFixed(2) }
    });
    
    // Generate valid tunnel paths
    this.generateTunnelPaths();
  }
  
  /**
   * Generate paths inside tunnels using raycasting
   * More strict validation to ensure paths stay inside
   */
  generateTunnelPaths() {
    if (!this.mineBounds || this.mineMeshes.length === 0) {
      console.warn('No mine data for path generation');
      this.tunnelPaths = this.createFallbackPaths();
      return;
    }
    
    const raycaster = new THREE.Raycaster();
    const validPoints = [];
    
    const { min, max } = this.mineBounds;
    // Finer grid for better path coverage
    const stepX = (max.x - min.x) / 30;
    const stepZ = (max.z - min.z) / 30;
    
    // Sample grid and find points inside tunnels using downward raycast
    for (let x = min.x + stepX * 2; x < max.x - stepX * 2; x += stepX) {
      for (let z = min.z + stepZ * 2; z < max.z - stepZ * 2; z += stepZ) {
        // Cast ray from above, pointing down
        const rayOrigin = new THREE.Vector3(x, max.y + 10, z);
        raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
        raycaster.far = 1000;
        
        const hits = raycaster.intersectObjects(this.mineMeshes, true);
        
        if (hits.length >= 2) {
          // Sort by Y to get floor and ceiling
          hits.sort((a, b) => a.point.y - b.point.y);
          const floorY = hits[0].point.y;
          const ceilingY = hits[hits.length - 1].point.y;
          const tunnelHeight = ceilingY - floorY;
          
          // Valid tunnel: reasonable height
          if (tunnelHeight > 1.0 && tunnelHeight < 20) {
            // Place vehicle on floor
            const vehicleY = floorY + 0.3;
            validPoints.push({ x, y: vehicleY, z });
          }
        }
      }
    }
    
    console.log(`Found ${validPoints.length} valid tunnel points`);
    
    if (validPoints.length < 5) {
      this.tunnelPaths = this.createFallbackPaths();
      return;
    }
    
    // Create 5 separate paths from valid points
    this.tunnelPaths = [];
    const pointsPerPath = Math.floor(validPoints.length / 5);
    
    for (let i = 0; i < 5; i++) {
      const pathPoints = validPoints.slice(i * pointsPerPath, (i + 1) * pointsPerPath);
      if (pathPoints.length >= 2) {
        // Make it loop
        pathPoints.push({ ...pathPoints[0] });
        this.tunnelPaths.push(pathPoints);
      }
    }
    
    console.log(`Created ${this.tunnelPaths.length} tunnel paths`);
  }
  
  /**
   * Fallback paths at model center
   */
  createFallbackPaths() {
    const cx = this.mineCenter?.x || 0;
    const cy = this.mineCenter?.y || 0;
    const cz = this.mineCenter?.z || 0;
    
    return [
      [{ x: cx, y: cy, z: cz }, { x: cx+1, y: cy, z: cz+1 }, { x: cx+2, y: cy, z: cz }, { x: cx+1, y: cy, z: cz-1 }, { x: cx, y: cy, z: cz }],
      [{ x: cx-2, y: cy, z: cz }, { x: cx-1, y: cy, z: cz+1 }, { x: cx, y: cy, z: cz }, { x: cx-1, y: cy, z: cz-1 }, { x: cx-2, y: cy, z: cz }],
      [{ x: cx+2, y: cy, z: cz }, { x: cx+3, y: cy, z: cz+1 }, { x: cx+4, y: cy, z: cz }, { x: cx+3, y: cy, z: cz-1 }, { x: cx+2, y: cy, z: cz }],
      [{ x: cx, y: cy, z: cz-2 }, { x: cx+1, y: cy, z: cz-1 }, { x: cx, y: cy, z: cz }, { x: cx-1, y: cy, z: cz-1 }, { x: cx, y: cy, z: cz-2 }],
      [{ x: cx, y: cy, z: cz+2 }, { x: cx+1, y: cy, z: cz+3 }, { x: cx, y: cy, z: cz+4 }, { x: cx-1, y: cy, z: cz+3 }, { x: cx, y: cy, z: cz+2 }]
    ];
  }
  
  /**
   * Connect to WebSocket server or start simulation
   */
  connect() {
    if (this.isSimulating) {
      this.startSimulation();
    } else {
      this.connectWebSocket();
    }
  }
  
  /**
   * Connect to actual WebSocket server
   */
  connectWebSocket() {
    const url = this.config.url || 'ws://localhost:8080';
    
    try {
      this.events?.emit('connection:status', 'connecting');
      this.socket = new WebSocket(url);
      
      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.events?.emit('connection:status', 'connected');
      };
      
      this.socket.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
      this.socket.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.events?.emit('connection:status', 'disconnected');
        this.attemptReconnect();
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.events?.emit('connection:status', 'error');
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.events?.emit('connection:status', 'error');
    }
  }
  
  /**
   * Attempt to reconnect after disconnect
   */
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connectWebSocket();
      }, this.reconnectDelay);
    } else {
      console.log('Max reconnection attempts reached');
      // Fall back to simulation
      this.startSimulation();
    }
  }
  
  /**
   * Handle incoming WebSocket message
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Handle different message types
      if (message.type === 'vehicle_update' || message.id) {
        this.events?.emit('vehicle:update', message);
      } else if (message.type === 'vehicle_batch') {
        message.vehicles.forEach((vehicle) => {
          this.events?.emit('vehicle:update', vehicle);
        });
      }
      
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }
  
  /**
   * Start vehicle simulation for development
   */
  startSimulation() {
    console.log('Starting vehicle simulation...');
    this.isSimulating = true;
    this.events?.emit('connection:status', 'connected');
    
    // Initialize simulated vehicles
    this.initSimulatedVehicles();
    
    // Update simulation at 5 Hz (200ms intervals) - optimized from 10Hz
    this.simulationInterval = setInterval(() => {
      this.updateSimulation();
    }, 200);
  }
  
  /**
   * Initialize simulated vehicles with validated tunnel paths
   */
  initSimulatedVehicles() {
    // Use generated tunnel paths or create fallback
    if (this.tunnelPaths.length === 0) {
      this.tunnelPaths = this.createFallbackPaths();
    }
    
    const vehicleConfigs = [
      { id: 'TRUCK_01', type: 'dump_truck', pathIndex: 0 },
      { id: 'TRUCK_02', type: 'dump_truck', pathIndex: 1 },
      { id: 'LOADER_01', type: 'loader', pathIndex: 2 },
      { id: 'HAUL_01', type: 'haul_truck', pathIndex: 3 },
      { id: 'TRUCK_03', type: 'dump_truck', pathIndex: 4 },
      { id: 'TRUCK_04', type: 'dump_truck', pathIndex: 0 },
      { id: 'TRUCK_05', type: 'dump_truck', pathIndex: 1 },
    ];
    
    console.log('Initializing vehicles with tunnel paths');

    vehicleConfigs.forEach((config) => {
      const pathIndex = config.pathIndex % this.tunnelPaths.length;
      const path = this.tunnelPaths[pathIndex];
      if (!path || path.length < 2) return;
      const startPoint = path[0];
      
      this.simulatedVehicles.set(config.id, {
        id: config.id,
        type: config.type,
        position: { ...startPoint },
        heading: 0,
        speed: 0,
        status: 'moving',
        // Path-following parameters
        path: path,
        currentWaypointIndex: 0,
        nextWaypointIndex: 1,
        pathProgress: 0,
        pathSpeed: 0.08 + Math.random() * 0.04, // Faster movement
      });
    });
    
    // Emit initial positions
    this.simulatedVehicles.forEach((vehicle) => {
      this.events?.emit('vehicle:update', {
        id: vehicle.id,
        type: vehicle.type,
        position: vehicle.position,
        heading: vehicle.heading,
        speed: vehicle.speed,
        status: vehicle.status
      });
    });
    
    this.events?.emit('vehicles:count', this.simulatedVehicles.size);
  }
  
  /**
   * Update simulation - move vehicles along tunnel waypoint paths
   */
  updateSimulation() {
    const deltaTime = 0.1; // 100ms
    
    this.simulatedVehicles.forEach((vehicle) => {
      const path = vehicle.path;
      const currentWaypoint = path[vehicle.currentWaypointIndex];
      const nextWaypoint = path[vehicle.nextWaypointIndex];
      
      // Store previous position for heading calculation
      const prevX = vehicle.position.x;
      const prevZ = vehicle.position.z;
      
      // Update progress along current segment
      vehicle.pathProgress += deltaTime * vehicle.pathSpeed;
      
      // Check if we've reached the next waypoint
      if (vehicle.pathProgress >= 1.0) {
        vehicle.pathProgress = 0;
        vehicle.currentWaypointIndex = vehicle.nextWaypointIndex;
        vehicle.nextWaypointIndex = (vehicle.nextWaypointIndex + 1) % path.length;
      }
      
      // Interpolate position between waypoints
      const t = vehicle.pathProgress;
      vehicle.position.x = currentWaypoint.x + (nextWaypoint.x - currentWaypoint.x) * t;
      vehicle.position.y = currentWaypoint.y + (nextWaypoint.y - currentWaypoint.y) * t;
      vehicle.position.z = currentWaypoint.z + (nextWaypoint.z - currentWaypoint.z) * t;
      
      // Calculate heading from movement direction
      const dx = vehicle.position.x - prevX;
      const dz = vehicle.position.z - prevZ;
      if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
        vehicle.heading = Math.atan2(dx, dz) * (180 / Math.PI);
      }
      
      // Calculate speed based on distance traveled
      const distance = Math.sqrt(dx * dx + dz * dz);
      vehicle.speed = distance / deltaTime * 3.6; // Convert to km/h
      
      // Emit update
      this.events?.emit('vehicle:update', {
        id: vehicle.id,
        type: vehicle.type,
        position: { ...vehicle.position },
        heading: vehicle.heading,
        speed: vehicle.speed,
        status: vehicle.status
      });
    });
  }
  
  /**
   * Send message to server
   */
  send(data) {
    if (this.socket && this.isConnected) {
      this.socket.send(JSON.stringify(data));
    }
  }
  
  /**
   * Disconnect and clean up
   */
  disconnect() {
    // Stop simulation
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    
    // Close WebSocket
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.events?.emit('connection:status', 'disconnected');
  }
  
  /**
   * Get connection status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isSimulating: this.isSimulating,
      vehicleCount: this.simulatedVehicles.size
    };
  }
}

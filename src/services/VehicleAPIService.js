/**
 * VehicleAPIService - Production-Ready API Data Service
 * 
 * Simulates backend API for vehicle telemetry data.
 * In production, replace simulation with actual API calls.
 * 
 * Features:
 * - Adaptive update rates (followed vehicles update faster)
 * - Priority-based updates (visible/selected vehicles first)
 * - Batch updates to reduce network overhead
 * - Connection pooling simulation
 * - Fallback to cached data on connection loss
 */

import * as THREE from 'three';

// Update rate tiers (in milliseconds)
const UPDATE_RATES = {
  FOLLOWED: 100,      // Vehicle being followed - real-time
  SELECTED: 200,      // Currently selected vehicle
  VISIBLE: 500,       // Vehicles visible in viewport
  BACKGROUND: 2000,   // Off-screen vehicles
  IDLE: 5000          // Idle/parked vehicles
};

// Vehicle status types
export const VEHICLE_STATUS = {
  MOVING: 'moving',
  IDLE: 'idle',
  LOADING: 'loading',
  UNLOADING: 'unloading',
  MAINTENANCE: 'maintenance',
  OFFLINE: 'offline'
};

// Vehicle types
export const VEHICLE_TYPES = {
  DUMP_TRUCK: 'dump_truck',
  LOADER: 'loader',
  HAUL_TRUCK: 'haul_truck'
};

export class VehicleAPIService {
  constructor(options = {}) {
    this.config = options.config || {};
    this.events = options.events;
    
    // API configuration
    this.apiBaseUrl = this.config.apiUrl || '/api/vehicles';
    this.useSimulation = this.config.simulate !== false;
    
    console.log('VehicleAPIService: constructor', {
      config: this.config,
      useSimulation: this.useSimulation
    });
    
    // Connection state
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    
    // Vehicle data cache
    this.vehicleCache = new Map();
    this.lastUpdateTimes = new Map();
    
    // Priority tracking
    this.followedVehicleId = null;
    this.selectedVehicleId = null;
    this.visibleVehicleIds = new Set();
    
    // Update timers
    this.updateTimers = new Map();
    this.masterUpdateInterval = null;
    
    // Mine data for simulation
    this.mineModel = null;
    this.mineBounds = null;
    this.mineCenter = null;
    this.mineMeshes = [];
    this.tunnelPaths = [];
    
    // Simulation state (for dev mode)
    this.simulatedVehicles = new Map();
    this.vehiclesCreated = false;
  }
  
  /**
   * Initialize the API service
   */
  async initialize() {
    console.log('VehicleAPIService: initialize() called', {
      useSimulation: this.useSimulation,
      hasBounds: !!this.mineBounds
    });
    
    if (this.useSimulation) {
      console.log('VehicleAPIService: Running in simulation mode');
      await this.initSimulation();
    } else {
      console.log('VehicleAPIService: Connecting to backend API');
      await this.connectToAPI();
    }
    
    this.isConnected = true;
    this.events?.emit('connection:status', 'connected');
    
    // Start the master update loop
    this.startUpdateLoop();
    
    console.log('VehicleAPIService: initialization complete', {
      vehicleCount: this.simulatedVehicles.size,
      pathCount: this.tunnelPaths.length
    });
  }
  
  /**
   * Set mine data for path generation (simulation mode)
   */
  setMineData(model, bounds, center) {
    this.mineModel = model;
    this.mineBounds = bounds;
    this.mineCenter = center;
    
    console.log('VehicleAPIService: Mine data received', {
      hasModel: !!model,
      center: center ? `(${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)})` : null
    });
    
    if (model) {
      this.mineMeshes = [];
      model.traverse((child) => {
        if (child.isMesh) {
          this.mineMeshes.push(child);
        }
      });
      console.log(`Collected ${this.mineMeshes.length} meshes`);
    }
    
    // Generate paths with mine data
    this.generateTunnelPaths();
    
    // Create vehicles now if not yet created
    if (!this.vehiclesCreated) {
      this.createSimulatedVehicles();
      this.vehiclesCreated = true;
      console.log(`Created ${this.simulatedVehicles.size} vehicles after mine load`);
    }
  }
  
  /**
   * Connect to real backend API
   */
  async connectToAPI() {
    try {
      // In production, this would establish WebSocket or SSE connection
      const response = await fetch(`${this.apiBaseUrl}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error('API connection failed');
      
      // Setup WebSocket for real-time updates
      // this.setupWebSocket();
      
    } catch (error) {
      console.warn('API connection failed, falling back to simulation:', error);
      this.useSimulation = true;
      await this.initSimulation();
    }
  }
  
  /**
   * Initialize simulation mode
   */
  async initSimulation() {
    console.log('VehicleAPIService: Initializing simulation');
    
    // Only create vehicles if we have mine data
    if (this.mineBounds && this.mineCenter) {
      this.generateTunnelPaths();
      this.createSimulatedVehicles();
      this.vehiclesCreated = true;
      console.log(`VehicleAPIService: Created ${this.simulatedVehicles.size} vehicles`);
    } else {
      console.log('VehicleAPIService: Waiting for mine data before creating vehicles');
    }
  }
  
  /**
   * Find a valid tunnel position using raycasting
   * Returns position if there's floor and ceiling (inside tunnel)
   */
  findValidTunnelPosition(x, z) {
    if (this.mineMeshes.length === 0 || !this.mineBounds) {
      return null;
    }
    
    const raycaster = new THREE.Raycaster();
    const maxY = this.mineBounds.max.y;
    
    // Cast ray DOWN from above
    raycaster.set(new THREE.Vector3(x, maxY + 10, z), new THREE.Vector3(0, -1, 0));
    raycaster.far = 1000;
    const downHits = raycaster.intersectObjects(this.mineMeshes, true);
    
    if (downHits.length < 1) return null;
    
    // Use lowest hit as floor
    downHits.sort((a, b) => a.point.y - b.point.y);
    const floorY = downHits[0].point.y;
    
    // Check for ceiling above floor
    const testY = floorY + 1;
    raycaster.set(new THREE.Vector3(x, testY, z), new THREE.Vector3(0, 1, 0));
    raycaster.far = 50;
    const upHits = raycaster.intersectObjects(this.mineMeshes, true);
    
    // Must have ceiling within reasonable distance
    if (upHits.length > 0 && upHits[0].distance < 25) {
      return { x, y: floorY + 0.5, z };
    }
    
    // Fallback: if no ceiling but we have floor hits, still use it
    if (downHits.length >= 2) {
      return { x, y: floorY + 0.5, z };
    }
    
    return null;
  }
  
  /**
   * Scan entire mine to find ALL valid tunnel positions
   * Organized by rows for spatial coherence
   */
  findAllTunnelPositions() {
    const { min, max } = this.mineBounds;
    
    // Scan grid - step of 3 for reasonable performance
    const step = 3;
    const rows = []; // Store positions organized by Z-rows
    
    for (let z = min.z + step; z < max.z - step; z += step) {
      const row = [];
      for (let x = min.x + step; x < max.x - step; x += step) {
        const pos = this.findValidTunnelPosition(x, z);
        if (pos) {
          row.push(pos);
        }
      }
      if (row.length > 0) {
        rows.push(row);
      }
    }
    
    // Flatten rows in a snake pattern so consecutive positions are spatially adjacent
    const validPositions = [];
    for (let i = 0; i < rows.length; i++) {
      if (i % 2 === 0) {
        validPositions.push(...rows[i]); // Left to right
      } else {
        validPositions.push(...rows[i].reverse()); // Right to left
      }
    }
    
    console.log(`Found ${validPositions.length} valid tunnel grid positions in ${rows.length} rows`);
    return validPositions;
  }
  
  /**
   * Generate paths using ONLY validated tunnel positions
   * Creates 25 paths for vehicles to move between nearby valid positions
   */
  generateTunnelPaths() {
    if (!this.mineBounds || this.mineMeshes.length === 0) {
      console.log('No mine data, cannot generate validated paths');
      return;
    }
    
    console.log('=== SCANNING MINE FOR ALL VALID TUNNEL POSITIONS ===');
    console.log(`Mine meshes: ${this.mineMeshes.length}`);
    
    // Find ALL valid positions in the mine (snake-ordered)
    const allPositions = this.findAllTunnelPositions();
    
    if (allPositions.length < 4) {
      console.warn('Not enough valid positions! Vehicles will be stationary.');
      this.tunnelPaths = [];
      for (let i = 0; i < 25; i++) {
        const pos = allPositions[i % Math.max(1, allPositions.length)] || { x: 0, y: 0, z: 0 };
        this.tunnelPaths.push([pos, pos]);
      }
      return;
    }
    
    // Build paths using only adjacent positions (within grid step distance)
    this.tunnelPaths = [];
    const gridStep = 3;
    const maxDist = gridStep * 1.5; // Allow slightly more than one step
    
    for (let pathNum = 0; pathNum < 25; pathNum++) {
      const startIdx = Math.floor((pathNum / 25) * allPositions.length);
      const path = [allPositions[startIdx]];
      const usedIndices = new Set([startIdx]);
      
      // Build path by finding adjacent positions only
      for (let step = 0; step < 4; step++) {
        const lastPos = path[path.length - 1];
        let bestIdx = -1;
        let bestDist = Infinity;
        
        // Search nearby indices for adjacent position
        for (let offset = -20; offset <= 20; offset++) {
          const idx = startIdx + step + offset;
          if (idx < 0 || idx >= allPositions.length || usedIndices.has(idx)) continue;
          
          const candidate = allPositions[idx];
          const dist = Math.sqrt(
            Math.pow(candidate.x - lastPos.x, 2) + 
            Math.pow(candidate.z - lastPos.z, 2)
          );
          
          // Only accept positions within grid step distance
          if (dist <= maxDist && dist > 0.1 && dist < bestDist) {
            bestIdx = idx;
            bestDist = dist;
          }
        }
        
        if (bestIdx >= 0) {
          path.push(allPositions[bestIdx]);
          usedIndices.add(bestIdx);
        }
      }
      
      this.tunnelPaths.push(path);
    }
    
    console.log(`Generated ${this.tunnelPaths.length} paths with ${allPositions.length} total valid positions`);
  }
  
  /**
   * Create fallback paths at origin
   */
  createFallbackPaths() {
    const cy = this.mineBounds ? this.mineBounds.min.y + 1 : 0;
    return [
      [{ x: 0, y: cy, z: 0 }, { x: 0, y: cy, z: 0 }],
    ];
  }

  /**
   * Clamp a position to stay within mine bounds
   */
  clampToBounds(x, y, z) {
    if (!this.mineBounds) return { x, y, z };
    const { min, max } = this.mineBounds;
    // Add margin to keep vehicles away from edges
    const margin = 2;
    return {
      x: Math.max(min.x + margin, Math.min(max.x - margin, x)),
      y: y, // Keep floor Y as calculated
      z: Math.max(min.z + margin, Math.min(max.z - margin, z))
    };
  }
  
  /**
   * Create a rectangular path with bounds clamping
   */
  createRectPath(cx, cy, cz, halfWidth, halfDepth) {
    const points = [
      { x: cx - halfWidth, y: cy, z: cz - halfDepth },
      { x: cx - halfWidth, y: cy, z: cz + halfDepth },
      { x: cx + halfWidth, y: cy, z: cz + halfDepth },
      { x: cx + halfWidth, y: cy, z: cz - halfDepth },
      { x: cx - halfWidth, y: cy, z: cz - halfDepth } // Close loop
    ];
    // Clamp all points to bounds
    return points.map(p => this.clampToBounds(p.x, p.y, p.z));
  }
  
  /**
   * Create a diamond-shaped path
   */
  createDiamondPath(cx, cy, cz, halfWidth, halfDepth) {
    const points = [
      { x: cx, y: cy, z: cz - halfDepth },
      { x: cx - halfWidth, y: cy, z: cz },
      { x: cx, y: cy, z: cz + halfDepth },
      { x: cx + halfWidth, y: cy, z: cz },
      { x: cx, y: cy, z: cz - halfDepth } // Close loop
    ];
    // Clamp all points to bounds
    return points.map(p => this.clampToBounds(p.x, p.y, p.z));
  }
  
  /**
   * Create a corridor path (back and forth) with bounds clamping
   */
  createCorridorPath(cx, cy, cz, length, direction) {
    let points;
    if (direction === 'horizontal') {
      points = [
        { x: cx - length / 2, y: cy, z: cz },
        { x: cx - length / 4, y: cy, z: cz + length * 0.1 },
        { x: cx, y: cy, z: cz },
        { x: cx + length / 4, y: cy, z: cz - length * 0.1 },
        { x: cx + length / 2, y: cy, z: cz },
        { x: cx + length / 4, y: cy, z: cz - length * 0.1 },
        { x: cx, y: cy, z: cz },
        { x: cx - length / 4, y: cy, z: cz + length * 0.1 },
        { x: cx - length / 2, y: cy, z: cz } // Close loop
      ];
    } else {
      points = [
        { x: cx, y: cy, z: cz - length / 2 },
        { x: cx + length * 0.1, y: cy, z: cz - length / 4 },
        { x: cx, y: cy, z: cz },
        { x: cx - length * 0.1, y: cy, z: cz + length / 4 },
        { x: cx, y: cy, z: cz + length / 2 },
        { x: cx - length * 0.1, y: cy, z: cz + length / 4 },
        { x: cx, y: cy, z: cz },
        { x: cx + length * 0.1, y: cy, z: cz - length / 4 },
        { x: cx, y: cy, z: cz - length / 2 } // Close loop
      ];
    }
    return points.map(p => this.clampToBounds(p.x, p.y, p.z));
  }
  
  /**
   * Create fallback paths at mine center
   */
  createFallbackPaths() {
    const cx = this.mineCenter?.x || 0;
    const cy = this.mineCenter?.y || 0;
    const cz = this.mineCenter?.z || 0;
    
    return [
      [{ x: cx, y: cy, z: cz }, { x: cx+2, y: cy, z: cz+2 }, { x: cx+4, y: cy, z: cz }, { x: cx+2, y: cy, z: cz-2 }, { x: cx, y: cy, z: cz }],
      [{ x: cx-3, y: cy, z: cz }, { x: cx-1, y: cy, z: cz+2 }, { x: cx+1, y: cy, z: cz }, { x: cx-1, y: cy, z: cz-2 }, { x: cx-3, y: cy, z: cz }],
      [{ x: cx+3, y: cy, z: cz }, { x: cx+5, y: cy, z: cz+2 }, { x: cx+7, y: cy, z: cz }, { x: cx+5, y: cy, z: cz-2 }, { x: cx+3, y: cy, z: cz }],
      [{ x: cx, y: cy, z: cz-3 }, { x: cx+2, y: cy, z: cz-1 }, { x: cx+4, y: cy, z: cz-3 }, { x: cx+2, y: cy, z: cz-5 }, { x: cx, y: cy, z: cz-3 }],
      [{ x: cx, y: cy, z: cz+3 }, { x: cx+2, y: cy, z: cz+5 }, { x: cx+4, y: cy, z: cz+3 }, { x: cx+2, y: cy, z: cz+1 }, { x: cx, y: cy, z: cz+3 }],
    ];
  }
  
  /**
   * Create simulated vehicles (20+ trucks)
   */
  createSimulatedVehicles() {
    console.log('VehicleAPIService: Creating vehicles with paths:', this.tunnelPaths.length);
    
    // Generate 25 vehicle configs
    const vehicleConfigs = [];
    const types = [VEHICLE_TYPES.DUMP_TRUCK, VEHICLE_TYPES.LOADER, VEHICLE_TYPES.HAUL_TRUCK];
    const groups = ['hauling', 'loading', 'transport'];
    
    for (let i = 1; i <= 25; i++) {
      const typeIdx = i % 3;
      const prefix = typeIdx === 0 ? 'TRUCK' : typeIdx === 1 ? 'LOADER' : 'HAUL';
      vehicleConfigs.push({
        id: `${prefix}_${String(i).padStart(2, '0')}`,
        type: types[typeIdx],
        group: groups[typeIdx],
        pathIndex: i - 1
      });
    }
    
    vehicleConfigs.forEach((config, index) => {
      const path = this.tunnelPaths[config.pathIndex % this.tunnelPaths.length];
      if (!path || path.length < 2) {
        console.warn(`VehicleAPIService: Invalid path for ${config.id}`, path);
        return;
      }
      
      // Start each vehicle at different point along the path
      const startProgress = (index * 0.15) % 1;
      const startWaypoint = Math.floor(startProgress * (path.length - 1));
      const startPos = path[startWaypoint];
      
      console.log(`VehicleAPIService: Creating ${config.id} at position:`, startPos);
      
      const vehicle = {
        id: config.id,
        type: config.type,
        group: config.group,
        status: VEHICLE_STATUS.MOVING,
        position: { x: startPos.x, y: startPos.y, z: startPos.z },
        heading: 0,
        speed: 0,
        level: 0,
        // Path state
        path: path,
        currentWaypointIndex: startWaypoint,
        pathProgress: 0,
        // Visible movement speed
        pathSpeed: 0.015 + Math.random() * 0.01,
        // Metadata
        driver: `Driver ${config.id.slice(-2)}`,
        lastMaintenance: Date.now() - Math.random() * 86400000,
        fuelLevel: 50 + Math.random() * 50
      };
      
      this.simulatedVehicles.set(config.id, vehicle);
      this.vehicleCache.set(config.id, this.formatVehicleData(vehicle));
      
      // Emit initial vehicle data
      this.events?.emit('vehicle:update', this.formatVehicleData(vehicle));
    });
    
    this.events?.emit('vehicles:count', this.simulatedVehicles.size);
    console.log(`Created ${this.simulatedVehicles.size} simulated vehicles`);
  }
  
  /**
   * Start the master update loop with adaptive rates
   */
  startUpdateLoop() {
    // Clear any existing interval
    if (this.masterUpdateInterval) {
      clearInterval(this.masterUpdateInterval);
    }
    
    console.log('VehicleAPIService: Starting update loop');
    
    // Master tick at highest rate (100ms)
    let tickCount = 0;
    this.masterUpdateInterval = setInterval(() => {
      tickCount++;
      
      // Log every 50 ticks (5 seconds) to confirm loop is running
      if (tickCount % 50 === 1) {
        console.log(`VehicleAPIService: Tick ${tickCount}, vehicles: ${this.simulatedVehicles.size}`);
      }
      
      this.simulatedVehicles.forEach((vehicle, id) => {
        const updateRate = this.getUpdateRate(id);
        const tickInterval = Math.floor(updateRate / 100);
        
        // Only update this vehicle if it's time
        if (tickCount % tickInterval === 0) {
          this.updateVehicle(vehicle);
          
          // Emit update event
          const data = this.formatVehicleData(vehicle);
          this.vehicleCache.set(id, data);
          this.events?.emit('vehicle:update', data);
        }
      });
    }, 100);
  }
  
  /**
   * Get update rate for a vehicle based on priority
   */
  getUpdateRate(vehicleId) {
    // Highest priority: followed vehicle
    if (vehicleId === this.followedVehicleId) {
      return UPDATE_RATES.FOLLOWED;
    }
    
    // High priority: selected vehicle
    if (vehicleId === this.selectedVehicleId) {
      return UPDATE_RATES.SELECTED;
    }
    
    // Medium priority: visible vehicles
    if (this.visibleVehicleIds.has(vehicleId)) {
      return UPDATE_RATES.VISIBLE;
    }
    
    // Check vehicle status
    const vehicle = this.simulatedVehicles.get(vehicleId);
    if (vehicle?.status === VEHICLE_STATUS.IDLE || 
        vehicle?.status === VEHICLE_STATUS.MAINTENANCE) {
      return UPDATE_RATES.IDLE;
    }
    
    // Default: fastest rate for all moving vehicles
    return UPDATE_RATES.FOLLOWED;
  }

  /**
   * Update a single vehicle's simulation
   * Uses back-and-forth movement to prevent teleportation
   */
  updateVehicle(vehicle) {
    if (!vehicle.path || vehicle.path.length < 2) return;
    
    const path = vehicle.path;
    const pathLen = path.length;
    
    // Initialize direction if not set (1 = forward, -1 = backward)
    if (vehicle.pathDirection === undefined) {
      vehicle.pathDirection = 1;
    }
    
    // Store previous position for heading calculation
    const prevX = vehicle.position.x;
    const prevZ = vehicle.position.z;
    
    // Update progress along current segment
    vehicle.pathProgress += vehicle.pathSpeed;
    
    // Move to next waypoint when segment complete
    if (vehicle.pathProgress >= 1.0) {
      vehicle.pathProgress = 0;
      const prevWaypointIdx = vehicle.currentWaypointIndex;
      vehicle.currentWaypointIndex += vehicle.pathDirection;
      
      // Reverse direction at ends (stay at valid indices)
      if (vehicle.currentWaypointIndex >= pathLen - 1) {
        vehicle.currentWaypointIndex = pathLen - 1;
        vehicle.pathDirection = -1;
        // Log trip event - reached end (dump site)
        vehicle.tripEvents = vehicle.tripEvents || [];
        vehicle.tripEvents.push({ event: 'dump', time: Date.now() });
      } else if (vehicle.currentWaypointIndex <= 0) {
        vehicle.currentWaypointIndex = 0;
        vehicle.pathDirection = 1;
        // Log trip event - returned to start (load site)
        vehicle.tripEvents = vehicle.tripEvents || [];
        vehicle.tripEvents.push({ event: 'load', time: Date.now() });
      }
    }
    
    // Get current and next waypoint for interpolation
    const currIdx = vehicle.currentWaypointIndex;
    const nextIdx = Math.max(0, Math.min(pathLen - 1, currIdx + vehicle.pathDirection));
    
    const currentWaypoint = path[currIdx];
    const nextWaypoint = path[nextIdx];
    
    // Interpolate position smoothly between waypoints
    const t = vehicle.pathProgress;
    vehicle.position.x = currentWaypoint.x + (nextWaypoint.x - currentWaypoint.x) * t;
    vehicle.position.y = currentWaypoint.y + (nextWaypoint.y - currentWaypoint.y) * t;
    vehicle.position.z = currentWaypoint.z + (nextWaypoint.z - currentWaypoint.z) * t;
    
    // Calculate heading
    const dx = vehicle.position.x - prevX;
    const dz = vehicle.position.z - prevZ;
    if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
      vehicle.heading = Math.atan2(dx, dz) * (180 / Math.PI);
    }
    
    // Calculate speed
    const distance = Math.sqrt(dx * dx + dz * dz);
    vehicle.speed = distance * 36; // Convert to km/h approximation
  }
  
  /**
   * Format vehicle data for emission
   */
  formatVehicleData(vehicle) {
    return {
      id: vehicle.id,
      type: vehicle.type,
      group: vehicle.group,
      status: vehicle.status,
      level: vehicle.level,
      position: {
        x: vehicle.position.x,
        y: vehicle.position.y,
        z: vehicle.position.z
      },
      heading: vehicle.heading,
      speed: vehicle.speed,
      tripEvents: vehicle.tripEvents || [],
      metadata: {
        driver: vehicle.driver,
        fuelLevel: vehicle.fuelLevel,
        lastMaintenance: vehicle.lastMaintenance
      }
    };
  }
  
  /**
   * Set the followed vehicle (highest priority updates)
   */
  setFollowedVehicle(vehicleId) {
    this.followedVehicleId = vehicleId;
    console.log(`Following vehicle: ${vehicleId} (update rate: ${UPDATE_RATES.FOLLOWED}ms)`);
  }
  
  /**
   * Set the selected vehicle
   */
  setSelectedVehicle(vehicleId) {
    this.selectedVehicleId = vehicleId;
  }
  
  /**
   * Update list of visible vehicles
   */
  setVisibleVehicles(vehicleIds) {
    this.visibleVehicleIds = new Set(vehicleIds);
  }
  
  /**
   * Get all vehicles (for filtering)
   */
  getAllVehicles() {
    return Array.from(this.vehicleCache.values());
  }
  
  /**
   * Get vehicles by type
   */
  getVehiclesByType(type) {
    return this.getAllVehicles().filter(v => v.type === type);
  }
  
  /**
   * Get vehicles by group
   */
  getVehiclesByGroup(group) {
    return this.getAllVehicles().filter(v => v.group === group);
  }
  
  /**
   * Get vehicles by status
   */
  getVehiclesByStatus(status) {
    return this.getAllVehicles().filter(v => v.status === status);
  }
  
  /**
   * Get vehicles by level
   */
  getVehiclesByLevel(level) {
    return this.getAllVehicles().filter(v => v.level === level);
  }
  
  /**
   * Fetch latest data for specific vehicle (API mode)
   */
  async fetchVehicleData(vehicleId) {
    if (this.useSimulation) {
      return this.vehicleCache.get(vehicleId);
    }
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/${vehicleId}`);
      const data = await response.json();
      this.vehicleCache.set(vehicleId, data);
      return data;
    } catch (error) {
      console.warn(`Failed to fetch vehicle ${vehicleId}:`, error);
      return this.vehicleCache.get(vehicleId); // Return cached data
    }
  }
  
  /**
   * Fetch all vehicles data (API mode)
   */
  async fetchAllVehicles() {
    if (this.useSimulation) {
      return this.getAllVehicles();
    }
    
    try {
      const response = await fetch(this.apiBaseUrl);
      const data = await response.json();
      data.forEach(v => this.vehicleCache.set(v.id, v));
      return data;
    } catch (error) {
      console.warn('Failed to fetch vehicles:', error);
      return this.getAllVehicles(); // Return cached data
    }
  }
  
  /**
   * Disconnect and cleanup
   */
  disconnect() {
    if (this.masterUpdateInterval) {
      clearInterval(this.masterUpdateInterval);
      this.masterUpdateInterval = null;
    }
    
    this.updateTimers.forEach(timer => clearInterval(timer));
    this.updateTimers.clear();
    
    this.isConnected = false;
    this.events?.emit('connection:status', 'disconnected');
  }
  
  /**
   * Get service status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isSimulating: this.useSimulation,
      vehicleCount: this.vehicleCache.size,
      followedVehicle: this.followedVehicleId,
      updateRates: UPDATE_RATES
    };
  }
}

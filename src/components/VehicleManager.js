/**
 * VehicleManager - Vehicle Instance Management
 * 
 * Handles creation, updating, and management of all vehicle instances.
 * Implements smooth motion interpolation for real-time telemetry data.
 * 
 * Key features:
 * - Vehicle pooling for efficient object reuse
 * - Smooth position/rotation interpolation (lerp)
 * - Frame-rate independent updates
 * - Vehicle selection system
 * - Scalable to 50+ vehicles
 * - SPATIAL CONTAINMENT: Passes drivable volume to vehicles
 */

import * as THREE from 'three';
import { Vehicle } from './Vehicle.js';

export class VehicleManager {
  constructor(options = {}) {
    this.scene = options.scene;
    this.assetLoader = options.assetLoader;
    this.config = options.config || {};
    this.events = options.events;
    
    // Vehicle storage
    this.vehicles = new Map(); // id -> Vehicle instance
    this.vehicleModels = new Map(); // type -> GLTF model
    
    // Selection state
    this.selectedVehicleId = null;
    
    // Trail state
    this.trailsEnabled = false;
    
    // First-person view state
    this.fpvActive = false;
    this.fpvVehicleId = null;
    
    // Interpolation settings
    this.interpolationSpeed = this.config.interpolationSpeed || 5.0;
    this.rotationSpeed = this.config.rotationSpeed || 3.0;
    
    // CONTAINMENT: Reference to drivable volume
    this.drivableVolume = null;
  }
  
  /**
   * Set the drivable volume for spatial containment
   * All vehicles will be constrained to this volume
   * @param {DrivableVolume} volume - The containment volume
   */
  setDrivableVolume(volume) {
    this.drivableVolume = volume;
    
    // Update existing vehicles with the volume
    this.vehicles.forEach((vehicle) => {
      vehicle.setDrivableVolume(volume);
    });
    
    console.log('VehicleManager: Drivable volume set for containment');
  }
  
  /**
   * Preload all vehicle models defined in config
   */
  async preloadModels() {
    // Ensure types is an array
    let vehicleTypes = this.config.types;
    
    // Fallback to defaults if types is not a valid array
    if (!Array.isArray(vehicleTypes) || vehicleTypes.length === 0) {
      vehicleTypes = [
        { type: 'dump_truck', modelPath: '/models/vehicles/dumper_truck/dumper-truck.gltf' },
        { type: 'loader', modelPath: '/models/vehicles/dumper_truck/dumper-truck.gltf' },
        { type: 'haul_truck', modelPath: '/models/vehicles/dumper_truck/dumper-truck.gltf' }
      ];
    }
    
    console.log('Vehicle types to preload:', vehicleTypes);
    
    // Track loaded models by path to avoid duplicate loads
    const loadedByPath = new Map();
    
    // Load each vehicle type
    for (const vehicleType of vehicleTypes) {
      try {
        // Check if we already loaded this model path
        if (loadedByPath.has(vehicleType.modelPath)) {
          // Reuse the same GLTF for this vehicle type
          this.vehicleModels.set(vehicleType.type, loadedByPath.get(vehicleType.modelPath));
          console.log(`Reusing model for ${vehicleType.type} from ${vehicleType.modelPath}`);
          continue;
        }
        
        console.log(`Preloading vehicle model: ${vehicleType.type}`);
        const gltf = await this.assetLoader.loadGLTF(vehicleType.modelPath);
        
        // Store by type and track by path
        this.vehicleModels.set(vehicleType.type, gltf);
        loadedByPath.set(vehicleType.modelPath, gltf);
        console.log(`Loaded vehicle model: ${vehicleType.type}`);
      } catch (error) {
        console.warn(`Failed to load vehicle model: ${vehicleType.type}, using placeholder`, error);
        // Create a placeholder model
        this.vehicleModels.set(vehicleType.type, this.createPlaceholderModel(vehicleType.type));
      }
    }
    
    // Always have a default placeholder
    if (!this.vehicleModels.has('default')) {
      this.vehicleModels.set('default', this.createPlaceholderModel('default'));
    }
  }
  
  /**
   * Create a placeholder vehicle model (colored box)
   */
  createPlaceholderModel(type) {
    const colors = {
      'dump_truck': 0xff6600,
      'loader': 0x00ff66,
      'haul_truck': 0x6600ff,
      'default': 0xffff00
    };
    
    // Smaller sizes to fit inside cave tunnels
    const sizes = {
      'dump_truck': { width: 0.5, height: 0.4, depth: 0.8 },
      'loader': { width: 0.6, height: 0.45, depth: 0.7 },
      'haul_truck': { width: 0.7, height: 0.5, depth: 1.0 },
      'default': { width: 0.5, height: 0.35, depth: 0.7 }
    };
    
    const color = colors[type] || colors['default'];
    const size = sizes[type] || sizes['default'];
    
    // Create vehicle body with bright emissive for visibility through transparent model
    const bodyGeometry = new THREE.BoxGeometry(size.width, size.height, size.depth);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 1.0, // Maximum glow
      metalness: 0.3,
      roughness: 0.7
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = size.height / 2;
    
    // Create cab (front box)
    const cabGeometry = new THREE.BoxGeometry(size.width * 0.7, size.height * 0.6, size.depth * 0.25);
    const cabMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      emissive: 0x222222,
      emissiveIntensity: 0.5,
      metalness: 0.5,
      roughness: 0.5
    });
    const cab = new THREE.Mesh(cabGeometry, cabMaterial);
    cab.position.set(0, size.height * 0.4, size.depth * 0.35);
    
    // Create wheels (small to match vehicle)
    const wheelGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    
    const wheelPositions = [
      { x: -size.width/2 - 0.04, y: 0.1, z: size.depth * 0.3 },
      { x: size.width/2 + 0.04, y: 0.1, z: size.depth * 0.3 },
      { x: -size.width/2 - 0.04, y: 0.1, z: -size.depth * 0.3 },
      { x: size.width/2 + 0.04, y: 0.1, z: -size.depth * 0.3 },
    ];
    
    // Create group and orient vehicle correctly
    const group = new THREE.Group();
    group.add(body);
    group.add(cab);
    
    wheelPositions.forEach((pos) => {
      const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
      wheel.position.set(pos.x, pos.y, pos.z);
      wheel.rotation.z = Math.PI / 2;
      group.add(wheel);
    });
    
    // Wrap in GLTF-like structure
    return {
      scene: group,
      isPlaceholder: true
    };
  }
  
  /**
   * Update or create a vehicle from telemetry data
   */
  updateVehicle(data) {
    const { id, type, position, heading, speed, status, tripEvents } = data;
    
    // Debug log first few updates
    if (!this._updateCount) this._updateCount = 0;
    if (this._updateCount < 5) {
      console.log(`VehicleManager: Received update for ${id}:`, { position, heading, speed });
      this._updateCount++;
    }
    
    if (this.vehicles.has(id)) {
      // Update existing vehicle
      const vehicle = this.vehicles.get(id);
      vehicle.setTargetPosition(position);
      vehicle.setTargetHeading(heading);
      vehicle.setSpeed(speed);
      vehicle.setStatus(status);
      
      // Sync trip events from API
      if (tripEvents && tripEvents.length > vehicle.tripHistory.length) {
        // Add new events
        for (let i = vehicle.tripHistory.length; i < tripEvents.length; i++) {
          vehicle.tripHistory.push(tripEvents[i]);
        }
      }
    } else {
      // Create new vehicle
      console.log(`VehicleManager: Creating new vehicle ${id} at`, position);
      this.createVehicle(data);
    }
    
    // Update vehicle count in UI
    this.events?.emit('vehicles:count', this.vehicles.size);
    
    // Update selected vehicle info if this is the selected one
    if (id === this.selectedVehicleId) {
      const vehicle = this.vehicles.get(id);
      this.events?.emit('vehicle:selected', vehicle.getData(), vehicle.tripHistory);
    }
  }
  
  /**
   * Create a new vehicle instance
   */
  createVehicle(data) {
    const { id, type, position, heading, speed, status } = data;
    
    // Get or create model for this vehicle type
    const modelData = this.vehicleModels.get(type) || this.vehicleModels.get('default');
    
    // Clone the model
    const clonedModel = modelData.scene.clone();
    
    // Deep clone materials while preserving their original colors
    clonedModel.traverse((child) => {
      if (child.isMesh) {
        // Clone material and ensure color is preserved
        if (Array.isArray(child.material)) {
          child.material = child.material.map(mat => {
            const cloned = mat.clone();
            // Ensure the color is copied
            if (mat.color) cloned.color = mat.color.clone();
            return cloned;
          });
        } else {
          const cloned = child.material.clone();
          if (child.material.color) cloned.color = child.material.color.clone();
          child.material = cloned;
        }
      }
    });
    
    // Create a wrapper group for proper rotation handling
    const model = new THREE.Group();
    model.add(clonedModel);
    
    // Scale and position the model to fit inside tunnels
    if (!modelData.isPlaceholder) {
      const box = new THREE.Box3().setFromObject(clonedModel);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      
      // Target size: ~1.5 units (to fit in tunnels)
      const targetSize = 1.5;
      const scaleFactor = targetSize / maxDim;
      clonedModel.scale.setScalar(scaleFactor);
      
      // Rotate the inner model 180 degrees so front faces +Z (movement direction)
      clonedModel.rotation.y = Math.PI;
      
      // Center the model at its origin
      const center = box.getCenter(new THREE.Vector3());
      clonedModel.position.sub(center.multiplyScalar(scaleFactor));
      
      // Ensure it sits on the ground (adjust Y so bottom is at 0)
      const newBox = new THREE.Box3().setFromObject(clonedModel);
      clonedModel.position.y -= newBox.min.y;
    }
    
    // Create vehicle instance with drivable volume for containment
    const vehicle = new Vehicle({
      id,
      type,
      model,
      initialPosition: position,
      initialHeading: heading,
      speed,
      status,
      interpolationSpeed: this.interpolationSpeed,
      rotationSpeed: this.rotationSpeed,
      drivableVolume: this.drivableVolume  // CONTAINMENT: Pass volume reference
    });
    
    // Store reference
    this.vehicles.set(id, vehicle);
    
    // Add to scene
    this.scene.add(vehicle.mesh);
    
    // Enable trail if trails are globally enabled
    if (this.trailsEnabled) {
      vehicle.enableTrail(this.scene);
    }
    
    console.log(`Created vehicle: ${id} (${type})`);
    
    return vehicle;
  }
  
  /**
   * Remove a vehicle
   */
  removeVehicle(id) {
    const vehicle = this.vehicles.get(id);
    if (vehicle) {
      this.scene.remove(vehicle.mesh);
      vehicle.dispose();
      this.vehicles.delete(id);
      
      // Update count
      this.events?.emit('vehicles:count', this.vehicles.size);
      
      // Deselect if this was selected
      if (id === this.selectedVehicleId) {
        this.deselectVehicle();
      }
      
      console.log(`Removed vehicle: ${id}`);
    }
  }
  
  /**
   * Update all vehicles (call in render loop)
   */
  update(deltaTime) {
    this.vehicles.forEach((vehicle) => {
      vehicle.update(deltaTime);
    });
  }
  
  /**
   * Select a vehicle
   */
  selectVehicle(id) {
    // Deselect previous
    if (this.selectedVehicleId && this.selectedVehicleId !== id) {
      const prevVehicle = this.vehicles.get(this.selectedVehicleId);
      if (prevVehicle) {
        prevVehicle.setSelected(false);
      }
    }
    
    // Select new
    const vehicle = this.vehicles.get(id);
    if (vehicle) {
      vehicle.setSelected(true);
      this.selectedVehicleId = id;
      this.events?.emit('vehicle:selected', vehicle.getData(), vehicle.tripHistory);
    }
  }
  
  /**
   * Deselect current vehicle
   */
  deselectVehicle() {
    if (this.selectedVehicleId) {
      const vehicle = this.vehicles.get(this.selectedVehicleId);
      if (vehicle) {
        vehicle.setSelected(false);
      }
      this.selectedVehicleId = null;
      this.events?.emit('vehicle:deselected');
    }
  }
  
  /**
   * Get all vehicle meshes for raycasting
   */
  getSelectableMeshes() {
    const meshes = [];
    this.vehicles.forEach((vehicle) => {
      meshes.push(vehicle.mesh);
    });
    return meshes;
  }
  
  /**
   * Get vehicle by ID
   */
  getVehicle(id) {
    return this.vehicles.get(id);
  }
  
  /**
   * Get all vehicles
   */
  getAllVehicles() {
    return Array.from(this.vehicles.values());
  }
  
  /**
   * Get vehicle count
   */
  getCount() {
    return this.vehicles.size;
  }
  
  /**
   * Clean up all resources
   */
  dispose() {
    this.vehicles.forEach((vehicle, id) => {
      this.scene.remove(vehicle.mesh);
      vehicle.dispose();
    });
    this.vehicles.clear();
    this.vehicleModels.clear();
  }
  
  /**
   * Enable trails for all vehicles
   */
  enableAllTrails() {
    this.trailsEnabled = true;
    this.vehicles.forEach((vehicle) => {
      vehicle.enableTrail(this.scene);
    });
    console.log('Vehicle trails enabled');
  }
  
  /**
   * Disable trails for all vehicles
   */
  disableAllTrails() {
    this.trailsEnabled = false;
    this.vehicles.forEach((vehicle) => {
      vehicle.disableTrail();
    });
    console.log('Vehicle trails disabled');
  }
  
  /**
   * Toggle trails for all vehicles
   */
  toggleTrails() {
    if (this.trailsEnabled) {
      this.disableAllTrails();
    } else {
      this.enableAllTrails();
    }
    return this.trailsEnabled;
  }
  
  /**
   * Enable trail for a specific vehicle
   */
  enableVehicleTrail(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    if (vehicle) {
      vehicle.enableTrail(this.scene);
    }
  }
  
  /**
   * Clear all vehicle trails
   */
  clearAllTrails() {
    this.vehicles.forEach((vehicle) => {
      vehicle.clearTrail();
    });
  }
  
  /**
   * Get vehicle cabin position for FPV
   */
  getVehicleCabinPosition(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return null;
    return vehicle.getCabinPosition();
  }
  
  /**
   * Get vehicle forward direction for FPV
   */
  getVehicleForwardDirection(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return null;
    return vehicle.getForwardDirection();
  }
}

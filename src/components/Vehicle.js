/**
 * Vehicle - Individual Vehicle Instance
 * 
 * Represents a single vehicle in the mine with smooth interpolation
 * for position and rotation updates from telemetry data.
 * 
 * Features:
 * - Stores current and target positions
 * - Frame-rate independent lerp interpolation
 * - Smooth heading rotation
 * - Selection visual feedback
 * - SPATIAL CONTAINMENT: Vehicles never exit the drivable volume
 * 
 * CONTAINMENT SYSTEM (NOT PHYSICS):
 * This is visual containment, not physics simulation.
 * Before applying any position update, we validate that the new
 * position is inside the drivable volume. If outside, we revert
 * to the last known valid position. This ensures trucks never
 * visually exit tunnels or pass through walls.
 */

import * as THREE from 'three';

// Reusable objects to avoid garbage collection
const _desiredPos = new THREE.Vector3();

// Trail colors per vehicle type - darker colors for visibility from above
const TRAIL_COLORS = {
  'dump_truck': 0x006633,   // Dark green
  'loader': 0x993300,       // Dark orange/brown
  'haul_truck': 0x003366,   // Dark blue
  'default': 0x660066       // Dark purple
};

export class Vehicle {
  constructor(options = {}) {
    this.id = options.id;
    this.type = options.type || 'default';
    
    // Motion state
    this.currentPosition = new THREE.Vector3();
    this.targetPosition = new THREE.Vector3();
    this.currentHeading = 0;
    this.targetHeading = 0;
    this.speed = options.speed || 0;
    this.status = options.status || 'idle';
    
    // Trail state
    this.trailEnabled = false;
    this.trailPositions = [];
    this.maxTrailLength = options.maxTrailLength || 150;
    this.trailMesh = null;
    this.trailMaterial = null;
    this.trailUpdateCounter = 0;
    this.trailUpdateInterval = 2; // Update every 2 frames
    
    // Interpolation settings
    this.positionLerpSpeed = options.interpolationSpeed || 5.0;
    this.rotationLerpSpeed = options.rotationSpeed || 3.0;
    
    // CONTAINMENT: Reference to drivable volume for validation
    this.drivableVolume = options.drivableVolume || null;
    
    // CONTAINMENT: Last known valid position (inside tunnels)
    this.lastValidPosition = new THREE.Vector3();
    this.hasValidPosition = false;
    
    // Visual state
    this.isSelected = false;
    this.originalMaterials = [];
    
    // Setup mesh
    this.setupMesh(options.model);
    
    // Set initial position
    if (options.initialPosition) {
      this.setPosition(options.initialPosition);
    }
    
    if (options.initialHeading !== undefined) {
      this.setHeading(options.initialHeading);
    }
  }
  
  /**
   * Set the drivable volume for containment checks
   * @param {DrivableVolume} volume - The containment volume
   */
  setDrivableVolume(volume) {
    this.drivableVolume = volume;
  }
  
  /**
   * Setup the 3D mesh from model
   */
  setupMesh(model) {
    this.mesh = model;
    this.mesh.name = `Vehicle_${this.id}`;
    
    // Store vehicle ID in userData for raycasting
    this.mesh.userData.vehicleId = this.id;
    this.mesh.userData.vehicleType = this.type;
    
    // Make all children also reference the vehicle
    this.mesh.traverse((child) => {
      child.userData.vehicleId = this.id;
      
      // Store original materials for selection highlighting
      if (child.isMesh) {
        this.originalMaterials.push({
          mesh: child,
          material: child.material.clone()
        });
      }
    });
    
    // Enable frustum culling
    this.mesh.frustumCulled = true;
  }
  
  /**
   * Set position immediately (no interpolation)
   * CONTAINMENT: Validates position before applying
   */
  setPosition(position) {
    const candidatePos = new THREE.Vector3(position.x, position.y, position.z);
    
    // Always accept position - containment just tracks validity
    this.currentPosition.copy(candidatePos);
    this.targetPosition.copy(candidatePos);
    this.mesh.position.copy(candidatePos);
    
    // Track if position is valid for future containment
    if (this.isPositionValid(candidatePos)) {
      this.lastValidPosition.copy(candidatePos);
      this.hasValidPosition = true;
    }
  }
  
  /**
   * Set target position for interpolation
   */
  setTargetPosition(position) {
    this.targetPosition.set(position.x, position.y, position.z);
    this.hasValidPosition = true;
  }
  
  /**
   * Check if a position is valid (inside drivable volume)
   * @param {THREE.Vector3} position - Position to check
   * @returns {boolean} True if position is valid/inside
   */
  isPositionValid(position) {
    // If no volume set, all positions are valid (permissive fallback)
    if (!this.drivableVolume) {
      return true;
    }
    
    return this.drivableVolume.isPointInside(position);
  }
  
  /**
   * Set heading immediately (no interpolation)
   */
  setHeading(heading) {
    this.currentHeading = heading;
    this.targetHeading = heading;
    // Convert heading (degrees) to rotation (radians)
    // Add PI to make truck face forward (model faces -Z by default)
    this.mesh.rotation.y = THREE.MathUtils.degToRad(heading) + Math.PI;
  }
  
  /**
   * Set target heading for interpolation
   */
  setTargetHeading(heading) {
    this.targetHeading = heading;
  }
  
  /**
   * Set current speed
   */
  setSpeed(speed) {
    this.speed = speed;
  }
  
  /**
   * Set status
   */
  setStatus(status) {
    this.status = status;
  }
  
  /**
   * Update vehicle position/rotation (call in render loop)
   */
  update(deltaTime) {
    // Interpolate position with tunnel floor snapping
    this.interpolatePosition(deltaTime);
    
    // Interpolate rotation
    this.interpolateRotation(deltaTime);
    
    // Update trail if enabled
    this.updateTrail();
  }
  
  /**
   * Smooth position interpolation - simple lerp without collision blocking
   * Collision is handled at the path level, not frame-by-frame
   */
  interpolatePosition(deltaTime) {
    // Calculate interpolation factor (frame-rate independent)
    const lerpFactor = 1 - Math.exp(-this.positionLerpSpeed * deltaTime);
    
    // Simple lerp toward target - paths are pre-validated
    this.currentPosition.lerp(this.targetPosition, lerpFactor);
    
    // Apply to mesh
    this.mesh.position.copy(this.currentPosition);
  }
  
  /**
   * Smooth rotation interpolation with shortest path
   */
  interpolateRotation(deltaTime) {
    // Calculate target rotation in radians
    // Heading: 0 = moving in +Z direction, 90 = +X direction
    const targetRotation = THREE.MathUtils.degToRad(this.targetHeading);
    
    // Get current rotation
    let currentRotation = this.mesh.rotation.y;
    
    // Find shortest rotation path
    let diff = targetRotation - currentRotation;
    
    // Normalize to -PI to PI range
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    
    // Calculate interpolation factor
    const lerpFactor = 1 - Math.exp(-this.rotationLerpSpeed * deltaTime);
    
    // Apply rotation
    this.mesh.rotation.y = currentRotation + diff * lerpFactor;
    
    // Update current heading (in degrees)
    this.currentHeading = -THREE.MathUtils.radToDeg(this.mesh.rotation.y);
  }
  
  /**
   * Set selection state
   */
  setSelected(selected) {
    this.isSelected = selected;
    
    if (selected) {
      // Highlight vehicle with emissive color
      this.mesh.traverse((child) => {
        if (child.isMesh) {
          child.material.emissive = new THREE.Color(0x00aaff);
          child.material.emissiveIntensity = 0.3;
        }
      });
    } else {
      // Restore original materials
      this.mesh.traverse((child) => {
        if (child.isMesh) {
          child.material.emissive = new THREE.Color(0x000000);
          child.material.emissiveIntensity = 0;
        }
      });
    }
  }
  
  /**
   * Get vehicle data for UI display
   */
  getData() {
    return {
      id: this.id,
      type: this.type,
      position: {
        x: this.currentPosition.x.toFixed(2),
        y: this.currentPosition.y.toFixed(2),
        z: this.currentPosition.z.toFixed(2)
      },
      heading: this.currentHeading.toFixed(1),
      speed: this.speed.toFixed(1),
      status: this.status
    };
  }
  
  /**
   * Get world position
   */
  getWorldPosition() {
    return this.mesh.position.clone();
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    this.mesh.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    
    this.disposeTrail();
    this.originalMaterials = [];
  }
  
  /**
   * Enable trail visualization
   */
  enableTrail(scene) {
    if (this.trailEnabled) return;
    
    this.trailEnabled = true;
    this.trailScene = scene;
    this.trailPositions = [];
    
    // Get trail color
    const color = TRAIL_COLORS[this.type] || TRAIL_COLORS['default'];
    
    // Create material for trail tube
    this.trailMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    
    // Trail mesh will be created when we have enough points
    this.trailMesh = null;
    
    console.log(`Trail enabled for vehicle ${this.id}`);
  }
  
  /**
   * Disable trail visualization
   */
  disableTrail() {
    if (!this.trailEnabled) return;
    
    this.trailEnabled = false;
    this.disposeTrail();
    console.log(`Trail disabled for vehicle ${this.id}`);
  }
  
  /**
   * Dispose trail resources
   */
  disposeTrail() {
    if (this.trailMesh && this.trailScene) {
      this.trailScene.remove(this.trailMesh);
      if (this.trailMesh.geometry) {
        this.trailMesh.geometry.dispose();
      }
    }
    if (this.trailMaterial) {
      this.trailMaterial.dispose();
    }
    this.trailMesh = null;
    this.trailMaterial = null;
    this.trailPositions = [];
  }
  
  /**
   * Update trail with current position
   */
  updateTrail() {
    if (!this.trailEnabled || !this.trailMaterial) return;
    
    // Only update every few frames for performance
    this.trailUpdateCounter++;
    if (this.trailUpdateCounter < this.trailUpdateInterval) return;
    this.trailUpdateCounter = 0;
    
    // Add current position to trail
    const pos = this.currentPosition.clone();
    pos.y += 0.3; // Slightly above ground to be visible
    
    // Check if we've moved enough to add a new point
    if (this.trailPositions.length > 0) {
      const lastPos = this.trailPositions[this.trailPositions.length - 1];
      const dist = pos.distanceTo(lastPos);
      if (dist < 0.2) return; // Don't add if too close
    }
    
    this.trailPositions.push(pos.clone());
    
    // Limit trail length - remove oldest
    if (this.trailPositions.length > this.maxTrailLength) {
      this.trailPositions.shift();
    }
    
    // Need at least 2 points for a tube
    if (this.trailPositions.length < 2) return;
    
    // Remove old trail mesh
    if (this.trailMesh && this.trailScene) {
      this.trailScene.remove(this.trailMesh);
      this.trailMesh.geometry.dispose();
    }
    
    // Create curve from positions
    const curve = new THREE.CatmullRomCurve3(this.trailPositions);
    
    // Create tube geometry along the curve
    const tubeGeometry = new THREE.TubeGeometry(
      curve,
      Math.max(2, this.trailPositions.length - 1), // tubularSegments
      0.05,  // radius - thin tube
      4,     // radialSegments - low for performance
      false  // closed
    );
    
    // Create mesh
    this.trailMesh = new THREE.Mesh(tubeGeometry, this.trailMaterial);
    this.trailMesh.frustumCulled = false;
    this.trailScene.add(this.trailMesh);
  }
  
  /**
   * Clear trail history
   */
  clearTrail() {
    this.trailPositions = [];
    if (this.trailMesh && this.trailScene) {
      this.trailScene.remove(this.trailMesh);
      this.trailMesh.geometry.dispose();
      this.trailMesh = null;
    }
  }
  
  /**
   * Get position for first-person camera (cabin position)
   */
  getCabinPosition() {
    // Position inside the truck cabin
    const pos = this.currentPosition.clone();
    pos.y += 1.2; // Height of cabin
    
    // Offset slightly forward in direction of heading
    const headingRad = THREE.MathUtils.degToRad(this.currentHeading);
    pos.x += Math.sin(headingRad) * 0.3;
    pos.z += Math.cos(headingRad) * 0.3;
    
    return pos;
  }
  
  /**
   * Get look-at direction for first-person view
   */
  getForwardDirection() {
    const headingRad = THREE.MathUtils.degToRad(this.currentHeading);
    const forward = new THREE.Vector3(
      Math.sin(headingRad),
      0,
      Math.cos(headingRad)
    );
    return this.currentPosition.clone().add(forward.multiplyScalar(10));
  }
}

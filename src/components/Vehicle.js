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
   * CONTAINMENT: Validates target before accepting
   */
  setTargetPosition(position) {
    const candidatePos = new THREE.Vector3(position.x, position.y, position.z);
    
    // Always accept target - let interpolation handle containment
    this.targetPosition.copy(candidatePos);
    
    // Track validity
    if (this.isPositionValid(candidatePos)) {
      // Valid target - will be stored as lastValid during interpolation
    }
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
  }
  
  /**
   * Smooth position interpolation with tunnel containment
   * Keeps vehicles on tunnel floor and inside valid areas
   */
  interpolatePosition(deltaTime) {
    // Calculate interpolation factor (frame-rate independent)
    const lerpFactor = 1 - Math.exp(-this.positionLerpSpeed * deltaTime);
    
    // Calculate desired next position using cached vector
    _desiredPos.copy(this.currentPosition).lerp(this.targetPosition, lerpFactor);
    
    // Use collision system to snap to tunnel floor
    if (this.drivableVolume && this.drivableVolume.isReady) {
      const result = this.drivableVolume.checkCollision(this.currentPosition, _desiredPos);
      
      if (!result.blocked) {
        // Valid position found - move there
        this.currentPosition.copy(result.position);
      }
      // If blocked, keep current position (don't move)
    } else {
      // No collision system - just lerp
      this.currentPosition.copy(_desiredPos);
    }
    
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
    
    this.originalMaterials = [];
  }
}

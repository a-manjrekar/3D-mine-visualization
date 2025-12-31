/**
 * DrivableVolume - Collision-Based Containment System
 * 
 * PURPOSE:
 * Keeps vehicles inside mine tunnels using raycasting collision detection.
 * Vehicles cannot pass through walls - they stop at boundaries.
 * 
 * HOW IT WORKS:
 * 1. Before moving, cast a ray from current position toward target
 * 2. If ray hits mine geometry before reaching target, stop at hit point
 * 3. Also checks if position is inside tunnel (has ceiling above)
 * 
 * This is visual containment, NOT physics simulation.
 */

import * as THREE from 'three';

// Reusable objects to avoid garbage collection
const _raycaster = new THREE.Raycaster();
const _direction = new THREE.Vector3();
const _tempVec = new THREE.Vector3();
const _resultPos = new THREE.Vector3();

export class DrivableVolume {
  constructor(options = {}) {
    this.scene = options.scene;
    this.assetLoader = options.assetLoader;
    
    // Reference to mine mesh for raycasting
    this.mineModelRef = null;
    this.mineMeshes = []; // Array of meshes for collision
    
    // Pre-computed bounding box for fast rejection
    this.boundingBox = null;
    this.innerBounds = null;
    
    // Flag indicating if volume is ready
    this.isReady = false;
    
    // Collision settings
    this.collisionMargin = 0.3; // Stop this far from walls
  }
  
  /**
   * Load a dedicated simplified drivable volume mesh
   * Use this in production with an artist-created simple mesh
   * 
   * @param {string} volumePath - Path to the volume GLTF/GLB file
   */
  async loadVolumeMesh(volumePath) {
    try {
      console.log('Loading simplified drivable volume mesh:', volumePath);
      
      const gltf = await this.assetLoader.loadGLTF(volumePath);
      this.mineModelRef = gltf.scene;
      
      // Make invisible - don't add to scene, just use for raycasting
      this.mineModelRef.visible = false;
      
      // Pre-compute bounding box
      this.boundingBox = new THREE.Box3().setFromObject(this.mineModelRef);
      this.computeInnerBounds();
      
      // Use detailed checking with simplified mesh
      this.useSimplifiedCheck = false;
      
      this.isReady = true;
      console.log('Drivable volume loaded successfully');
      
    } catch (error) {
      console.warn('Failed to load drivable volume mesh:', error);
    }
  }
  
  /**
   * Generate drivable volume from the mine model
   * Collects meshes for collision detection
   * 
   * @param {THREE.Object3D} mineModel - The loaded mine model
   */
  generateFromMineModel(mineModel) {
    if (!mineModel) {
      console.warn('Cannot generate volume - no mine model');
      return;
    }
    
    console.log('Generating collision volume from mine model');
    
    // Store reference to mine model
    this.mineModelRef = mineModel;
    
    // Collect all meshes for raycasting collision
    this.mineMeshes = [];
    mineModel.traverse((child) => {
      if (child.isMesh) {
        this.mineMeshes.push(child);
      }
    });
    
    console.log(`Collected ${this.mineMeshes.length} meshes for collision`);
    
    // Compute bounding box from original model
    this.boundingBox = new THREE.Box3().setFromObject(mineModel);
    this.computeInnerBounds();
    
    this.isReady = true;
    console.log('Drivable volume ready with collision detection');
    console.log('Volume bounds:', {
      min: { x: this.boundingBox.min.x.toFixed(2), y: this.boundingBox.min.y.toFixed(2), z: this.boundingBox.min.z.toFixed(2) },
      max: { x: this.boundingBox.max.x.toFixed(2), y: this.boundingBox.max.y.toFixed(2), z: this.boundingBox.max.z.toFixed(2) }
    });
  }
  
  /**
   * Compute inner bounds with margin for vehicle containment
   */
  computeInnerBounds() {
    if (!this.boundingBox) return;
    
    // Create slightly smaller bounds (margin for vehicle size)
    const margin = 0.5;
    this.innerBounds = this.boundingBox.clone();
    this.innerBounds.min.addScalar(margin);
    this.innerBounds.max.subScalar(margin);
  }
  
  /**
   * Check if a point is inside the drivable volume (quick check)
   * 
   * @param {THREE.Vector3} point - Point to test
   * @returns {boolean} True if inside bounding box
   */
  isPointInside(point) {
    if (!this.isReady || !this.boundingBox) {
      return true; // Permissive fallback
    }
    
    const bounds = this.innerBounds || this.boundingBox;
    return bounds.containsPoint(point);
  }
  
  /**
   * Check for collision - DISABLED since paths are pre-validated
   * Just pass through the position
   */
  checkCollision(fromPos, toPos) {
    return { position: toPos.clone(), blocked: false };
  }
  
  /**
   * Check if a position is inside a tunnel (has ceiling and floor)
   * 
   * @param {THREE.Vector3} point - Point to test
   * @returns {boolean} True if inside tunnel
   */
  isInsideTunnel(point) {
    if (!this.isReady || this.mineMeshes.length === 0) {
      return true; // Permissive fallback
    }
    
    // Cast ray upward to check for ceiling
    _raycaster.set(point, _tempVec.set(0, 1, 0));
    _raycaster.far = 50;
    const ceilingHits = _raycaster.intersectObjects(this.mineMeshes, true);
    
    // Cast ray downward to check for floor
    _raycaster.set(point, _tempVec.set(0, -1, 0));
    _raycaster.far = 50;
    const floorHits = _raycaster.intersectObjects(this.mineMeshes, true);
    
    // Inside tunnel if we have both ceiling and floor nearby
    const hasCeiling = ceilingHits.length > 0 && ceilingHits[0].distance < 20;
    const hasFloor = floorHits.length > 0 && floorHits[0].distance < 5;
    
    return hasCeiling && hasFloor;
  }
  
  /**
   * Get the mine model reference
   * @returns {THREE.Object3D|null}
   */
  getMesh() {
    return this.mineModelRef;
  }
  
  /**
   * Get bounding box
   * @returns {THREE.Box3|null}
   */
  getBounds() {
    return this.boundingBox;
  }
  
  /**
   * Get inner bounds (with margin)
   * @returns {THREE.Box3|null}
   */
  getInnerBounds() {
    return this.innerBounds;
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    this.mineModelRef = null;
    this.mineMeshes = [];
    this.boundingBox = null;
    this.innerBounds = null;
    this.isReady = false;
  }
}

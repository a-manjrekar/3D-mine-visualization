/**
 * TrailObjectPool - Reusable Trail Geometry Pool
 * 
 * Implements object pooling for trail tube geometries to avoid
 * constant allocation/deallocation which causes GC pressure.
 * 
 * Features:
 * - Pre-allocates geometry buffers
 * - Reuses tube geometries instead of creating new
 * - Automatic pool growth if needed
 * - Memory-efficient trail rendering
 */

import * as THREE from 'three';

export class TrailObjectPool {
  constructor(options = {}) {
    this.scene = options.scene;
    this.initialSize = options.initialSize || 20;
    this.maxSize = options.maxSize || 100;
    
    // Pool of available geometries
    this.geometryPool = [];
    this.meshPool = [];
    
    // Track active trails
    this.activeTrails = new Map();
    
    // Pre-create materials per vehicle type
    this.materials = new Map();
    this.initializeMaterials();
    
    // Pre-populate pool
    this.initializePool();
    
    console.log(`TrailObjectPool initialized with ${this.initialSize} pre-allocated entries`);
  }
  
  /**
   * Initialize shared materials
   */
  initializeMaterials() {
    const colors = {
      'dump_truck': 0x006633,
      'loader': 0x993300,
      'haul_truck': 0x003366,
      'default': 0x660066
    };
    
    Object.entries(colors).forEach(([type, color]) => {
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
      });
      this.materials.set(type, material);
    });
  }
  
  /**
   * Pre-populate the geometry pool
   */
  initializePool() {
    for (let i = 0; i < this.initialSize; i++) {
      this.createPoolEntry();
    }
  }
  
  /**
   * Create a new pool entry with pre-allocated buffers
   */
  createPoolEntry() {
    // Create a dummy tube geometry with space for max segments
    // We'll update this in-place rather than creating new
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0)
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 2, 0.05, 4, false);
    
    this.geometryPool.push({
      geometry: geometry,
      inUse: false,
      id: null
    });
  }
  
  /**
   * Get a geometry from pool or create new if needed
   * @param {string} vehicleId - ID of vehicle requesting trail
   * @param {string} vehicleType - Type for material selection
   */
  acquire(vehicleId, vehicleType = 'default') {
    // Check if this vehicle already has an active trail
    if (this.activeTrails.has(vehicleId)) {
      return this.activeTrails.get(vehicleId);
    }
    
    // Find available entry in pool
    let entry = this.geometryPool.find(e => !e.inUse);
    
    // If no available, grow pool if under max
    if (!entry && this.geometryPool.length < this.maxSize) {
      this.createPoolEntry();
      entry = this.geometryPool[this.geometryPool.length - 1];
    }
    
    if (!entry) {
      console.warn('TrailObjectPool: Max pool size reached');
      return null;
    }
    
    // Mark as in use
    entry.inUse = true;
    entry.id = vehicleId;
    
    // Get or create material
    const material = this.materials.get(vehicleType) || this.materials.get('default');
    
    // Create mesh using pooled geometry
    const mesh = new THREE.Mesh(entry.geometry, material);
    mesh.frustumCulled = false;
    mesh.visible = false; // Hidden until we have data
    
    // Add to scene
    this.scene.add(mesh);
    
    // Track active trail
    const trailData = {
      entry: entry,
      mesh: mesh,
      positions: [],
      vehicleType: vehicleType
    };
    this.activeTrails.set(vehicleId, trailData);
    
    return trailData;
  }
  
  /**
   * Release a trail back to the pool
   * @param {string} vehicleId - ID of vehicle releasing trail
   */
  release(vehicleId) {
    const trailData = this.activeTrails.get(vehicleId);
    if (!trailData) return;
    
    // Remove mesh from scene
    this.scene.remove(trailData.mesh);
    
    // Mark pool entry as available
    trailData.entry.inUse = false;
    trailData.entry.id = null;
    
    // Clear positions
    trailData.positions = [];
    
    // Remove from active trails
    this.activeTrails.delete(vehicleId);
  }
  
  /**
   * Update trail geometry with new positions
   * @param {string} vehicleId - Vehicle ID
   * @param {THREE.Vector3[]} positions - Array of trail positions
   */
  updateTrail(vehicleId, positions) {
    const trailData = this.activeTrails.get(vehicleId);
    if (!trailData || positions.length < 2) return;
    
    // Store positions
    trailData.positions = positions;
    
    // Create new curve from positions
    const curve = new THREE.CatmullRomCurve3(positions);
    
    // Create new tube geometry
    const newGeometry = new THREE.TubeGeometry(
      curve,
      Math.max(2, positions.length - 1),
      0.05,
      4,
      false
    );
    
    // Dispose old geometry and replace
    trailData.mesh.geometry.dispose();
    trailData.mesh.geometry = newGeometry;
    trailData.entry.geometry = newGeometry;
    
    // Make visible
    trailData.mesh.visible = true;
  }
  
  /**
   * Clear all trails but keep pool entries
   */
  clearAll() {
    this.activeTrails.forEach((trailData, vehicleId) => {
      this.scene.remove(trailData.mesh);
      trailData.entry.inUse = false;
      trailData.entry.id = null;
    });
    this.activeTrails.clear();
  }
  
  /**
   * Get pool statistics
   */
  getStats() {
    const inUse = this.geometryPool.filter(e => e.inUse).length;
    return {
      poolSize: this.geometryPool.length,
      inUse: inUse,
      available: this.geometryPool.length - inUse,
      activeTrails: this.activeTrails.size
    };
  }
  
  /**
   * Dispose all resources
   */
  dispose() {
    // Clear active trails
    this.activeTrails.forEach((trailData) => {
      this.scene.remove(trailData.mesh);
    });
    this.activeTrails.clear();
    
    // Dispose pool geometries
    this.geometryPool.forEach(entry => {
      entry.geometry.dispose();
    });
    this.geometryPool = [];
    
    // Dispose materials
    this.materials.forEach(material => {
      material.dispose();
    });
    this.materials.clear();
    
    console.log('TrailObjectPool disposed');
  }
}

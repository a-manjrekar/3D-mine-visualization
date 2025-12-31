/**
 * MineEnvironment - Underground Mine Model Manager
 * 
 * Handles loading and configuration of the main mine GLTF model.
 * Implements coordinate alignment to match real-world mine origin.
 * 
 * Key features:
 * - Loads large GLTF mine models
 * - Configurable origin offset for coordinate alignment
 * - Semi-transparent material for vehicle visibility (50% opacity)
 * - Frustum culling optimization
 */

import * as THREE from 'three';

export class MineEnvironment {
  constructor(options = {}) {
    this.scene = options.scene;
    this.assetLoader = options.assetLoader;
    this.config = options.config || {};
    
    this.model = null;
    this.isLoaded = false;
  }
  
  /**
   * Load the mine environment model
   * @param {string} modelPath - Path to the GLTF/GLB file
   */
  async load(modelPath) {
    try {
      console.log('Loading mine environment:', modelPath);
      
      // Load the GLTF model
      const gltf = await this.assetLoader.loadGLTF(modelPath, (progress) => {
        console.log(`Loading mine: ${progress.toFixed(1)}%`);
      });
      
      this.model = gltf.scene;
      this.model.name = 'MineEnvironment';
      
      // Apply coordinate alignment
      this.applyOriginOffset();
      
      // Configure materials for transparency (50% opacity)
      this.configureMaterials();
      
      // Optimize for rendering
      this.optimizeModel();
      
      // Add to scene
      this.scene.add(this.model);
      
      // Calculate and log bounding box for debugging
      const box = new THREE.Box3().setFromObject(this.model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      console.log('Mine bounding box:', {
        min: { x: box.min.x.toFixed(2), y: box.min.y.toFixed(2), z: box.min.z.toFixed(2) },
        max: { x: box.max.x.toFixed(2), y: box.max.y.toFixed(2), z: box.max.z.toFixed(2) },
        size: { x: size.x.toFixed(2), y: size.y.toFixed(2), z: size.z.toFixed(2) },
        center: { x: center.x.toFixed(2), y: center.y.toFixed(2), z: center.z.toFixed(2) }
      });
      
      // Store bounds for vehicle constraint
      this.bounds = box;
      this.center = center;
      
      this.isLoaded = true;
      console.log('Mine environment loaded successfully');
      
      return this.model;
      
    } catch (error) {
      console.error('Failed to load mine environment:', error);
      throw error;
    }
  }
  
  /**
   * Apply coordinate alignment based on real-world origin
   * This ensures the mine model's reference point aligns with Three.js (0,0,0)
   */
  applyOriginOffset() {
    // Get origin from config (real-world coordinates of mine origin)
    const origin = this.config.origin || { x: 0, y: 0, z: 0 };
    
    // Offset the model so real-world origin aligns with (0,0,0)
    // mine.position = (-origin.x, -origin.y, -origin.z)
    this.model.position.set(
      -origin.x,
      -origin.y,
      -origin.z
    );
    
    console.log(`Mine origin offset applied: (${-origin.x}, ${-origin.y}, ${-origin.z})`);
  }
  
  /**
   * Configure materials for underground appearance with transparency
   * Applies different colors to different regions of the mine using vertex colors
   * This ensures proper color boundaries with no overlapping
   */
  configureMaterials() {
    // First pass: calculate bounds to determine regions
    const bounds = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(center);
    
    // Region color palette - visually distinct colors matching location markers
    const regionColors = [
      new THREE.Color(0x4CAF50), // Green - Entry area (matches Main Entry marker)
      new THREE.Color(0xFF9800), // Orange - Loading zone (matches Loading Bay marker)
      new THREE.Color(0xF44336), // Red - Extraction area (matches Extraction Zone marker)
      new THREE.Color(0x00BCD4), // Cyan - Ventilation (matches Ventilation Shaft marker)
      new THREE.Color(0x9C27B0), // Purple - Deep tunnels
      new THREE.Color(0x2196F3), // Blue - Storage/transit areas
      new THREE.Color(0xFFEB3B), // Yellow - Caution zones
      new THREE.Color(0x795548), // Brown - Rock face areas
    ];
    
    // Store min bounds for region calculation
    const minBounds = bounds.min.clone();
    
    this.model.traverse((child) => {
      if (child.isMesh) {
        // Update world matrix to get accurate vertex positions
        child.updateMatrixWorld(true);
        
        // Apply vertex colors for per-vertex region coloring (no overlap)
        this.applyVertexColors(child, minBounds, size, regionColors);
        
        // Handle material (can be single or array)
        const materials = Array.isArray(child.material) 
          ? child.material 
          : [child.material];
        
        materials.forEach((material, index) => {
          // Clone material to avoid affecting other meshes
          const newMaterial = material.clone();
          
          // Enable vertex colors for proper region coloring
          newMaterial.vertexColors = true;
          
          // Enable transparency with 50% opacity for vehicle visibility
          newMaterial.transparent = true;
          newMaterial.opacity = 0.5;
          
          // Set base color to white so vertex colors show properly
          newMaterial.color = new THREE.Color(0xffffff);
          
          // Ensure proper depth handling for transparent objects
          newMaterial.depthWrite = true;
          newMaterial.depthTest = true;
          
          // Enable double-sided rendering for caves
          newMaterial.side = THREE.DoubleSide;
          
          // Reduce metalness for rock appearance
          if (newMaterial.metalness !== undefined) {
            newMaterial.metalness = 0.1;
          }
          
          // Increase roughness for rock texture
          if (newMaterial.roughness !== undefined) {
            newMaterial.roughness = 0.85;
          }
          
          // Disable emissive (vertex colors handle brightness)
          if (newMaterial.emissive) {
            newMaterial.emissive.setHex(0x000000);
          }
          
          // Replace material
          if (Array.isArray(child.material)) {
            child.material[index] = newMaterial;
          } else {
            child.material = newMaterial;
          }
        });
        
        // Enable frustum culling for performance
        child.frustumCulled = true;
        
        // Receive shadows (but don't cast - too expensive)
        child.receiveShadow = false;
        child.castShadow = false;
      }
    });
    
    console.log('Mine materials configured with vertex-based regional colors');
  }
  
  /**
   * Apply vertex colors to a mesh based on each vertex's world position
   * This ensures clean color boundaries with no overlapping
   */
  applyVertexColors(mesh, minBounds, size, colors) {
    const geometry = mesh.geometry;
    const positions = geometry.attributes.position;
    const vertexCount = positions.count;
    
    // Create color attribute array (RGB for each vertex)
    const colorArray = new Float32Array(vertexCount * 3);
    
    // Temp vectors for position calculation
    const localPos = new THREE.Vector3();
    const worldPos = new THREE.Vector3();
    
    for (let i = 0; i < vertexCount; i++) {
      // Get vertex position in local space
      localPos.fromBufferAttribute(positions, i);
      
      // Transform to world space
      worldPos.copy(localPos).applyMatrix4(mesh.matrixWorld);
      
      // Calculate region color based on world position
      const color = this.getRegionColor(worldPos, minBounds, size, colors);
      
      // Store RGB values in color array
      colorArray[i * 3] = color.r;
      colorArray[i * 3 + 1] = color.g;
      colorArray[i * 3 + 2] = color.b;
    }
    
    // Add or update color attribute
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
  }
  
  /**
   * Determine color based on mesh position within the mine
   * Uses discrete regions with no overlap
   */
  getRegionColor(worldPosition, minBounds, size, colors) {
    // Normalize position to 0-1 range within bounds
    const normalizedX = Math.max(0, Math.min(1, (worldPosition.x - minBounds.x) / size.x));
    const normalizedZ = Math.max(0, Math.min(1, (worldPosition.z - minBounds.z) / size.z));
    const normalizedY = Math.max(0, Math.min(1, (worldPosition.y - minBounds.y) / size.y));
    
    // Create region index based on position (2x4 grid = 8 regions)
    // Use floor to ensure discrete boundaries with no overlap
    const xRegion = normalizedX < 0.5 ? 0 : 1;
    const zRegion = Math.min(3, Math.floor(normalizedZ * 4));
    
    // Combine into region index (deterministic, no randomness)
    const regionIndex = xRegion + zRegion * 2;
    
    // Get base color (clone to avoid modifying original)
    const baseColor = colors[regionIndex].clone();
    
    // Subtle depth variation only (no randomness to prevent flickering)
    const depthFactor = 0.85 + (normalizedY * 0.15);
    baseColor.multiplyScalar(depthFactor);
    
    return baseColor;
  }
  
  /**
   * Optimize the model for rendering performance
   */
  optimizeModel() {
    // Count geometry stats
    let vertexCount = 0;
    let triangleCount = 0;
    
    this.model.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geometry = child.geometry;
        
        // Count vertices
        if (geometry.attributes.position) {
          vertexCount += geometry.attributes.position.count;
        }
        
        // Count triangles
        if (geometry.index) {
          triangleCount += geometry.index.count / 3;
        } else if (geometry.attributes.position) {
          triangleCount += geometry.attributes.position.count / 3;
        }
        
        // Compute bounding box if not present
        if (!geometry.boundingBox) {
          geometry.computeBoundingBox();
        }
        
        // Compute bounding sphere for frustum culling
        if (!geometry.boundingSphere) {
          geometry.computeBoundingSphere();
        }
      }
    });
    
    console.log(`Mine model stats: ${vertexCount} vertices, ${triangleCount} triangles`);
  }
  
  /**
   * Get the bounding box of the mine model
   */
  getBoundingBox() {
    if (!this.model) return null;
    return new THREE.Box3().setFromObject(this.model);
  }
  
  /**
   * Get the center point of the mine
   */
  getCenter() {
    const box = this.getBoundingBox();
    if (!box) return new THREE.Vector3();
    return box.getCenter(new THREE.Vector3());
  }
  
  /**
   * Update origin offset (for runtime configuration changes)
   */
  setOrigin(origin) {
    this.config.origin = origin;
    if (this.model) {
      this.model.position.set(-origin.x, -origin.y, -origin.z);
    }
  }
  
  /**
   * Update material opacity
   */
  setOpacity(opacity) {
    if (!this.model) return;
    
    this.model.traverse((child) => {
      if (child.isMesh) {
        const materials = Array.isArray(child.material) 
          ? child.material 
          : [child.material];
        
        materials.forEach((material) => {
          material.opacity = opacity;
        });
      }
    });
  }
  
  /**
   * Toggle wireframe mode (useful for debugging)
   */
  setWireframe(enabled) {
    if (!this.model) return;
    
    this.model.traverse((child) => {
      if (child.isMesh) {
        const materials = Array.isArray(child.material) 
          ? child.material 
          : [child.material];
        
        materials.forEach((material) => {
          material.wireframe = enabled;
        });
      }
    });
  }
  
  /**
   * Add debug markers to visualize coordinate system
   */
  addDebugMarkers(center, box) {
    // Red sphere at the center
    const sphereGeometry = new THREE.SphereGeometry(1, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const centerSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    centerSphere.position.copy(center);
    centerSphere.name = 'DebugCenterSphere';
    this.scene.add(centerSphere);
    
    // Helper axes at center (3 unit long)
    const axesHelper = new THREE.AxesHelper(10);
    axesHelper.position.copy(center);
    this.scene.add(axesHelper);
    
    // Small spheres at min/max corners
    const cornerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const minCorner = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), cornerMaterial);
    minCorner.position.set(box.min.x, box.min.y, box.min.z);
    this.scene.add(minCorner);
    
    const maxCorner = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshBasicMaterial({ color: 0x0000ff }));
    maxCorner.position.set(box.max.x, box.max.y, box.max.z);
    this.scene.add(maxCorner);
    
    console.log('Debug markers added - Red: center, Green: min corner, Blue: max corner, RGB axes at center');
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    if (this.model) {
      this.scene.remove(this.model);
      
      this.model.traverse((child) => {
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
      
      this.model = null;
    }
    this.isLoaded = false;
  }
}

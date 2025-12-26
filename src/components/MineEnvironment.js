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
   * Sets 50% opacity to allow visibility of vehicles inside
   */
  configureMaterials() {
    this.model.traverse((child) => {
      if (child.isMesh) {
        // Handle material (can be single or array)
        const materials = Array.isArray(child.material) 
          ? child.material 
          : [child.material];
        
        materials.forEach((material) => {
          // Enable transparency with 40% opacity for much better vehicle visibility
          material.transparent = true;
          material.opacity = 0.4;
          
          // Ensure proper depth handling for transparent objects
          material.depthWrite = true;
          material.depthTest = true;
          
          // Enable double-sided rendering for caves
          material.side = THREE.DoubleSide;
          
          // Keep material bright for visibility
          if (material.color) {
            material.color.multiplyScalar(1.2); // Brighten slightly
          }
          
          // Reduce metalness for rock appearance
          if (material.metalness !== undefined) {
            material.metalness = 0.1;
          }
          
          // Increase roughness for rock texture
          if (material.roughness !== undefined) {
            material.roughness = 0.9;
          }
        });
        
        // Enable frustum culling for performance
        child.frustumCulled = true;
        
        // Receive shadows (but don't cast - too expensive)
        child.receiveShadow = false;
        child.castShadow = false;
      }
    });
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

/**
 * AssetLoader - GLTF/GLB Asset Loading
 * 
 * Handles loading of 3D assets with support for:
 * - GLTF/GLB format
 * - DRACO compression for large models
 * - Loading progress tracking
 * - Asset caching
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export class AssetLoader {
  constructor(options = {}) {
    this.dracoPath = options.dracoPath || '/draco/';
    this.cache = new Map();
    
    this.init();
  }
  
  init() {
    // Initialize DRACO decoder for compressed models
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(this.dracoPath);
    this.dracoLoader.setDecoderConfig({ type: 'js' }); // Use JS decoder for broader compatibility
    
    // Initialize GLTF loader with DRACO support
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
    
    // Texture loader for additional textures
    this.textureLoader = new THREE.TextureLoader();
  }
  
  /**
   * Load a GLTF/GLB model
   * @param {string} path - Path to the model file
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} - Loaded GLTF object
   */
  loadGLTF(path, onProgress = null) {
    // Check cache first - return the cached GLTF object
    if (this.cache.has(path)) {
      return Promise.resolve(this.cache.get(path));
    }
    
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          // Cache the loaded asset
          this.cache.set(path, gltf);
          resolve(gltf);
        },
        (progress) => {
          if (onProgress) {
            const percent = progress.total > 0 
              ? (progress.loaded / progress.total) * 100 
              : 0;
            onProgress(percent);
          }
        },
        (error) => {
          console.error(`Failed to load GLTF: ${path}`, error);
          reject(error);
        }
      );
    });
  }
  
  /**
   * Load a texture
   * @param {string} path - Path to the texture file
   * @returns {Promise<THREE.Texture>}
   */
  loadTexture(path) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        path,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          resolve(texture);
        },
        undefined,
        reject
      );
    });
  }
  
  /**
   * Clone a cached model
   * @param {string} path - Path of the cached model
   * @returns {THREE.Group|null}
   */
  cloneFromCache(path) {
    if (this.cache.has(path)) {
      const gltf = this.cache.get(path);
      const clone = gltf.scene.clone();
      
      // Deep clone materials to avoid shared state issues
      clone.traverse((child) => {
        if (child.isMesh) {
          child.material = child.material.clone();
        }
      });
      
      return clone;
    }
    return null;
  }
  
  /**
   * Check if an asset is cached
   */
  isCached(path) {
    return this.cache.has(path);
  }
  
  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
  
  /**
   * Get cache info for debugging
   */
  getCacheInfo() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
  
  /**
   * Dispose loader resources
   */
  dispose() {
    this.dracoLoader.dispose();
    this.clearCache();
  }
}

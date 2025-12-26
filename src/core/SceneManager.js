/**
 * SceneManager - Three.js Scene Setup
 * 
 * Manages the Three.js scene configuration including
 * background, fog, and scene-level properties.
 */

import * as THREE from 'three';

export class SceneManager {
  constructor(options = {}) {
    this.config = options.config || {};
    this.init();
  }
  
  init() {
    // Create the main scene
    this.scene = new THREE.Scene();
    
    // Set background color - light gray/blue for good visibility
    this.scene.background = new THREE.Color(
      this.config.backgroundColor || 0x87ceeb
    );
    
    // Disable fog for better visibility in development
    // Add fog for depth perception in tunnels (optional)
    if (this.config.fog === true) {
      const fogColor = this.config.fogColor || 0x1a1a2e;
      const fogNear = this.config.fogNear || 50;
      const fogFar = this.config.fogFar || 500;
      this.scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
    }
  }
  
  /**
   * Add an object to the scene
   */
  add(object) {
    this.scene.add(object);
  }
  
  /**
   * Remove an object from the scene
   */
  remove(object) {
    this.scene.remove(object);
  }
  
  /**
   * Get object by name
   */
  getObjectByName(name) {
    return this.scene.getObjectByName(name);
  }
  
  /**
   * Traverse all objects in scene
   */
  traverse(callback) {
    this.scene.traverse(callback);
  }
  
  /**
   * Update fog settings
   */
  updateFog(near, far) {
    if (this.scene.fog) {
      this.scene.fog.near = near;
      this.scene.fog.far = far;
    }
  }
  
  /**
   * Clean up scene resources
   */
  dispose() {
    // Traverse and dispose all geometries and materials
    this.scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(mat => this.disposeMaterial(mat));
        } else {
          this.disposeMaterial(object.material);
        }
      }
    });
    
    // Clear the scene
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
  }
  
  /**
   * Dispose a material and its textures
   */
  disposeMaterial(material) {
    if (material.map) material.map.dispose();
    if (material.normalMap) material.normalMap.dispose();
    if (material.roughnessMap) material.roughnessMap.dispose();
    if (material.metalnessMap) material.metalnessMap.dispose();
    if (material.aoMap) material.aoMap.dispose();
    if (material.emissiveMap) material.emissiveMap.dispose();
    material.dispose();
  }
}

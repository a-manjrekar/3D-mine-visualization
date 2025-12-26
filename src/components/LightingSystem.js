/**
 * LightingSystem - Underground Mine Lighting
 * 
 * Creates bright lighting for good visibility:
 * - High-intensity ambient light
 * - Strong directional lights from multiple angles
 * - Point lights for additional illumination
 */

import * as THREE from 'three';

export class LightingSystem {
  constructor(options = {}) {
    this.scene = options.scene;
    this.config = options.config || {};
    
    this.lights = [];
    this.init();
  }
  
  init() {
    // Add strong ambient light for base visibility
    this.addAmbientLight();
    
    // Add hemisphere light
    this.addHemisphereLight();
    
    // Add multiple directional lights for overall illumination
    this.addDirectionalLights();
    
    // Add point lights
    this.addTunnelLights();
  }
  
  /**
   * Add multiple directional lights for bright overall illumination
   */
  addDirectionalLights() {
    // Main light from above
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight1.position.set(0, 100, 0);
    dirLight1.name = 'DirectionalLight1';
    this.scene.add(dirLight1);
    this.lights.push(dirLight1);
    
    // Front light
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight2.position.set(50, 50, 50);
    dirLight2.name = 'DirectionalLight2';
    this.scene.add(dirLight2);
    this.lights.push(dirLight2);
    
    // Back light
    const dirLight3 = new THREE.DirectionalLight(0xffffee, 1.0);
    dirLight3.position.set(-50, 50, -50);
    dirLight3.name = 'DirectionalLight3';
    this.scene.add(dirLight3);
    this.lights.push(dirLight3);
    
    // Side lights
    const dirLight4 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight4.position.set(50, 30, -50);
    this.scene.add(dirLight4);
    this.lights.push(dirLight4);
    
    const dirLight5 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight5.position.set(-50, 30, 50);
    this.scene.add(dirLight5);
    this.lights.push(dirLight5);
  }
  
  /**
   * Add strong ambient light for base visibility
   */
  addAmbientLight() {
    const ambientConfig = this.config.ambient || {};
    const color = ambientConfig.color || 0xffffff;
    const intensity = ambientConfig.intensity || 1.5;
    
    this.ambientLight = new THREE.AmbientLight(color, intensity);
    this.ambientLight.name = 'AmbientLight';
    
    this.scene.add(this.ambientLight);
    this.lights.push(this.ambientLight);
  }
  
  /**
   * Add hemisphere light for overall ambient feel
   */
  addHemisphereLight() {
    const hemisphereConfig = this.config.hemisphere || {};
    const skyColor = hemisphereConfig.skyColor || 0xffffff;
    const groundColor = hemisphereConfig.groundColor || 0x888888;
    const intensity = hemisphereConfig.intensity || 1.0;
    
    this.hemisphereLight = new THREE.HemisphereLight(skyColor, groundColor, intensity);
    this.hemisphereLight.name = 'HemisphereLight';
    
    this.scene.add(this.hemisphereLight);
    this.lights.push(this.hemisphereLight);
  }
  
  /**
   * Add point lights positioned along tunnels
   * These simulate mining lights or natural light sources
   */
  addTunnelLights() {
    const pointLightsConfig = this.config.pointLights || [];
    
    // Default tunnel lights if none configured
    const defaultLights = [
      { position: { x: 0, y: 5, z: 0 }, color: 0xffffcc, intensity: 1.0, distance: 50 },
      { position: { x: 20, y: 5, z: 0 }, color: 0xffffcc, intensity: 0.8, distance: 40 },
      { position: { x: -20, y: 5, z: 0 }, color: 0xffffcc, intensity: 0.8, distance: 40 },
      { position: { x: 0, y: 5, z: 20 }, color: 0xffffcc, intensity: 0.8, distance: 40 },
      { position: { x: 0, y: 5, z: -20 }, color: 0xffffcc, intensity: 0.8, distance: 40 },
    ];
    
    const lightsToAdd = pointLightsConfig.length > 0 ? pointLightsConfig : defaultLights;
    
    lightsToAdd.forEach((lightConfig, index) => {
      const light = new THREE.PointLight(
        lightConfig.color || 0xffffcc,
        lightConfig.intensity || 1.0,
        lightConfig.distance || 50,
        lightConfig.decay || 2
      );
      
      light.position.set(
        lightConfig.position.x,
        lightConfig.position.y,
        lightConfig.position.z
      );
      
      light.name = `TunnelLight_${index}`;
      
      // No shadows for performance
      light.castShadow = false;
      
      this.scene.add(light);
      this.lights.push(light);
      
      // Optional: Add visible light helper in dev mode
      if (this.config.showHelpers) {
        const helper = new THREE.PointLightHelper(light, 0.5);
        this.scene.add(helper);
      }
    });
  }
  
  /**
   * Add a new point light at runtime
   */
  addPointLight(position, color = 0xffffcc, intensity = 1.0, distance = 50) {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(position.x, position.y, position.z);
    light.castShadow = false;
    
    this.scene.add(light);
    this.lights.push(light);
    
    return light;
  }
  
  /**
   * Update ambient light intensity
   */
  setAmbientIntensity(intensity) {
    if (this.ambientLight) {
      this.ambientLight.intensity = intensity;
    }
  }
  
  /**
   * Update all tunnel light intensities
   */
  setTunnelLightIntensity(intensity) {
    this.lights.forEach((light) => {
      if (light.isPointLight) {
        light.intensity = intensity;
      }
    });
  }
  
  /**
   * Get all lights
   */
  getLights() {
    return this.lights;
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    this.lights.forEach((light) => {
      this.scene.remove(light);
      if (light.dispose) {
        light.dispose();
      }
    });
    this.lights = [];
  }
}

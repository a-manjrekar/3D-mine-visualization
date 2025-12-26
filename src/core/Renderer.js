/**
 * Renderer - WebGL Renderer Configuration
 * 
 * Handles WebGL renderer setup with performance optimizations
 * specific to large-scale 3D visualization.
 * 
 * Key optimizations:
 * - Capped pixel ratio for performance
 * - Tone mapping for realistic lighting
 * - Output encoding for correct color space
 * - Frustum culling enabled by default
 */

import * as THREE from 'three';

export class Renderer {
  constructor(options = {}) {
    this.container = options.container;
    this.config = options.config || {};
    
    this.init();
    this.setupResizeHandler();
  }
  
  init() {
    // Create WebGL renderer with performance settings
    this.instance = new THREE.WebGLRenderer({
      antialias: this.config.antialias !== false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      precision: 'mediump' // Use medium precision for better performance
    });
    
    // Cap pixel ratio for performance (max 2 is sufficient for most displays)
    const maxPixelRatio = this.config.maxPixelRatio || 2;
    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    
    // Set initial size
    this.setSize();
    
    // Enable physically correct lights for realistic rendering
    // Note: In Three.js r155+, this is default behavior
    this.instance.useLegacyLights = false;
    
    // Configure tone mapping for underground environment
    this.instance.toneMapping = THREE.ACESFilmicToneMapping;
    this.instance.toneMappingExposure = this.config.toneMappingExposure || 1.0;
    
    // Output encoding for correct color space
    this.instance.outputColorSpace = THREE.SRGBColorSpace;
    
    // Shadows OFF by default for performance
    // Can be enabled later if needed
    this.instance.shadowMap.enabled = this.config.shadows || false;
    if (this.instance.shadowMap.enabled) {
      this.instance.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    
    // Background color - dark underground environment
    this.instance.setClearColor(
      new THREE.Color(this.config.clearColor || 0x0a0a0f),
      1
    );
    
    // Append canvas to container
    this.container.appendChild(this.instance.domElement);
  }
  
  /**
   * Set renderer size based on container dimensions
   */
  setSize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.instance.setSize(width, height);
  }
  
  /**
   * Setup window resize handler
   */
  setupResizeHandler() {
    // Store bound handler for cleanup
    this.resizeHandler = () => {
      this.setSize();
    };
    
    window.addEventListener('resize', this.resizeHandler);
  }
  
  /**
   * Render the scene
   */
  render(scene, camera) {
    this.instance.render(scene, camera);
  }
  
  /**
   * Get renderer info for debugging
   */
  getInfo() {
    return {
      memory: this.instance.info.memory,
      render: this.instance.info.render
    };
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    window.removeEventListener('resize', this.resizeHandler);
    this.instance.dispose();
    this.container.removeChild(this.instance.domElement);
  }
}

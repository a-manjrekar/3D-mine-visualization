/**
 * Camera - Perspective Camera with OrbitControls
 * 
 * Manages the 3D camera for navigating the underground mine.
 * Uses OrbitControls for intuitive mouse-based navigation.
 * 
 * Features:
 * - Optimized near/far planes for underground scale
 * - Smooth damping for professional feel
 * - Mouse wheel zoom, right-click pan
 * - Prepared for first-person mode switch
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Camera {
  constructor(options = {}) {
    this.container = options.container;
    this.renderer = options.renderer;
    this.config = options.config || {};
    
    this.init();
    this.initControls();
    this.setupResizeHandler();
  }
  
  init() {
    // Get container dimensions
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const aspect = width / height;
    
    // Create perspective camera with underground-optimized settings
    // Near plane: 0.1 for close inspection
    // Far plane: 5000 for long tunnel views
    this.instance = new THREE.PerspectiveCamera(
      this.config.fov || 60,
      aspect,
      this.config.near || 0.1,
      this.config.far || 5000
    );
    
    // Initial camera position
    const initialPos = this.config.initialPosition || { x: 50, y: 50, z: 50 };
    this.instance.position.set(initialPos.x, initialPos.y, initialPos.z);
    
    // Look at origin initially
    this.instance.lookAt(0, 0, 0);
  }
  
  /**
   * Initialize OrbitControls for camera navigation
   */
  initControls() {
    this.controls = new OrbitControls(this.instance, this.renderer.domElement);
    
    // Enable damping for smooth camera movement
    this.controls.enableDamping = true;
    this.controls.dampingFactor = this.config.dampingFactor || 0.05;
    
    // Configure zoom (mouse wheel)
    this.controls.enableZoom = true;
    this.controls.zoomSpeed = this.config.zoomSpeed || 1.0;
    this.controls.minDistance = this.config.minDistance || 1;
    this.controls.maxDistance = this.config.maxDistance || 1000;
    
    // Configure pan (right-click)
    this.controls.enablePan = true;
    this.controls.panSpeed = this.config.panSpeed || 1.0;
    this.controls.screenSpacePanning = true; // Pan in screen space
    
    // Configure rotation (left-click)
    this.controls.enableRotate = true;
    this.controls.rotateSpeed = this.config.rotateSpeed || 0.5;
    
    // Limit vertical rotation to prevent disorientation
    this.controls.maxPolarAngle = Math.PI * 0.95;
    this.controls.minPolarAngle = Math.PI * 0.05;
    
    // Set initial target
    const target = this.config.target || { x: 0, y: 0, z: 0 };
    this.controls.target.set(target.x, target.y, target.z);
  }
  
  /**
   * Setup window resize handler
   */
  setupResizeHandler() {
    this.resizeHandler = () => {
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      
      this.instance.aspect = width / height;
      this.instance.updateProjectionMatrix();
    };
    
    window.addEventListener('resize', this.resizeHandler);
  }
  
  /**
   * Update camera controls (call in render loop)
   */
  update(deltaTime) {
    if (this.controls) {
      this.controls.update();
    }
  }
  
  /**
   * Focus camera on a specific object
   */
  focusOnObject(object) {
    if (!object) return;
    
    // Calculate bounding box
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    // Calculate optimal camera distance
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.instance.fov * (Math.PI / 180);
    let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
    cameraDistance *= 1.5; // Add some margin
    
    // Set camera position
    this.instance.position.set(
      center.x + cameraDistance * 0.5,
      center.y + cameraDistance * 0.5,
      center.z + cameraDistance * 0.5
    );
    
    // Set controls target
    this.controls.target.copy(center);
    this.controls.update();
  }
  
  /**
   * Move camera to specific position smoothly
   */
  moveTo(position, target, duration = 1000) {
    // Store for animation (could use GSAP for smoother transitions)
    const startPosition = this.instance.position.clone();
    const startTarget = this.controls.target.clone();
    const endPosition = new THREE.Vector3(position.x, position.y, position.z);
    const endTarget = new THREE.Vector3(target.x, target.y, target.z);
    
    const startTime = performance.now();
    
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      
      this.instance.position.lerpVectors(startPosition, endPosition, eased);
      this.controls.target.lerpVectors(startTarget, endTarget, eased);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }
  
  /**
   * Get current camera state
   */
  getState() {
    return {
      position: this.instance.position.clone(),
      target: this.controls.target.clone(),
      fov: this.instance.fov
    };
  }
  
  /**
   * Restore camera state
   */
  setState(state) {
    if (state.position) {
      this.instance.position.copy(state.position);
    }
    if (state.target) {
      this.controls.target.copy(state.target);
    }
    if (state.fov) {
      this.instance.fov = state.fov;
      this.instance.updateProjectionMatrix();
    }
    this.controls.update();
  }
  
  /**
   * Switch to first-person mode (placeholder for future implementation)
   */
  enableFirstPerson() {
    // TODO: Implement first-person controls
    // This would disable OrbitControls and enable PointerLockControls
    console.log('First-person mode not yet implemented');
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    window.removeEventListener('resize', this.resizeHandler);
    this.controls?.dispose();
  }
}

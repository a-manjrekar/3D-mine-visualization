/**
 * Experience - Main Application Controller
 * 
 * This is the central orchestrator that initializes and coordinates
 * all subsystems of the mine visualization application.
 * 
 * Responsibilities:
 * - Initialize Three.js core components
 * - Load configuration
 * - Manage the render loop
 * - Coordinate between subsystems
 * - Handle lifecycle (pause/resume/dispose)
 */

import * as THREE from 'three';
import { Renderer } from './Renderer.js';
import { Camera } from './Camera.js';
import { SceneManager } from './SceneManager.js';
import { AssetLoader } from './AssetLoader.js';
import { MineEnvironment } from '../components/MineEnvironment.js';
import { VehicleManager } from '../components/VehicleManager.js';
import { LightingSystem } from '../components/LightingSystem.js';
import { DrivableVolume } from '../components/DrivableVolume.js';
import { WebSocketService } from '../services/WebSocketService.js';
import { UIController } from '../services/UIController.js';
import { EventBus } from '../utils/EventBus.js';
import { ConfigLoader } from '../utils/ConfigLoader.js';

export class Experience {
  constructor(options = {}) {
    // Store reference to container
    this.container = options.container;
    this.configPath = options.configPath;
    
    // State management
    this.isRunning = false;
    this.isPaused = false;
    this.clock = new THREE.Clock();
    
    // Performance: Reusable objects to avoid GC
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    
    // Event system for inter-component communication
    this.events = new EventBus();
    
    // Initialize all systems
    this.init();
  }
  
  async init() {
    try {
      // Load application configuration first
      this.config = await ConfigLoader.load(this.configPath);
      
      // Initialize core Three.js components
      this.initCore();
      
      // Initialize subsystems
      this.initSubsystems();
      
      // Load assets and environment
      await this.loadAssets();
      
      // Connect to data source
      this.connectDataSource();
      
      // Start the render loop
      this.start();
      
      // Hide loading indicator
      this.ui.hideLoading();
      
    } catch (error) {
      console.error('Experience initialization failed:', error);
      this.ui?.showError('Failed to initialize visualization');
    }
  }
  
  /**
   * Initialize core Three.js components
   */
  initCore() {
    // Scene manager handles the Three.js scene
    this.sceneManager = new SceneManager();
    this.scene = this.sceneManager.scene;
    
    // Renderer with performance optimizations
    this.renderer = new Renderer({
      container: this.container,
      config: this.config.renderer
    });
    
    // Camera with OrbitControls
    this.camera = new Camera({
      container: this.container,
      renderer: this.renderer.instance,
      config: this.config.camera
    });
  }
  
  /**
   * Initialize application subsystems
   */
  initSubsystems() {
    // Asset loader for GLTF models
    this.assetLoader = new AssetLoader({
      dracoPath: this.config.assets?.dracoPath || '/draco/'
    });
    
    // Underground lighting system
    this.lighting = new LightingSystem({
      scene: this.scene,
      config: this.config.lighting
    });
    
    // Mine environment manager
    this.mineEnvironment = new MineEnvironment({
      scene: this.scene,
      assetLoader: this.assetLoader,
      config: this.config.mine
    });
    
    // CONTAINMENT: Drivable volume for spatial constraint
    // This invisible mesh defines where vehicles can exist
    this.drivableVolume = new DrivableVolume({
      scene: this.scene,
      assetLoader: this.assetLoader
    });
    
    // Vehicle management system
    this.vehicleManager = new VehicleManager({
      scene: this.scene,
      assetLoader: this.assetLoader,
      config: this.config.vehicles,
      events: this.events
    });
    
    // WebSocket service for real-time data
    this.webSocket = new WebSocketService({
      config: this.config.websocket,
      events: this.events
    });
    
    // UI controller for HTML overlay
    this.ui = new UIController({
      events: this.events
    });
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  /**
   * Setup inter-component event listeners
   */
  setupEventListeners() {
    // Vehicle data updates from WebSocket
    this.events.on('vehicle:update', (data) => {
      this.vehicleManager.updateVehicle(data);
    });
    
    // Connection status changes
    this.events.on('connection:status', (status) => {
      this.ui.updateConnectionStatus(status);
    });
    
    // Vehicle count changes
    this.events.on('vehicles:count', (count) => {
      this.ui.updateVehicleCount(count);
    });
    
    // Vehicle selection
    this.events.on('vehicle:selected', (vehicleData) => {
      this.ui.showVehicleInfo(vehicleData);
    });
    
    // Vehicle deselection
    this.events.on('vehicle:deselected', () => {
      this.ui.hideVehicleInfo();
    });
    
    // Handle click events for vehicle selection
    this.container.addEventListener('click', (event) => {
      this.handleClick(event);
    });
  }
  
  /**
   * Load all required assets
   */
  async loadAssets() {
    // Load mine environment
    await this.mineEnvironment.load(this.config.mine.modelPath);
    
    // CONTAINMENT: Generate drivable volume from mine model
    // This creates an invisible mesh used only for containment checks
    // If a dedicated volume mesh exists, load it instead:
    // await this.drivableVolume.loadVolumeMesh('/models/mine/drivable_volume.glb');
    this.drivableVolume.generateFromMineModel(this.mineEnvironment.model);
    
    // CONTAINMENT: Connect volume to vehicle manager
    this.vehicleManager.setDrivableVolume(this.drivableVolume);
    
    // Preload vehicle models
    await this.vehicleManager.preloadModels();
    
    // Position camera to view the mine
    this.camera.focusOnObject(this.mineEnvironment.model);
  }
  
  /**
   * Connect to real-time data source
   */
  connectDataSource() {
    // Pass mine model and bounds to WebSocket for vehicle path constraints
    if (this.mineEnvironment.bounds) {
      this.webSocket.setMineData(
        this.mineEnvironment.model,
        this.mineEnvironment.bounds, 
        this.mineEnvironment.center
      );
    }
    // Start WebSocket connection (simulated in development)
    this.webSocket.connect();
  }
  
  /**
   * Handle click events for object selection
   */
  handleClick(event) {
    const rect = this.container.getBoundingClientRect();
    this._mouse.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    
    this._raycaster.setFromCamera(this._mouse, this.camera.instance);
    
    // Check for vehicle intersections
    const vehicleMeshes = this.vehicleManager.getSelectableMeshes();
    const intersects = this._raycaster.intersectObjects(vehicleMeshes, true);
    
    if (intersects.length > 0) {
      // Find the vehicle that was clicked
      let clickedObject = intersects[0].object;
      while (clickedObject.parent && !clickedObject.userData.vehicleId) {
        clickedObject = clickedObject.parent;
      }
      
      if (clickedObject.userData.vehicleId) {
        this.vehicleManager.selectVehicle(clickedObject.userData.vehicleId);
      }
    } else {
      this.vehicleManager.deselectVehicle();
    }
  }
  
  /**
   * Start the render loop
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.tick();
  }
  
  /**
   * Main render loop
   */
  tick() {
    if (!this.isRunning) return;
    
    // Request next frame
    requestAnimationFrame(() => this.tick());
    
    // Skip if paused
    if (this.isPaused) return;
    
    // Get delta time for frame-independent updates
    const deltaTime = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();
    
    // Update subsystems
    this.camera.update(deltaTime);
    this.vehicleManager.update(deltaTime);
    
    // Render the scene
    this.renderer.render(this.scene, this.camera.instance);
  }
  
  /**
   * Pause the render loop
   */
  pause() {
    this.isPaused = true;
    this.clock.stop();
  }
  
  /**
   * Resume the render loop
   */
  resume() {
    this.isPaused = false;
    this.clock.start();
  }
  
  /**
   * Clean up all resources
   */
  dispose() {
    this.isRunning = false;
    
    // Disconnect WebSocket
    this.webSocket?.disconnect();
    
    // Dispose Three.js resources
    this.vehicleManager?.dispose();
    this.mineEnvironment?.dispose();
    this.lighting?.dispose();
    this.renderer?.dispose();
    this.camera?.dispose();
    this.sceneManager?.dispose();
    
    // Clear event listeners
    this.events?.clear();
  }
}

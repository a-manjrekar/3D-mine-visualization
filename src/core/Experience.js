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
import { LocationMarkers } from '../components/LocationMarkers.js';
import { WebSocketService } from '../services/WebSocketService.js';
import { VehicleAPIService } from '../services/VehicleAPIService.js';
import { UIController } from '../services/UIController.js';
import { EventBus } from '../utils/EventBus.js';
import { ConfigLoader } from '../utils/ConfigLoader.js';
import { TrailObjectPool } from '../utils/TrailObjectPool.js';

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
    
    // Follow mode state
    this.followMode = {
      active: false,
      vehicleId: null,
      offset: new THREE.Vector3(8, 6, 8)
    };
    
    // First-person view state
    this.fpvMode = {
      active: false,
      vehicleId: null
    };
    
    // Minimap state
    this.minimap = {
      renderer: null,
      camera: null,
      scene: null
    };
    
    // Filter state
    this.vehicleFilters = {
      types: { dump_truck: true, loader: true, haul_truck: true },
      status: { moving: true, idle: true, loading: true, maintenance: true },
      groups: { hauling: true, loading: true, transport: true }
    };
    
    // Selected level
    this.selectedLevel = 'all';
    
    // Distance-based update throttling
    this.distanceThrottling = {
      enabled: true,
      nearDistance: 50,
      farDistance: 150
    };
    
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
      
      // Connect to data source (use API service instead of raw WebSocket)
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
    
    // Trail object pool for efficient trail rendering
    this.trailPool = new TrailObjectPool({
      scene: this.scene,
      initialSize: 20,
      maxSize: 100
    });
    
    // Vehicle management system
    this.vehicleManager = new VehicleManager({
      scene: this.scene,
      assetLoader: this.assetLoader,
      config: this.config.vehicles,
      events: this.events,
      trailPool: this.trailPool
    });
    
    // Location markers for hotspot navigation
    this.locationMarkers = new LocationMarkers({
      scene: this.scene,
      camera: this.camera.instance,
      events: this.events
    });
    
    // WebSocket service for real-time data (fallback)
    this.webSocket = new WebSocketService({
      config: this.config.websocket,
      events: this.events
    });
    
    // API service for production-like data handling
    this.apiService = new VehicleAPIService({
      config: this.config.api || { simulate: true },
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
      // Update UI controller's vehicle data for search
      this.ui.updateVehicleData(data.id, data);
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
    this.events.on('vehicle:selected', (vehicleData, tripHistory) => {
      this.ui.showVehicleInfo(vehicleData, tripHistory);
    });
    
    // Vehicle deselection
    this.events.on('vehicle:deselected', () => {
      this.ui.hideVehicleInfo();
      this.stopFollowMode();
    });
    
    // Vehicle search - find and zoom to vehicle
    this.events.on('vehicle:search', (vehicleId) => {
      this.searchAndSelectVehicle(vehicleId);
    });
    
    // Follow mode start
    this.events.on('vehicle:follow:start', (vehicleId) => {
      this.startFollowMode(vehicleId);
    });
    
    // Follow mode stop
    this.events.on('vehicle:follow:stop', () => {
      this.stopFollowMode();
    });
    
    // Location marker clicked - zoom to location
    this.events.on('location:selected', (locationData) => {
      this.stopFollowMode();
      this.zoomToLocation(locationData);
    });
    
    // UI location button clicked
    this.events.on('location:goto', (locationId) => {
      this.stopFollowMode();
      this.stopFPVMode();
      const position = this.locationMarkers.getLocationPosition(locationId);
      if (position) {
        this.zoomToLocation({ id: locationId, position });
      }
    });
    
    // Reset view button clicked
    this.events.on('camera:reset', () => {
      this.stopFollowMode();
      this.stopFPVMode();
      if (this.initialCameraState) {
        this.camera.moveTo(
          this.initialCameraState.position,
          this.initialCameraState.target,
          1200
        );
      }
    });
    
    // Toggle vehicle trails
    this.events.on('trails:toggle', () => {
      const enabled = this.vehicleManager.toggleTrails();
      this.events.emit('trails:status', enabled);
    });
    
    // First-person view start
    this.events.on('fpv:start', (vehicleId) => {
      this.startFPVMode(vehicleId);
    });
    
    // First-person view stop
    this.events.on('fpv:stop', () => {
      this.stopFPVMode();
    });
    
    // Vehicle filter event
    this.events.on('vehicles:filter', (filterState) => {
      this.vehicleFilters = filterState;
      this.applyVehicleFilters();
    });
    
    // Filter reset event
    this.events.on('vehicles:filter:reset', () => {
      this.vehicleFilters = {
        types: { dump_truck: true, loader: true, haul_truck: true },
        status: { moving: true, idle: true, loading: true, maintenance: true },
        groups: { hauling: true, loading: true, transport: true }
      };
      this.applyVehicleFilters();
    });
    
    // Level selection event
    this.events.on('level:select', (level) => {
      this.selectedLevel = level;
      this.applyLevelFilter();
    });

    // Handle click events for vehicle and location selection
    this.container.addEventListener('click', (event) => {
      this.handleClick(event);
    });
  }
  
  /**
   * Apply vehicle filters to show/hide vehicles
   */
  applyVehicleFilters() {
    this.vehicleManager.vehicles.forEach((vehicle, id) => {
      const vehicleData = this.ui.vehicleData.get(id);
      if (!vehicleData) return;
      
      let visible = true;
      
      // Check type filter
      if (!this.vehicleFilters.types[vehicleData.type]) {
        visible = false;
      }
      
      // Check status filter
      if (!this.vehicleFilters.status[vehicleData.status]) {
        visible = false;
      }
      
      // Check group filter
      if (vehicleData.group && !this.vehicleFilters.groups[vehicleData.group]) {
        visible = false;
      }
      
      vehicle.mesh.visible = visible;
    });
    
    this.updateVehicleCounts();
  }
  
  /**
   * Apply level filter to show only vehicles on selected level
   */
  applyLevelFilter() {
    if (this.selectedLevel === 'all') {
      // Show all (respect other filters)
      this.applyVehicleFilters();
      return;
    }
    
    const levelNum = parseInt(this.selectedLevel);
    
    this.vehicleManager.vehicles.forEach((vehicle, id) => {
      const vehicleData = this.ui.vehicleData.get(id);
      if (!vehicleData) return;
      
      const vehicleLevel = vehicleData.level || 0;
      const visible = vehicleLevel === levelNum;
      
      vehicle.mesh.visible = visible;
    });
    
    this.updateVehicleCounts();
  }
  
  /**
   * Update vehicle counts in UI (by type and level)
   */
  updateVehicleCounts() {
    const typeCounts = { dump_truck: 0, loader: 0, haul_truck: 0 };
    const levelCounts = { all: 0, 0: 0, 1: 0, 2: 0, 3: 0 };
    
    this.vehicleManager.vehicles.forEach((vehicle, id) => {
      const vehicleData = this.ui.vehicleData.get(id);
      if (!vehicleData) return;
      
      // Count by type
      if (typeCounts[vehicleData.type] !== undefined) {
        typeCounts[vehicleData.type]++;
      }
      
      // Count by level
      const level = vehicleData.level || 0;
      levelCounts.all++;
      if (levelCounts[level] !== undefined) {
        levelCounts[level]++;
      }
    });
    
    this.ui.updateFilterCounts(typeCounts);
    this.ui.updateLevelCounts(levelCounts);
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
    
    // Store initial camera state for reset functionality
    this.initialCameraState = this.camera.getState();
    
    // Initialize location markers based on mine bounds
    if (this.mineEnvironment.bounds && this.mineEnvironment.center) {
      // Pass mine model for raycasting validation
      this.locationMarkers.setMineModel(this.mineEnvironment.model);
      
      this.locationMarkers.initializeFromBounds(
        this.mineEnvironment.bounds,
        this.mineEnvironment.center
      );
      
      // Update UI with available locations
      this.ui.setupLocationButtons(this.locationMarkers.getLocations());
    }
    
    // Initialize minimap after mine is loaded
    this.initMinimap();
    this.updateMinimapBounds();
  }
  
  /**
   * Connect to real-time data source
   */
  connectDataSource() {
    // Pass mine model and bounds to API service for vehicle path constraints
    if (this.mineEnvironment.bounds) {
      // Pass to API service
      this.apiService.setMineData(
        this.mineEnvironment.model,
        this.mineEnvironment.bounds,
        this.mineEnvironment.center
      );
    }
    
    // Use API service for production-like behavior
    // Falls back to simulation if no backend available
    this.apiService.initialize().then(() => {
      console.log('VehicleAPIService initialized');
      // Update initial counts
      setTimeout(() => this.updateVehicleCounts(), 500);
    });
    
    // Disable WebSocket simulation - API service handles vehicle updates
    // this.webSocket.connect();
  }
  
  /**
   * Handle click events for object selection
   */
  handleClick(event) {
    // First check if a location marker was clicked
    if (this.locationMarkers.handleClick(event, this.container)) {
      return; // Location marker handled the click
    }
    
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
   * Zoom camera to a specific location
   */
  zoomToLocation(locationData) {
    const { position, id, name } = locationData;
    
    // Calculate camera position - offset from target
    const cameraOffset = {
      x: position.x + 15,
      y: position.y + 12,
      z: position.z + 15
    };
    
    // Smooth camera animation to location
    this.camera.moveTo(cameraOffset, position, 1500);
    
    // Highlight the marker
    this.locationMarkers.highlightMarker(id, true);
    
    // Update UI to show active location
    this.ui.setActiveLocation(id);
    
    console.log(`Zooming to location: ${name || id}`);
  }
  
  /**
   * Search for a vehicle and zoom to it
   */
  searchAndSelectVehicle(vehicleId) {
    const vehicle = this.vehicleManager.vehicles.get(vehicleId);
    if (!vehicle) {
      console.warn(`Vehicle not found: ${vehicleId}`);
      return;
    }
    
    // Select the vehicle
    this.vehicleManager.selectVehicle(vehicleId);
    
    // Get vehicle position
    const position = vehicle.mesh.position.clone();
    
    // Zoom to vehicle
    const cameraOffset = {
      x: position.x + 10,
      y: position.y + 8,
      z: position.z + 10
    };
    
    this.camera.moveTo(cameraOffset, position, 1200);
    
    console.log(`Found and zoomed to vehicle: ${vehicleId}`);
  }
  
  /**
   * Start following a vehicle
   */
  startFollowMode(vehicleId) {
    const vehicle = this.vehicleManager.vehicles.get(vehicleId);
    if (!vehicle) {
      console.warn(`Cannot follow vehicle: ${vehicleId} - not found`);
      return;
    }
    
    this.followMode.active = true;
    this.followMode.vehicleId = vehicleId;
    
    // Disable orbit controls while following
    this.camera.controls.enabled = false;
    
    // Notify API service that this vehicle is being followed (highest priority)
    this.apiService.setFollowedVehicle(vehicleId);
    
    console.log(`Following vehicle: ${vehicleId}`);
  }
  
  /**
   * Stop following a vehicle
   */
  stopFollowMode() {
    if (!this.followMode.active) return;
    
    this.followMode.active = false;
    this.followMode.vehicleId = null;
    
    // Re-enable orbit controls
    this.camera.controls.enabled = true;
    
    // Clear followed vehicle in API service
    this.apiService.setFollowedVehicle(null);
    
    console.log('Follow mode stopped');
  }
  
  /**
   * Update camera to follow vehicle
   */
  updateFollowCamera(deltaTime) {
    if (!this.followMode.active || !this.followMode.vehicleId) return;
    
    const vehicle = this.vehicleManager.vehicles.get(this.followMode.vehicleId);
    if (!vehicle) {
      this.stopFollowMode();
      return;
    }
    
    // Get vehicle position and heading
    const vehiclePos = vehicle.mesh.position;
    const heading = vehicle.currentHeading || 0;
    
    // Calculate camera position behind and above the vehicle
    const headingRad = heading * Math.PI / 180;
    const offset = this.followMode.offset;
    
    // Position camera behind vehicle based on heading
    const targetCamPos = new THREE.Vector3(
      vehiclePos.x - Math.sin(headingRad) * offset.z + Math.cos(headingRad) * offset.x * 0.3,
      vehiclePos.y + offset.y,
      vehiclePos.z - Math.cos(headingRad) * offset.z - Math.sin(headingRad) * offset.x * 0.3
    );
    
    // Smooth camera follow using lerp
    const lerpFactor = 1 - Math.pow(0.01, deltaTime);
    this.camera.instance.position.lerp(targetCamPos, lerpFactor);
    
    // Look at a point slightly ahead of the vehicle
    const lookAtPos = new THREE.Vector3(
      vehiclePos.x + Math.sin(headingRad) * 3,
      vehiclePos.y + 1,
      vehiclePos.z + Math.cos(headingRad) * 3
    );
    
    this.camera.controls.target.lerp(lookAtPos, lerpFactor);
    this.camera.controls.update();
  }
  
  /**
   * Start first-person view inside a vehicle
   */
  startFPVMode(vehicleId) {
    const vehicle = this.vehicleManager.vehicles.get(vehicleId);
    if (!vehicle) {
      console.warn(`Cannot start FPV: ${vehicleId} - not found`);
      return;
    }
    
    // Stop follow mode if active
    this.stopFollowMode();
    
    this.fpvMode.active = true;
    this.fpvMode.vehicleId = vehicleId;
    
    // Disable orbit controls
    this.camera.controls.enabled = false;
    
    // Show FPV overlay
    this.ui.showFPVOverlay(vehicleId);
    
    console.log(`First-person view started for: ${vehicleId}`);
  }
  
  /**
   * Stop first-person view
   */
  stopFPVMode() {
    if (!this.fpvMode.active) return;
    
    this.fpvMode.active = false;
    this.fpvMode.vehicleId = null;
    
    // Re-enable orbit controls
    this.camera.controls.enabled = true;
    
    // Hide FPV overlay
    this.ui.hideFPVOverlay();
    
    console.log('First-person view stopped');
  }
  
  /**
   * Update camera for first-person view
   */
  updateFPVCamera(deltaTime) {
    if (!this.fpvMode.active || !this.fpvMode.vehicleId) return;
    
    const vehicle = this.vehicleManager.vehicles.get(this.fpvMode.vehicleId);
    if (!vehicle) {
      this.stopFPVMode();
      return;
    }
    
    // Get cabin position and forward direction
    const cabinPos = vehicle.getCabinPosition();
    const lookAt = vehicle.getForwardDirection();
    
    // Smooth camera transition
    const lerpFactor = 1 - Math.pow(0.001, deltaTime);
    this.camera.instance.position.lerp(cabinPos, lerpFactor);
    
    // Look forward
    this.camera.controls.target.lerp(lookAt, lerpFactor);
    this.camera.controls.update();
  }
  
  /**
   * Initialize minimap renderer (DISABLED)
   */
  initMinimap() {
    // Minimap feature removed
    return;
  }
  
  /**
   * Update minimap camera position based on mine bounds (DISABLED)
   */
  updateMinimapBounds() {
    // Minimap feature removed
    return;
  }
  
  /**
   * Render minimap (DISABLED)
   */
  renderMinimap() {
    // Minimap feature removed
    return;
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
    
    // Update follow camera if active
    this.updateFollowCamera(deltaTime);
    
    // Update FPV camera if active
    this.updateFPVCamera(deltaTime);
    
    // Update subsystems
    this.camera.update(deltaTime);
    this.vehicleManager.update(deltaTime);
    this.locationMarkers.update(deltaTime);
    
    // Update LOD based on camera distance (every 10 frames for performance)
    if (Math.floor(elapsedTime * 60) % 10 === 0) {
      this.mineEnvironment.updateLOD(this.camera.instance);
      this.updateVisibleVehicles();
    }
    
    // Render the scene
    this.renderer.render(this.scene, this.camera.instance);
    
    // Render minimap (lower frequency for performance)
    if (Math.floor(elapsedTime * 10) % 2 === 0) {
      this.renderMinimap();
    }
  }
  
  /**
   * Update list of visible vehicles for API service priority
   */
  updateVisibleVehicles() {
    if (!this.distanceThrottling.enabled) return;
    
    const cameraPos = this.camera.instance.position;
    const visibleIds = [];
    
    this.vehicleManager.vehicles.forEach((vehicle, id) => {
      if (!vehicle.mesh.visible) return;
      
      const distance = cameraPos.distanceTo(vehicle.mesh.position);
      if (distance < this.distanceThrottling.farDistance) {
        visibleIds.push(id);
      }
    });
    
    this.apiService.setVisibleVehicles(visibleIds);
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
    
    // Disconnect services
    this.webSocket?.disconnect();
    this.apiService?.disconnect();
    
    // Dispose trail pool
    this.trailPool?.dispose();
    
    // Dispose minimap
    this.minimap.renderer?.dispose();
    
    // Dispose Three.js resources
    this.vehicleManager?.dispose();
    this.mineEnvironment?.dispose();
    this.lighting?.dispose();
    this.locationMarkers?.dispose();
    this.renderer?.dispose();
    this.camera?.dispose();
    this.sceneManager?.dispose();
    
    // Clear event listeners
    this.events?.clear();
  }
}

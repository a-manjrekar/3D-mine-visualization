/**
 * LocationMarkers - Clickable Location Hotspots
 * 
 * Creates interactive 3D markers at key locations in the mine.
 * When clicked, the camera zooms to that location.
 * 
 * Features:
 * - 3D sprite markers with icons
 * - Floating labels
 * - Hover highlighting
 * - Click to zoom
 * - Pulsing animation for visibility
 * - Raycasting to ensure markers are inside tunnels
 */

import * as THREE from 'three';

export class LocationMarkers {
  constructor(options = {}) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.events = options.events;
    this.config = options.config || {};
    
    // Storage for markers
    this.markers = new Map();
    this.markerGroup = new THREE.Group();
    this.markerGroup.name = 'LocationMarkers';
    
    // Raycaster for click detection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Mine meshes for position validation
    this.mineMeshes = [];
    
    // Animation
    this.clock = new THREE.Clock();
    
    // Default locations (will be positioned based on mine bounds)
    // Mine-relevant locations spread across the tunnel network
    this.defaultLocations = [
      { id: 'entry', name: 'Main Entry', icon: '🚪', color: 0x4CAF50 },
      { id: 'loading', name: 'Loading Bay', icon: '📦', color: 0xFF9800 },
      { id: 'extraction', name: 'Extraction Zone', icon: '⛏️', color: 0xF44336 },
      { id: 'ventilation', name: 'Service Tunnel', icon: '🔧', color: 0x00BCD4 },
    ];
    
    this.scene.add(this.markerGroup);
  }
  
  /**
   * Set mine model for raycasting validation
   */
  setMineModel(model) {
    this.mineMeshes = [];
    if (model) {
      model.traverse((child) => {
        if (child.isMesh) {
          this.mineMeshes.push(child);
        }
      });
    }
    console.log(`LocationMarkers: Collected ${this.mineMeshes.length} meshes for validation`);
  }
  
  /**
   * Find a valid tunnel position using raycasting (same approach as WebSocketService)
   * Returns a position on the tunnel floor, or null if not inside a tunnel
   */
  findValidTunnelPosition(x, z, maxY) {
    if (this.mineMeshes.length === 0) {
      return null;
    }
    
    const raycaster = new THREE.Raycaster();
    const rayOrigin = new THREE.Vector3(x, maxY + 10, z);
    raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
    raycaster.far = 1000;
    
    const hits = raycaster.intersectObjects(this.mineMeshes, true);
    
    if (hits.length >= 2) {
      // Sort by Y to get floor and ceiling
      hits.sort((a, b) => a.point.y - b.point.y);
      const floorY = hits[0].point.y;
      const ceilingY = hits[hits.length - 1].point.y;
      const tunnelHeight = ceilingY - floorY;
      
      // Valid tunnel: reasonable height
      if (tunnelHeight > 1.0 && tunnelHeight < 20) {
        return new THREE.Vector3(x, floorY + 0.5, z);
      }
    }
    
    return null;
  }
  
  /**
   * Search for a valid tunnel position near the target coordinates
   * Expands search in a wider spiral pattern to ensure we find tunnel positions
   */
  findNearestValidPosition(targetX, targetZ, bounds) {
    const { min, max } = bounds;
    
    // Try exact position first
    let validPos = this.findValidTunnelPosition(targetX, targetZ, max.y);
    if (validPos) return validPos;
    
    // Wider spiral search pattern
    const searchRadius = 15;
    const searchStep = 1.0;
    
    for (let radius = searchStep; radius <= searchRadius; radius += searchStep) {
      // Search in a circle at this radius
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
        const x = targetX + Math.cos(angle) * radius;
        const z = targetZ + Math.sin(angle) * radius;
        
        // Stay within bounds
        if (x >= min.x && x <= max.x && z >= min.z && z <= max.z) {
          validPos = this.findValidTunnelPosition(x, z, max.y);
          if (validPos) return validPos;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Initialize markers based on mine bounds
   * Uses raycasting to position markers inside actual tunnels
   */
  initializeFromBounds(bounds, center) {
    if (!bounds) {
      console.warn('No bounds provided for location markers');
      return;
    }
    
    const { min, max } = bounds;
    const size = new THREE.Vector3();
    bounds.getSize(size);
    
    // Target positions spread across different areas of the mine
    // Using different quadrants and offsets to spread markers
    const targetPositions = {
      entry: { x: min.x + size.x * 0.2, z: min.z + size.z * 0.3 },
      loading: { x: center.x, z: center.z - size.z * 0.15 },
      extraction: { x: max.x - size.x * 0.2, z: center.z + size.z * 0.1 },
      ventilation: { x: center.x - size.x * 0.1, z: max.z - size.z * 0.25 },
    };
    
    // Create markers at validated positions inside tunnels
    this.defaultLocations.forEach((location) => {
      const target = targetPositions[location.id];
      if (target) {
        // Find valid position inside tunnel using raycasting
        const validPosition = this.findNearestValidPosition(target.x, target.z, bounds);
        
        if (validPosition) {
          this.createMarker({
            ...location,
            position: validPosition
          });
          console.log(`Marker '${location.name}' placed at valid tunnel position`);
        } else {
          console.warn(`Could not find valid tunnel position for marker '${location.name}'`);
        }
      }
    });
    
    console.log(`Created ${this.markers.size} location markers inside tunnels`);
  }
  
  /**
   * Create a single marker
   */
  createMarker(config) {
    const { id, name, icon, color, position } = config;
    
    // Create marker group
    const markerGroup = new THREE.Group();
    markerGroup.position.copy(position);
    markerGroup.userData = { 
      locationId: id, 
      locationName: name,
      isLocationMarker: true 
    };
    
    // Create glowing sphere marker
    const sphereGeometry = new THREE.SphereGeometry(0.8, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    markerGroup.add(sphere);
    
    // Create outer ring for pulsing effect
    const ringGeometry = new THREE.RingGeometry(1.0, 1.3, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2; // Lay flat
    markerGroup.add(ring);
    
    // Create vertical beam
    const beamGeometry = new THREE.CylinderGeometry(0.1, 0.1, 5, 8);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.3,
    });
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.y = 2.5;
    markerGroup.add(beam);
    
    // Create text label using sprite
    const label = this.createTextLabel(name, color);
    label.position.y = 5.5;
    markerGroup.add(label);
    
    // Store reference
    this.markers.set(id, {
      group: markerGroup,
      sphere,
      ring,
      beam,
      label,
      config,
      baseY: position.y
    });
    
    this.markerGroup.add(markerGroup);
    
    return markerGroup;
  }
  
  /**
   * Create a text label sprite
   */
  createTextLabel(text, color) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;
    
    // Background
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.roundRect(0, 0, canvas.width, canvas.height, 20);
    context.fill();
    
    // Border
    context.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.lineWidth = 4;
    context.roundRect(2, 2, canvas.width - 4, canvas.height - 4, 18);
    context.stroke();
    
    // Text
    context.fillStyle = '#ffffff';
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // Create sprite
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(8, 2, 1);
    
    return sprite;
  }
  
  /**
   * Add custom location marker
   */
  addLocation(id, name, position, color = 0xFFFFFF) {
    return this.createMarker({
      id,
      name,
      icon: '📍',
      color,
      position: new THREE.Vector3(position.x, position.y, position.z)
    });
  }
  
  /**
   * Handle click on markers
   */
  handleClick(event, container) {
    const rect = container.getBoundingClientRect();
    this.mouse.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Get all marker meshes
    const markerMeshes = [];
    this.markers.forEach((marker) => {
      markerMeshes.push(marker.sphere);
      markerMeshes.push(marker.ring);
    });
    
    const intersects = this.raycaster.intersectObjects(markerMeshes, false);
    
    if (intersects.length > 0) {
      // Find which marker was clicked
      const clickedMesh = intersects[0].object;
      const markerGroup = clickedMesh.parent;
      
      if (markerGroup.userData.isLocationMarker) {
        const locationId = markerGroup.userData.locationId;
        const locationName = markerGroup.userData.locationName;
        
        console.log(`Location clicked: ${locationName}`);
        
        // Emit event for camera zoom
        this.events?.emit('location:selected', {
          id: locationId,
          name: locationName,
          position: markerGroup.position.clone()
        });
        
        return true; // Indicate click was handled
      }
    }
    
    return false;
  }
  
  /**
   * Get all locations for UI list
   */
  getLocations() {
    const locations = [];
    this.markers.forEach((marker, id) => {
      locations.push({
        id,
        name: marker.config.name,
        position: marker.group.position.clone()
      });
    });
    return locations;
  }
  
  /**
   * Get position of a specific location
   */
  getLocationPosition(id) {
    const marker = this.markers.get(id);
    return marker ? marker.group.position.clone() : null;
  }
  
  /**
   * Update animation (call in render loop)
   */
  update(deltaTime) {
    const time = this.clock.getElapsedTime();
    
    this.markers.forEach((marker) => {
      // Pulse ring
      const pulseScale = 1 + Math.sin(time * 3) * 0.2;
      marker.ring.scale.set(pulseScale, pulseScale, 1);
      marker.ring.material.opacity = 0.3 + Math.sin(time * 3) * 0.2;
      
      // Hover/bob sphere
      marker.sphere.position.y = Math.sin(time * 2) * 0.2;
      
      // Rotate ring slowly
      marker.ring.rotation.z = time * 0.5;
      
      // Make label always face camera (billboard)
      if (this.camera) {
        marker.label.quaternion.copy(this.camera.quaternion);
      }
    });
  }
  
  /**
   * Highlight a specific marker
   */
  highlightMarker(id, highlight = true) {
    const marker = this.markers.get(id);
    if (marker) {
      marker.sphere.material.opacity = highlight ? 1.0 : 0.8;
      marker.sphere.scale.setScalar(highlight ? 1.3 : 1.0);
    }
  }
  
  /**
   * Show/hide all markers
   */
  setVisible(visible) {
    this.markerGroup.visible = visible;
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    this.markers.forEach((marker) => {
      marker.sphere.geometry.dispose();
      marker.sphere.material.dispose();
      marker.ring.geometry.dispose();
      marker.ring.material.dispose();
      marker.beam.geometry.dispose();
      marker.beam.material.dispose();
      marker.label.material.map.dispose();
      marker.label.material.dispose();
    });
    
    this.markers.clear();
    this.scene.remove(this.markerGroup);
  }
}

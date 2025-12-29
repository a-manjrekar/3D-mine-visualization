/**
 * UIController - HTML Overlay Management
 * 
 * Manages the HTML UI elements layered above the WebGL canvas.
 * Handles connection status, vehicle count, and vehicle info display.
 */

export class UIController {
  constructor(options = {}) {
    this.events = options.events;
    
    // Track active location
    this.activeLocationId = null;
    
    // Cache DOM elements
    this.elements = {
      connectionStatus: document.getElementById('connection-status'),
      statusDot: document.querySelector('#connection-status .status-dot'),
      statusText: document.querySelector('#connection-status .status-text'),
      vehicleCount: document.getElementById('vehicle-count'),
      vehicleCountValue: document.querySelector('#vehicle-count .value'),
      vehicleInfo: document.getElementById('vehicle-info'),
      loadingIndicator: document.getElementById('loading-indicator'),
      loadingText: document.querySelector('#loading-indicator .loading-text'),
      locationPanel: document.getElementById('location-panel'),
      locationList: document.getElementById('location-list'),
      toggleLocations: document.getElementById('toggle-locations'),
      resetView: document.getElementById('reset-view')
    };
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  /**
   * Setup UI event listeners
   */
  setupEventListeners() {
    // Close button for vehicle info panel
    const closeBtn = document.querySelector('#vehicle-info .close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.hideVehicleInfo();
        this.events?.emit('vehicle:deselected');
      });
    }
    
    // Toggle location panel collapse
    if (this.elements.toggleLocations) {
      this.elements.toggleLocations.addEventListener('click', () => {
        this.toggleLocationPanel();
      });
    }
    
    // Reset view button
    if (this.elements.resetView) {
      this.elements.resetView.addEventListener('click', () => {
        this.events?.emit('camera:reset');
        this.clearActiveLocation();
      });
    }
  }
  
  /**
   * Toggle location panel expand/collapse
   */
  toggleLocationPanel() {
    const list = this.elements.locationList;
    const btn = this.elements.toggleLocations;
    
    if (list && btn) {
      list.classList.toggle('collapsed');
      btn.textContent = list.classList.contains('collapsed') ? '+' : '−';
    }
  }
  
  /**
   * Setup location buttons from available locations
   */
  setupLocationButtons(locations) {
    const list = this.elements.locationList;
    if (!list) return;
    
    // Clear existing buttons
    list.innerHTML = '';
    
    // Location color map (matching LocationMarkers)
    const colorMap = {
      'entry': '#4CAF50',
      'loading': '#FF9800',
      'extraction': '#F44336',
      'ventilation': '#00BCD4'
    };
    
    // Create button for each location
    locations.forEach((location) => {
      const button = document.createElement('button');
      button.className = 'location-btn';
      button.dataset.locationId = location.id;
      
      const color = colorMap[location.id] || '#00aaff';
      
      button.innerHTML = `
        <span class="location-icon" style="background: ${color}40; border: 2px solid ${color};">
          ${this.getLocationIcon(location.id)}
        </span>
        <span class="location-name">${location.name}</span>
      `;
      
      button.addEventListener('click', () => {
        this.events?.emit('location:goto', location.id);
      });
      
      list.appendChild(button);
    });
    
    console.log(`Created ${locations.length} location buttons`);
  }
  
  /**
   * Get icon emoji for location type
   */
  getLocationIcon(locationId) {
    const icons = {
      'entry': '🚪',
      'loading': '📦',
      'extraction': '⛏️',
      'ventilation': '💨'
    };
    return icons[locationId] || '📍';
  }
  
  /**
   * Set active location button
   */
  setActiveLocation(locationId) {
    // Clear previous active
    this.clearActiveLocation();
    
    // Set new active
    this.activeLocationId = locationId;
    const btn = this.elements.locationList?.querySelector(
      `[data-location-id="${locationId}"]`
    );
    if (btn) {
      btn.classList.add('active');
    }
  }
  
  /**
   * Clear active location
   */
  clearActiveLocation() {
    this.activeLocationId = null;
    const buttons = this.elements.locationList?.querySelectorAll('.location-btn');
    buttons?.forEach(btn => btn.classList.remove('active'));
  }
  
  /**
   * Update connection status display
   */
  updateConnectionStatus(status) {
    const { statusDot, statusText } = this.elements;
    
    // Remove all status classes
    statusDot?.classList.remove('connected', 'disconnected', 'connecting');
    
    switch (status) {
      case 'connected':
        statusDot?.classList.add('connected');
        if (statusText) statusText.textContent = 'Connected';
        break;
      case 'disconnected':
        statusDot?.classList.add('disconnected');
        if (statusText) statusText.textContent = 'Disconnected';
        break;
      case 'connecting':
        statusDot?.classList.add('connecting');
        if (statusText) statusText.textContent = 'Connecting...';
        break;
      case 'error':
        statusDot?.classList.add('disconnected');
        if (statusText) statusText.textContent = 'Connection Error';
        break;
    }
  }
  
  /**
   * Update vehicle count display
   */
  updateVehicleCount(count) {
    if (this.elements.vehicleCountValue) {
      this.elements.vehicleCountValue.textContent = count;
    }
  }
  
  /**
   * Show vehicle info panel
   */
  showVehicleInfo(data) {
    const panel = this.elements.vehicleInfo;
    if (!panel) return;
    
    // Update values
    const setTextContent = (selector, value) => {
      const el = panel.querySelector(selector);
      if (el) el.textContent = value;
    };
    
    setTextContent('.vehicle-id', data.id);
    setTextContent('.vehicle-type', this.formatVehicleType(data.type));
    setTextContent('.vehicle-position', `(${data.position.x}, ${data.position.y}, ${data.position.z})`);
    setTextContent('.vehicle-heading', `${data.heading}°`);
    setTextContent('.vehicle-speed', `${data.speed} km/h`);
    setTextContent('.vehicle-status', this.formatStatus(data.status));
    
    // Show panel
    panel.classList.remove('hidden');
  }
  
  /**
   * Hide vehicle info panel
   */
  hideVehicleInfo() {
    if (this.elements.vehicleInfo) {
      this.elements.vehicleInfo.classList.add('hidden');
    }
  }
  
  /**
   * Show loading indicator
   */
  showLoading(message = 'Loading...') {
    if (this.elements.loadingIndicator) {
      this.elements.loadingIndicator.classList.remove('hidden');
    }
    if (this.elements.loadingText) {
      this.elements.loadingText.textContent = message;
    }
  }
  
  /**
   * Hide loading indicator
   */
  hideLoading() {
    if (this.elements.loadingIndicator) {
      this.elements.loadingIndicator.classList.add('hidden');
    }
  }
  
  /**
   * Update loading message
   */
  updateLoadingMessage(message) {
    if (this.elements.loadingText) {
      this.elements.loadingText.textContent = message;
    }
  }
  
  /**
   * Show error message
   */
  showError(message) {
    // Could implement a toast notification system
    console.error('UI Error:', message);
    
    // For now, show in loading panel
    this.showLoading(`Error: ${message}`);
  }
  
  /**
   * Format vehicle type for display
   */
  formatVehicleType(type) {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  /**
   * Format status for display
   */
  formatStatus(status) {
    const statusMap = {
      'idle': 'Idle',
      'moving': 'Moving',
      'loading': 'Loading',
      'unloading': 'Unloading',
      'maintenance': 'Maintenance',
      'offline': 'Offline'
    };
    return statusMap[status] || status;
  }
}

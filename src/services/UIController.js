/**
 * UIController - HTML Overlay Management
 * 
 * Manages the HTML UI elements layered above the WebGL canvas.
 * Handles connection status, vehicle count, and vehicle info display.
 */

export class UIController {
  constructor(options = {}) {
    this.events = options.events;
    
    // Cache DOM elements
    this.elements = {
      connectionStatus: document.getElementById('connection-status'),
      statusDot: document.querySelector('#connection-status .status-dot'),
      statusText: document.querySelector('#connection-status .status-text'),
      vehicleCount: document.getElementById('vehicle-count'),
      vehicleCountValue: document.querySelector('#vehicle-count .value'),
      vehicleInfo: document.getElementById('vehicle-info'),
      loadingIndicator: document.getElementById('loading-indicator'),
      loadingText: document.querySelector('#loading-indicator .loading-text')
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

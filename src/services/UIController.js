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
    
    // Track follow mode
    this.isFollowingVehicle = false;
    this.followedVehicleId = null;
    
    // Track trails state
    this.trailsEnabled = false;
    
    // Track FPV mode
    this.isFPVActive = false;
    this.fpvVehicleId = null;
    
    // Track all vehicles for search
    this.vehicleData = new Map();
    
    // Filter state
    this.filterState = {
      types: { dump_truck: true, loader: true, haul_truck: true },
      status: { moving: true, idle: true, loading: true, maintenance: true },
      groups: { hauling: true, loading: true, transport: true }
    };
    
    // Level selector state
    this.selectedLevel = 'all';
    
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
      resetView: document.getElementById('reset-view'),
      // New elements
      legendPanel: document.getElementById('legend-panel'),
      legendList: document.getElementById('legend-list'),
      toggleLegend: document.getElementById('toggle-legend'),
      searchPanel: document.getElementById('search-panel'),
      searchInput: document.getElementById('vehicle-search'),
      searchClear: document.getElementById('search-clear'),
      searchResults: document.getElementById('search-results'),
      followBtn: document.getElementById('follow-vehicle'),
      minimapCanvas: document.getElementById('minimap-canvas'),
      // Trail and FPV elements
      trailsBtn: document.getElementById('toggle-trails'),
      fpvBtn: document.getElementById('fpv-vehicle'),
      fpvOverlay: document.getElementById('fpv-overlay'),
      fpvClose: document.getElementById('fpv-close'),
      fpvVehicleId: document.getElementById('fpv-vehicle-id'),
      fpvSpeed: document.getElementById('fpv-speed'),
      fpvStatus: document.getElementById('fpv-status'),
      fpvVideo: document.getElementById('fpv-video'),
      fpvTimestamp: document.getElementById('fpv-timestamp'),
      // Filter panel elements
      filterPanel: document.getElementById('vehicle-filter-panel'),
      filterContent: document.getElementById('filter-content'),
      toggleFilter: document.getElementById('toggle-filter'),
      applyFilters: document.getElementById('apply-filters'),
      resetFilters: document.getElementById('reset-filters'),
      // Level selector elements
      levelPanel: document.getElementById('level-selector-panel'),
      levelContent: document.getElementById('level-content'),
      toggleLevels: document.getElementById('toggle-levels')
    };
    
    // Setup event listeners
    this.setupEventListeners();
    this.setupFilterListeners();
    this.setupLevelListeners();
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
        this.stopFollowMode();
        this.events?.emit('vehicle:deselected');
      });
    }
    
    // Toggle location panel collapse
    if (this.elements.toggleLocations) {
      this.elements.toggleLocations.addEventListener('click', () => {
        this.toggleLocationPanel();
      });
    }
    
    // Toggle legend panel collapse
    if (this.elements.toggleLegend) {
      this.elements.toggleLegend.addEventListener('click', () => {
        this.toggleLegendPanel();
      });
    }
    
    // Reset view button
    if (this.elements.resetView) {
      this.elements.resetView.addEventListener('click', () => {
        this.stopFollowMode();
        this.events?.emit('camera:reset');
        this.clearActiveLocation();
      });
    }
    
    // Follow vehicle button
    if (this.elements.followBtn) {
      this.elements.followBtn.addEventListener('click', () => {
        this.toggleFollowMode();
      });
    }
    
    // Toggle trails button
    if (this.elements.trailsBtn) {
      this.elements.trailsBtn.addEventListener('click', () => {
        this.toggleTrails();
      });
    }
    
    // FPV button
    if (this.elements.fpvBtn) {
      this.elements.fpvBtn.addEventListener('click', () => {
        this.startFPVMode();
      });
    }
    
    // FPV close button
    if (this.elements.fpvClose) {
      this.elements.fpvClose.addEventListener('click', () => {
        this.stopFPVMode();
      });
    }
    
    // Listen for trails status updates
    this.events?.on('trails:status', (enabled) => {
      this.trailsEnabled = enabled;
      this.updateTrailsButton();
    });
    
    // Search input
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('input', (e) => {
        this.handleSearchInput(e.target.value);
      });
      
      this.elements.searchInput.addEventListener('focus', () => {
        if (this.elements.searchInput.value.trim()) {
          this.handleSearchInput(this.elements.searchInput.value);
        }
      });
    }
    
    // Search clear button
    if (this.elements.searchClear) {
      this.elements.searchClear.addEventListener('click', () => {
        this.clearSearch();
      });
    }
    
    // Click outside to close search results
    document.addEventListener('click', (e) => {
      if (!this.elements.searchPanel?.contains(e.target)) {
        this.elements.searchResults.innerHTML = '';
      }
    });
  }
  
  /**
   * Toggle legend panel expand/collapse
   */
  toggleLegendPanel() {
    const list = this.elements.legendList;
    const btn = this.elements.toggleLegend;
    
    if (list && btn) {
      list.classList.toggle('collapsed');
      btn.textContent = list.classList.contains('collapsed') ? '+' : '−';
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
    
    // Set followed vehicle for follow mode
    this.setFollowedVehicle(data.id);
    
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
  
  /**
   * Handle search input
   */
  handleSearchInput(query) {
    const clearBtn = this.elements.searchClear;
    const resultsContainer = this.elements.searchResults;
    
    // Show/hide clear button
    if (clearBtn) {
      clearBtn.classList.toggle('visible', query.length > 0);
    }
    
    if (!resultsContainer) return;
    
    // Clear results if no query
    if (!query.trim()) {
      resultsContainer.innerHTML = '';
      return;
    }
    
    // Search vehicles
    const searchTerm = query.toLowerCase();
    const matches = [];
    
    this.vehicleData.forEach((data, id) => {
      if (id.toLowerCase().includes(searchTerm) || 
          data.type?.toLowerCase().includes(searchTerm)) {
        matches.push({ id, ...data });
      }
    });
    
    // Render results
    if (matches.length === 0) {
      resultsContainer.innerHTML = '<div class="search-no-results">No vehicles found</div>';
    } else {
      resultsContainer.innerHTML = matches.slice(0, 5).map(vehicle => `
        <div class="search-result-item" data-vehicle-id="${vehicle.id}">
          <span class="search-result-id">${vehicle.id}</span>
          <span class="search-result-type">${this.formatVehicleType(vehicle.type || 'unknown')}</span>
        </div>
      `).join('');
      
      // Add click listeners
      resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
          const vehicleId = item.dataset.vehicleId;
          this.events?.emit('vehicle:search', vehicleId);
          this.clearSearch();
        });
      });
    }
  }
  
  /**
   * Clear search input and results
   */
  clearSearch() {
    if (this.elements.searchInput) {
      this.elements.searchInput.value = '';
    }
    if (this.elements.searchClear) {
      this.elements.searchClear.classList.remove('visible');
    }
    if (this.elements.searchResults) {
      this.elements.searchResults.innerHTML = '';
    }
  }
  
  /**
   * Update vehicle data for search
   */
  updateVehicleData(id, data) {
    this.vehicleData.set(id, data);
  }
  
  /**
   * Remove vehicle from search data
   */
  removeVehicleData(id) {
    this.vehicleData.delete(id);
  }
  
  /**
   * Toggle follow mode
   */
  toggleFollowMode() {
    if (this.isFollowingVehicle) {
      this.stopFollowMode();
    } else {
      this.startFollowMode();
    }
  }
  
  /**
   * Start following the selected vehicle
   */
  startFollowMode() {
    if (!this.followedVehicleId) return;
    
    this.isFollowingVehicle = true;
    this.elements.followBtn?.classList.add('active');
    this.events?.emit('vehicle:follow:start', this.followedVehicleId);
  }
  
  /**
   * Stop following vehicle
   */
  stopFollowMode() {
    this.isFollowingVehicle = false;
    this.elements.followBtn?.classList.remove('active');
    this.events?.emit('vehicle:follow:stop');
  }
  
  /**
   * Set the followed vehicle ID (called when vehicle is selected)
   */
  setFollowedVehicle(vehicleId) {
    this.followedVehicleId = vehicleId;
    
    // If already in follow mode, switch to new vehicle
    if (this.isFollowingVehicle) {
      this.events?.emit('vehicle:follow:start', vehicleId);
    }
  }
  
  /**
   * Toggle vehicle trails
   */
  toggleTrails() {
    this.events?.emit('trails:toggle');
  }
  
  /**
   * Update trails button state
   */
  updateTrailsButton() {
    if (this.elements.trailsBtn) {
      this.elements.trailsBtn.classList.toggle('active', this.trailsEnabled);
      const text = this.elements.trailsBtn.querySelector('.trails-text');
      if (text) {
        text.textContent = this.trailsEnabled ? 'Hide Trails' : 'Show Trails';
      }
    }
  }
  
  /**
   * Start first-person view mode
   */
  startFPVMode() {
    if (!this.followedVehicleId) return;
    
    this.isFPVActive = true;
    this.fpvVehicleId = this.followedVehicleId;
    this.elements.fpvBtn?.classList.add('active');
    this.events?.emit('fpv:start', this.fpvVehicleId);
  }
  
  /**
   * Stop first-person view mode
   */
  stopFPVMode() {
    this.isFPVActive = false;
    this.fpvVehicleId = null;
    this.elements.fpvBtn?.classList.remove('active');
    this.events?.emit('fpv:stop');
  }
  
  /**
   * Show FPV overlay with vehicle info
   */
  showFPVOverlay(vehicleId) {
    const overlay = this.elements.fpvOverlay;
    if (!overlay) return;
    
    overlay.classList.remove('hidden');
    
    // Update vehicle ID display
    if (this.elements.fpvVehicleId) {
      this.elements.fpvVehicleId.textContent = vehicleId;
    }
    
    // Start video playback (YouTube embed)
    if (this.elements.fpvVideo) {
      // Set YouTube embed URL with autoplay
      this.elements.fpvVideo.src = 'https://www.youtube.com/embed/9DKgMwRUuec?autoplay=1&mute=1&loop=1&playlist=9DKgMwRUuec&controls=0&showinfo=0&rel=0&modestbranding=1';
    }
    
    // Start updating FPV info and timestamp
    this.fpvUpdateInterval = setInterval(() => {
      this.updateFPVInfo();
      this.updateFPVTimestamp();
    }, 200);
  }
  
  /**
   * Hide FPV overlay
   */
  hideFPVOverlay() {
    const overlay = this.elements.fpvOverlay;
    if (overlay) {
      overlay.classList.add('hidden');
    }
    
    // Stop video (clear iframe src)
    if (this.elements.fpvVideo) {
      this.elements.fpvVideo.src = '';
    }
    
    // Stop updating FPV info
    if (this.fpvUpdateInterval) {
      clearInterval(this.fpvUpdateInterval);
      this.fpvUpdateInterval = null;
    }
  }
  
  /**
   * Update FPV timestamp display
   */
  updateFPVTimestamp() {
    if (this.elements.fpvTimestamp) {
      const now = new Date();
      const timestamp = now.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      const date = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      this.elements.fpvTimestamp.textContent = `${date} ${timestamp}`;
    }
  }
  
  /**
   * Update FPV overlay info
   */
  updateFPVInfo() {
    if (!this.fpvVehicleId) return;
    
    const vehicleData = this.vehicleData.get(this.fpvVehicleId);
    if (!vehicleData) return;
    
    if (this.elements.fpvSpeed) {
      this.elements.fpvSpeed.textContent = `${parseFloat(vehicleData.speed || 0).toFixed(1)} km/h`;
    }
    if (this.elements.fpvStatus) {
      this.elements.fpvStatus.textContent = this.formatStatus(vehicleData.status || 'unknown');
    }
  }
  
  /**
   * Setup filter panel event listeners
   */
  setupFilterListeners() {
    // Toggle filter panel
    if (this.elements.toggleFilter) {
      this.elements.toggleFilter.addEventListener('click', () => {
        this.toggleFilterPanel();
      });
    }
    
    // Apply filters button
    if (this.elements.applyFilters) {
      this.elements.applyFilters.addEventListener('click', () => {
        this.applyFilters();
      });
    }
    
    // Reset filters button
    if (this.elements.resetFilters) {
      this.elements.resetFilters.addEventListener('click', () => {
        this.resetFilters();
      });
    }
    
    // Individual checkbox listeners for immediate feedback
    const checkboxIds = [
      'filter-dump-truck', 'filter-loader', 'filter-haul-truck',
      'filter-moving', 'filter-idle', 'filter-loading', 'filter-maintenance',
      'filter-hauling', 'filter-loading-group', 'filter-transport'
    ];
    
    checkboxIds.forEach(id => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.addEventListener('change', () => {
          this.updateFilterState();
        });
      }
    });
  }
  
  /**
   * Toggle filter panel expand/collapse
   */
  toggleFilterPanel() {
    const content = this.elements.filterContent;
    const btn = this.elements.toggleFilter;
    
    if (content && btn) {
      content.classList.toggle('collapsed');
      btn.textContent = content.classList.contains('collapsed') ? '+' : '−';
    }
  }
  
  /**
   * Update filter state from checkboxes
   */
  updateFilterState() {
    // Type filters
    this.filterState.types.dump_truck = document.getElementById('filter-dump-truck')?.checked ?? true;
    this.filterState.types.loader = document.getElementById('filter-loader')?.checked ?? true;
    this.filterState.types.haul_truck = document.getElementById('filter-haul-truck')?.checked ?? true;
    
    // Status filters
    this.filterState.status.moving = document.getElementById('filter-moving')?.checked ?? true;
    this.filterState.status.idle = document.getElementById('filter-idle')?.checked ?? true;
    this.filterState.status.loading = document.getElementById('filter-loading')?.checked ?? true;
    this.filterState.status.maintenance = document.getElementById('filter-maintenance')?.checked ?? true;
    
    // Group filters
    this.filterState.groups.hauling = document.getElementById('filter-hauling')?.checked ?? true;
    this.filterState.groups.loading = document.getElementById('filter-loading-group')?.checked ?? true;
    this.filterState.groups.transport = document.getElementById('filter-transport')?.checked ?? true;
  }
  
  /**
   * Apply current filters
   */
  applyFilters() {
    this.updateFilterState();
    this.events?.emit('vehicles:filter', this.filterState);
    console.log('Filters applied:', this.filterState);
  }
  
  /**
   * Reset all filters to default (all checked)
   */
  resetFilters() {
    // Reset state
    Object.keys(this.filterState.types).forEach(k => this.filterState.types[k] = true);
    Object.keys(this.filterState.status).forEach(k => this.filterState.status[k] = true);
    Object.keys(this.filterState.groups).forEach(k => this.filterState.groups[k] = true);
    
    // Reset checkboxes
    const checkboxIds = [
      'filter-dump-truck', 'filter-loader', 'filter-haul-truck',
      'filter-moving', 'filter-idle', 'filter-loading', 'filter-maintenance',
      'filter-hauling', 'filter-loading-group', 'filter-transport'
    ];
    
    checkboxIds.forEach(id => {
      const checkbox = document.getElementById(id);
      if (checkbox) checkbox.checked = true;
    });
    
    // Emit reset
    this.events?.emit('vehicles:filter:reset');
    console.log('Filters reset');
  }
  
  /**
   * Update vehicle type counts in filter panel
   */
  updateFilterCounts(counts) {
    const countElements = {
      'count-dump-truck': counts.dump_truck || 0,
      'count-loader': counts.loader || 0,
      'count-haul-truck': counts.haul_truck || 0
    };
    
    Object.entries(countElements).forEach(([id, count]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = count;
    });
  }
  
  /**
   * Setup level selector event listeners
   */
  setupLevelListeners() {
    // Toggle level panel
    if (this.elements.toggleLevels) {
      this.elements.toggleLevels.addEventListener('click', () => {
        this.toggleLevelPanel();
      });
    }
    
    // Level item click listeners
    const levelItems = document.querySelectorAll('.level-item');
    levelItems.forEach(item => {
      item.addEventListener('click', () => {
        this.selectLevel(item.dataset.level);
      });
    });
  }
  
  /**
   * Toggle level panel expand/collapse
   */
  toggleLevelPanel() {
    const content = this.elements.levelContent;
    const btn = this.elements.toggleLevels;
    
    if (content && btn) {
      content.classList.toggle('collapsed');
      btn.textContent = content.classList.contains('collapsed') ? '+' : '−';
    }
  }
  
  /**
   * Select a mine level
   */
  selectLevel(level) {
    this.selectedLevel = level;
    
    // Update UI - remove active from all, add to selected
    const items = document.querySelectorAll('.level-item');
    items.forEach(item => {
      item.classList.toggle('active', item.dataset.level === level);
    });
    
    // Emit event
    this.events?.emit('level:select', level);
    console.log('Level selected:', level);
  }
  
  /**
   * Update vehicle counts per level
   */
  updateLevelCounts(counts) {
    // counts = { all: 7, 0: 3, 1: 2, 2: 1, 3: 1 }
    Object.entries(counts).forEach(([level, count]) => {
      const elId = level === 'all' ? 'vehicles-all' : `vehicles-level-${level}`;
      const el = document.getElementById(elId);
      if (el) el.textContent = count;
    });
  }
  
  /**
   * Get current filter state
   */
  getFilterState() {
    return this.filterState;
  }
  
  /**
   * Get current selected level
   */
  getSelectedLevel() {
    return this.selectedLevel;
  }
}

/**
 * DailySnapshotLoader - Convert history snapshots into renderable vehicle data
 * 
 * Takes truck snapshots from HistoryDataService and formats them for
 * the VehicleManager to display.
 */

export class DailySnapshotLoader {
  constructor(historyService, truckCatalog) {
    this.historyService = historyService;
    this.truckCatalog = truckCatalog;
  }
  
  /**
   * Load all vehicles for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Array} Array of vehicle data objects
   */
  loadDateSnapshot(date) {
    try {
      return this.historyService.exportDayAsVehicleData(date);
    } catch (error) {
      console.error(`Failed to load snapshot for date ${date}:`, error);
      return [];
    }
  }
  
  /**
   * Get a specific truck's snapshot for a date
   * @param {string} truckId - Truck ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Object|null} Vehicle data or null if not found
   */
  getTruckSnapshot(truckId, date) {
    const snapshot = this.historyService.getSnapshot(truckId, date);
    if (!snapshot) return null;
    
    const truck = this.historyService.getTruck(truckId);
    if (!truck) return null;
    
    return this.buildVehicleData(truck, snapshot);
  }
  
  /**
   * Convert truck + snapshot into renderable vehicle data
   * @private
   */
  buildVehicleData(truck, snapshot) {
    return {
      id: truck.id,
      type: truck.type,
      display_name: `${truck.id} - ${truck.driver}`,
      driver: truck.driver,
      
      // Position and orientation
      position: {
        x: snapshot.position.x,
        y: snapshot.position.y,
        z: snapshot.position.z
      },
      heading: snapshot.heading,
      status: snapshot.status,
      
      // 3D model info
      model_path: truck.catalog.model,
      color: truck.catalog.color,
      capacity_tons: truck.catalog.capacity_tons,
      
      // UI display info
      location_name: snapshot.location_name,
      metadata: {
        driver: truck.driver,
        location: snapshot.location_name,
        fuel_level: snapshot.fuel_level,
        work_hours: snapshot.work_hours,
        trips: snapshot.trips,
        material_tons: snapshot.material_moved_tons,
        notes: snapshot.notes,
        capacity_tons: truck.catalog.capacity_tons
      }
    };
  }
  
  /**
   * Get available dates
   * @returns {Array} Sorted array of dates
   */
  getAvailableDates() {
    return this.historyService.getAllDates();
  }
  
  /**
   * Get date range
   * @returns {Object} {start, end}
   */
  getDateRange() {
    return this.historyService.getDateRange();
  }
  
  /**
   * Validate that a date has snapshot data
   * @param {string} date - Date to check
   * @returns {boolean} True if date has data
   */
  isDateValid(date) {
    const snapshots = this.historyService.getTrucksByDate(date);
    return snapshots.length > 0;
  }
  
  /**
   * Get nearest valid date to a target date
   * @param {string} targetDate - Target date
   * @returns {string} Nearest date with data
   */
  getNearestValidDate(targetDate) {
    const dates = this.getAvailableDates();
    if (dates.length === 0) return null;
    
    if (dates.includes(targetDate)) {
      return targetDate;
    }
    
    // Find closest date
    let nearest = dates[0];
    let minDiff = Math.abs(new Date(targetDate) - new Date(nearest));
    
    dates.forEach(date => {
      const diff = Math.abs(new Date(targetDate) - new Date(date));
      if (diff < minDiff) {
        minDiff = diff;
        nearest = date;
      }
    });
    
    return nearest;
  }
  
  /**
   * Load all truck histories (for comparison/playback modes)
   * @returns {Array} All trucks with their full histories
   */
  loadAllTruckHistories() {
    return this.historyService.getAllTrucks().map(truck => ({
      id: truck.id,
      type: truck.type,
      driver: truck.driver,
      catalog: truck.catalog,
      history: truck.history.map(snapshot => 
        this.buildVehicleData(truck, snapshot)
      )
    }));
  }
}

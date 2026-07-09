/**
 * HistoryDataService - Load and query daily truck history
 * 
 * Manages historical data for all trucks over a date range.
 * Allows filtering by truck, date, and provides aggregated stats.
 */

export class HistoryDataService {
  constructor() {
    this.data = null;
    this.truckIndex = new Map(); // truckId -> truck object
    this.dateIndex = new Map();  // date -> array of snapshots
  }
  
  /**
   * Load history data from JSON file
   */
  async load(path) {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load history: ${response.statusText}`);
      }
      this.data = await response.json();
      this.buildIndices();
      console.log(`Loaded history for ${this.data.trucks.length} trucks`);
      return this.data;
    } catch (error) {
      console.error('Error loading history:', error);
      throw error;
    }
  }
  
  /**
   * Build lookup indices for fast queries
   */
  buildIndices() {
    // Index trucks by ID
    this.data.trucks.forEach(truck => {
      this.truckIndex.set(truck.id, truck);
      
      // Index each date for this truck
      truck.history.forEach(snapshot => {
        if (!this.dateIndex.has(snapshot.date)) {
          this.dateIndex.set(snapshot.date, []);
        }
        this.dateIndex.get(snapshot.date).push({
          truck: truck,
          snapshot: snapshot
        });
      });
    });
  }
  
  /**
   * Get all trucks visible on a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Array} Array of {truck, snapshot} objects
   */
  getTrucksByDate(date) {
    return this.dateIndex.get(date) || [];
  }
  
  /**
   * Get snapshot for specific truck on specific date
   * @param {string} truckId - Truck ID
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Object|null} Snapshot or null if not found
   */
  getSnapshot(truckId, date) {
    const truck = this.truckIndex.get(truckId);
    if (!truck) return null;
    return truck.history.find(h => h.date === date) || null;
  }
  
  /**
   * Get date range available in the data
   * @returns {Object} {start: date, end: date}
   */
  getDateRange() {
    return {
      start: this.data.metadata.date_range.start,
      end: this.data.metadata.date_range.end
    };
  }
  
  /**
   * Get all dates available
   * @returns {Array} Array of dates in YYYY-MM-DD format
   */
  getAllDates() {
    return Array.from(this.dateIndex.keys()).sort();
  }
  
  /**
   * Get truck by ID
   * @param {string} truckId - Truck ID
   * @returns {Object|null} Truck object or null
   */
  getTruck(truckId) {
    return this.truckIndex.get(truckId) || null;
  }
  
  /**
   * Get all trucks
   * @returns {Array} Array of truck objects
   */
  getAllTrucks() {
    return this.data.trucks;
  }
  
  /**
   * Get truck's history for a date range
   * @param {string} truckId - Truck ID
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {Array} History snapshots in date order
   */
  getTruckHistory(truckId, startDate, endDate) {
    const truck = this.getTruck(truckId);
    if (!truck) return [];
    
    return truck.history.filter(h => h.date >= startDate && h.date <= endDate);
  }
  
  /**
   * Get truck history limited to N most recent entries
   * @param {string} truckId - Truck ID
   * @param {number} limit - Maximum entries to return
   * @returns {Array} Recent history in reverse chronological order
   */
  getTruckRecentHistory(truckId, limit = 30) {
    const truck = this.getTruck(truckId);
    if (!truck) return [];
    return truck.history.slice(-limit).reverse();
  }
  
  /**
   * Get statistics for a specific date
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Object} Statistics for that date
   */
  getDateStatistics(date) {
    const snapshots = this.getTrucksByDate(date);
    
    const stats = {
      date: date,
      truck_count: snapshots.length,
      active_trucks: 0,
      idle_trucks: 0,
      maintenance_trucks: 0,
      total_material_moved: 0,
      total_work_hours: 0,
      total_trips: 0,
      by_type: {}
    };
    
    snapshots.forEach(({ truck, snapshot }) => {
      // Count by status
      if (snapshot.status === 'moving') stats.active_trucks++;
      else if (snapshot.status === 'idle') stats.idle_trucks++;
      else if (snapshot.status === 'maintenance') stats.maintenance_trucks++;
      
      // Accumulate totals
      stats.total_material_moved += snapshot.material_moved_tons || 0;
      stats.total_work_hours += snapshot.work_hours || 0;
      stats.total_trips += snapshot.trips || 0;
      
      // Count by type
      if (!stats.by_type[truck.type]) {
        stats.by_type[truck.type] = 0;
      }
      stats.by_type[truck.type]++;
    });
    
    return stats;
  }
  
  /**
   * Get truck movement between two dates
   * @param {string} truckId - Truck ID
   * @param {string} fromDate - Start date
   * @param {string} toDate - End date
   * @returns {Object} Movement data
   */
  getTruckMovement(truckId, fromDate, toDate) {
    const fromSnapshot = this.getSnapshot(truckId, fromDate);
    const toSnapshot = this.getSnapshot(truckId, toDate);
    
    if (!fromSnapshot || !toSnapshot) return null;
    
    const distance = Math.hypot(
      toSnapshot.position.x - fromSnapshot.position.x,
      toSnapshot.position.z - fromSnapshot.position.z
    );
    
    return {
      truck_id: truckId,
      from_date: fromDate,
      to_date: toDate,
      from_position: fromSnapshot.position,
      to_position: toSnapshot.position,
      distance_units: distance.toFixed(2),
      heading_change: (toSnapshot.heading - fromSnapshot.heading) % 360,
      material_moved_tons: toSnapshot.material_moved_tons - fromSnapshot.material_moved_tons
    };
  }
  
  /**
   * Export daily data as array for iteration
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Array} Array of vehicle data ready for rendering
   */
  exportDayAsVehicleData(date) {
    const snapshots = this.getTrucksByDate(date);
    
    return snapshots.map(({ truck, snapshot }) => ({
      id: truck.id,
      type: truck.type,
      driver: truck.driver,
      position: snapshot.position,
      heading: snapshot.heading,
      status: snapshot.status,
      location_name: snapshot.location_name,
      catalog: truck.catalog,
      metadata: {
        driver: truck.driver,
        location: snapshot.location_name,
        fuel_level: snapshot.fuel_level,
        work_hours: snapshot.work_hours,
        trips: snapshot.trips,
        material_tons: snapshot.material_moved_tons,
        notes: snapshot.notes
      }
    }));
  }
  
  /**
   * Get metadata
   */
  getMetadata() {
    return this.data.metadata;
  }
  
  /**
   * Get statistics summary
   */
  getStatistics() {
    return this.data.statistics;
  }
}

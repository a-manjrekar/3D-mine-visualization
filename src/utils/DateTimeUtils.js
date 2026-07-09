/**
 * DateTimeUtils - Date manipulation and formatting utilities
 * 
 * Provides helper functions for working with dates in YYYY-MM-DD format.
 */

export class DateTimeUtils {
  /**
   * Format a date to YYYY-MM-DD string
   * @param {Date|string} date - JavaScript Date or date string
   * @returns {string} Date in YYYY-MM-DD format
   */
  static formatDate(date) {
    if (typeof date === 'string') {
      // Already a string, validate and return
      if (this.isValidDate(date)) {
        return date;
      }
      date = new Date(date);
    }
    
    if (!(date instanceof Date)) {
      throw new Error('Invalid date input');
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }
  
  /**
   * Format date with human-readable text
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {string} Human-readable format (e.g., "June 30, 2026")
   */
  static formatDateReadable(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  /**
   * Format date with day of week
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {string} Format (e.g., "Monday, June 30, 2026")
   */
  static formatDateWithDay(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  /**
   * Add or subtract days from a date
   * @param {string} dateStr - Start date in YYYY-MM-DD format
   * @param {number} days - Number of days to add (negative to subtract)
   * @returns {string} New date in YYYY-MM-DD format
   */
  static addDays(dateStr, days) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return this.formatDate(date);
  }
  
  /**
   * Get previous day
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {string} Previous date
   */
  static previousDay(dateStr) {
    return this.addDays(dateStr, -1);
  }
  
  /**
   * Get next day
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {string} Next date
   */
  static nextDay(dateStr) {
    return this.addDays(dateStr, 1);
  }
  
  /**
   * Check if date is valid
   * @param {string} dateStr - Date string to validate
   * @returns {boolean} True if valid YYYY-MM-DD format
   */
  static isValidDate(dateStr) {
    // Check format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return false;
    }
    
    // Check if it's a real date
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
  }
  
  /**
   * Calculate difference in days between two dates
   * @param {string} date1Str - First date
   * @param {string} date2Str - Second date
   * @returns {number} Difference in days (positive if date2 > date1)
   */
  static daysBetween(date1Str, date2Str) {
    const d1 = new Date(date1Str);
    const d2 = new Date(date2Str);
    const diff = d2.getTime() - d1.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
  
  /**
   * Check if date is between two dates (inclusive)
   * @param {string} dateStr - Date to check
   * @param {string} startStr - Start date
   * @param {string} endStr - End date
   * @returns {boolean} True if date is between start and end
   */
  static isBetweenDates(dateStr, startStr, endStr) {
    return dateStr >= startStr && dateStr <= endStr;
  }
  
  /**
   * Get today's date
   * @returns {string} Today in YYYY-MM-DD format
   */
  static today() {
    return this.formatDate(new Date());
  }
  
  /**
   * Get week start (Monday)
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {string} Monday of that week
   */
  static weekStart(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
    return this.formatDate(new Date(date.setDate(diff)));
  }
  
  /**
   * Get week end (Sunday)
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {string} Sunday of that week
   */
  static weekEnd(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? 0 : 7); // adjust when day is Sunday
    return this.formatDate(new Date(date.setDate(diff)));
  }
  
  /**
   * Get month start
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {string} First day of that month
   */
  static monthStart(dateStr) {
    const date = new Date(dateStr);
    date.setDate(1);
    return this.formatDate(date);
  }
  
  /**
   * Get month end
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {string} Last day of that month
   */
  static monthEnd(dateStr) {
    const date = new Date(dateStr);
    date.setMonth(date.getMonth() + 1);
    date.setDate(0);
    return this.formatDate(date);
  }
  
  /**
   * Generate array of dates between two dates
   * @param {string} startStr - Start date
   * @param {string} endStr - End date
   * @returns {Array} Array of dates in YYYY-MM-DD format
   */
  static dateRange(startStr, endStr) {
    const dates = [];
    let current = new Date(startStr);
    const end = new Date(endStr);
    
    while (current <= end) {
      dates.push(this.formatDate(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }
  
  /**
   * Get relative date string (e.g., "2 days ago", "tomorrow")
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {string} Relative description
   */
  static getRelativeDate(dateStr) {
    const today = this.today();
    const diff = this.daysBetween(dateStr, today);
    
    if (diff === 0) return 'Today';
    if (diff === -1) return 'Tomorrow';
    if (diff === 1) return 'Yesterday';
    if (diff < 0) return `in ${-diff} days`;
    if (diff > 0) return `${diff} days ago`;
    
    return dateStr;
  }
}

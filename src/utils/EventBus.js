/**
 * EventBus - Simple Event System
 * 
 * Provides pub/sub event communication between components
 * without tight coupling. Lightweight alternative to complex
 * state management.
 */

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }
  
  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event).add(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }
  
  /**
   * Subscribe to an event once
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   */
  once(event, callback) {
    const wrapper = (...args) => {
      callback(...args);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }
  
  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Handler function to remove
   */
  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }
  
  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {...any} args - Arguments to pass to handlers
   */
  emit(event, ...args) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event handler for '${event}':`, error);
        }
      });
    }
  }
  
  /**
   * Get listener count for an event
   */
  listenerCount(event) {
    const callbacks = this.listeners.get(event);
    return callbacks ? callbacks.size : 0;
  }
  
  /**
   * Clear all listeners
   */
  clear() {
    this.listeners.clear();
  }
  
  /**
   * Clear listeners for a specific event
   */
  clearEvent(event) {
    this.listeners.delete(event);
  }
}

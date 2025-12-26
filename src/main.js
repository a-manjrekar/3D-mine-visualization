/**
 * Mine Visualization System - Main Entry Point
 * 
 * This is the application bootstrap file. It initializes all core systems
 * and starts the render loop. The architecture follows a modular pattern
 * to support scalability and maintainability.
 * 
 * Architecture Overview:
 * - Experience: Main controller managing all subsystems
 * - Renderer: WebGL rendering with performance optimizations
 * - Camera: Perspective camera with OrbitControls
 * - MineEnvironment: Loads and manages the mine GLTF model
 * - VehicleManager: Handles all vehicle instances and updates
 * - WebSocketService: Real-time data connection (simulated)
 * - UIController: HTML overlay management
 */

import { Experience } from './core/Experience.js';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the main experience controller
  const experience = new Experience({
    container: document.getElementById('canvas-container'),
    configPath: '/config/app-config.json'
  });
  
  // Expose to window for debugging (remove in production)
  if (import.meta.env.DEV) {
    window.experience = experience;
  }
  
  // Handle page visibility changes to pause/resume rendering
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      experience.pause();
    } else {
      experience.resume();
    }
  });
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    experience.dispose();
  });
});

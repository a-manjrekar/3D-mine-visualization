/**
 * ConfigLoader - Application Configuration Loader
 * 
 * Loads and validates configuration from JSON files.
 * Provides defaults for missing values.
 */

export class ConfigLoader {
  /**
   * Load configuration from JSON file
   * @param {string} path - Path to config file
   * @returns {Object} Configuration object
   */
  static async load(path) {
    try {
      const response = await fetch(path);
      
      if (!response.ok) {
        console.warn(`Config file not found: ${path}, using defaults`);
        return this.getDefaults();
      }
      
      const config = await response.json();
      
      // Merge with defaults
      return this.mergeWithDefaults(config);
      
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error);
      return this.getDefaults();
    }
  }
  
  /**
   * Get default configuration
   */
  static getDefaults() {
    return {
      // Renderer settings
      renderer: {
        antialias: true,
        maxPixelRatio: 2,
        toneMappingExposure: 1.0,
        shadows: false,
        clearColor: 0x0a0a0f
      },
      
      // Camera settings
      camera: {
        fov: 60,
        near: 0.1,
        far: 5000,
        initialPosition: { x: 50, y: 30, z: 50 },
        target: { x: 0, y: 0, z: 0 },
        dampingFactor: 0.05,
        zoomSpeed: 1.0,
        minDistance: 1,
        maxDistance: 500,
        panSpeed: 1.0,
        rotateSpeed: 0.5
      },
      
      // Mine environment settings
      mine: {
        modelPath: '/models/mine/scene.gltf',
        origin: { x: 0, y: 0, z: 0 },
        opacity: 0.5
      },
      
      // Lighting settings
      lighting: {
        ambient: {
          color: 0x404060,
          intensity: 0.3
        },
        hemisphere: {
          skyColor: 0x404060,
          groundColor: 0x202020,
          intensity: 0.4
        },
        pointLights: [],
        showHelpers: false
      },
      
      // Vehicle settings
      vehicles: {
        interpolationSpeed: 5.0,
        rotationSpeed: 3.0,
        types: [
          { type: 'dump_truck', modelPath: '/models/vehicles/truck.glb' },
          { type: 'loader', modelPath: '/models/vehicles/loader.glb' },
          { type: 'haul_truck', modelPath: '/models/vehicles/haul_truck.glb' }
        ]
      },
      
      // WebSocket settings
      websocket: {
        url: 'ws://localhost:8080',
        simulate: true,
        maxReconnectAttempts: 5,
        reconnectDelay: 3000
      },
      
      // Asset settings
      assets: {
        dracoPath: '/draco/'
      }
    };
  }
  
  /**
   * Merge user config with defaults (deep merge)
   */
  static mergeWithDefaults(userConfig) {
    const defaults = this.getDefaults();
    const merged = this.deepMerge(defaults, userConfig);
    // Parse hex color strings to numbers
    return this.parseColors(merged);
  }
  
  /**
   * Deep merge two objects
   * Arrays are replaced, not merged
   */
  static deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      // Arrays should replace, not merge
      if (Array.isArray(source[key])) {
        result[key] = source[key];
      } else if (source[key] instanceof Object && key in target && target[key] instanceof Object && !Array.isArray(target[key])) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
  
  /**
   * Parse hex color strings to numbers
   * Converts "0x404060" to 0x404060
   */
  static parseColors(config) {
    const parseValue = (value) => {
      if (typeof value === 'string' && value.startsWith('0x')) {
        return parseInt(value, 16);
      }
      return value;
    };
    
    const processObject = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(item => processObject(item));
      } else if (obj && typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
          result[key] = processObject(obj[key]);
        }
        return result;
      }
      return parseValue(obj);
    };
    
    return processObject(config);
  }
}

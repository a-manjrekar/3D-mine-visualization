/**
 * DeviceProfiler - Auto-detect device capabilities and choose performance tier
 * 
 * Analyzes GPU, CPU, and memory to recommend a graphics quality level.
 * Helps the app run smoothly on weak and strong PCs alike.
 */

export class DeviceProfiler {
  /**
   * Profile the device and return recommended performance tier
   * @returns {string} One of: 'low', 'medium', 'high'
   */
  static profile() {
    let score = 0;
    
    // GPU scoring
    const gpuScore = this.scoreGPU();
    score += gpuScore;
    
    // CPU scoring
    const cpuScore = this.scoreCPU();
    score += cpuScore;
    
    // Memory scoring
    const memScore = this.scoreMemory();
    score += memScore;
    
    // Pixel ratio (higher = more demanding)
    if (window.devicePixelRatio <= 1) {
      score += 2;
    } else if (window.devicePixelRatio <= 1.5) {
      score += 1;
    }
    
    // Decide tier
    if (score >= 7) {
      return 'high';
    } else if (score >= 4) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  /**
   * Score GPU capability
   * @private
   */
  static scoreGPU() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      
      if (!gl) {
        return 0; // No WebGL support
      }
      
      const gpu = gl.getParameter(gl.RENDERER).toLowerCase();
      const vendor = gl.getParameter(gl.VENDOR).toLowerCase();
      
      // High-end GPUs
      if (gpu.includes('geforce gtx 1080') || 
          gpu.includes('geforce rtx 2080') ||
          gpu.includes('geforce rtx 3080') ||
          gpu.includes('radeon rx 5700') ||
          gpu.includes('radeon pro') ||
          gpu.includes('apple m1') ||
          gpu.includes('apple m2')) {
        return 3;
      }
      
      // Mid-range GPUs
      if (gpu.includes('geforce gtx') ||
          gpu.includes('geforce rtx 2060') ||
          gpu.includes('geforce rtx 3060') ||
          gpu.includes('radeon rx') ||
          gpu.includes('iris')) {
        return 2;
      }
      
      // Integrated/Low-end
      if (gpu.includes('intel') || 
          gpu.includes('uhd') ||
          gpu.includes('hd graphics')) {
        return 1;
      }
      
      // Default: assume mid-range
      return 2;
    } catch (error) {
      console.warn('Failed to profile GPU:', error);
      return 1;
    }
  }
  
  /**
   * Score CPU capability
   * @private
   */
  static scoreCPU() {
    const cores = navigator.hardwareConcurrency || 4;
    
    if (cores >= 8) {
      return 2;
    } else if (cores >= 4) {
      return 1;
    } else {
      return 0;
    }
  }
  
  /**
   * Score memory availability
   * @private
   */
  static scoreMemory() {
    const memory = navigator.deviceMemory || 8;
    
    if (memory >= 16) {
      return 2;
    } else if (memory >= 8) {
      return 1;
    } else {
      return 0;
    }
  }
  
  /**
   * Get detailed device info for debugging
   */
  static getDeviceInfo() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      
      return {
        gpu: gl ? gl.getParameter(gl.RENDERER) : 'Unknown',
        vendor: gl ? gl.getParameter(gl.VENDOR) : 'Unknown',
        cpu_cores: navigator.hardwareConcurrency || 'Unknown',
        memory_gb: navigator.deviceMemory || 'Unknown',
        pixel_ratio: window.devicePixelRatio,
        screen_width: window.innerWidth,
        screen_height: window.innerHeight,
        user_agent: navigator.userAgent
      };
    } catch (error) {
      return { error: error.message };
    }
  }
  
  /**
   * Check if device supports WebGL 2.0
   */
  static supportsWebGL2() {
    try {
      const canvas = document.createElement('canvas');
      return !!canvas.getContext('webgl2');
    } catch (error) {
      return false;
    }
  }
}

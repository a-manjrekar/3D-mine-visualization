import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // Base public path when served in development or production
  base: './',
  
  // Development server configuration
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  
  // Build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimize for large 3D assets
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three']
        }
      }
    }
  },
  
  // Resolve aliases for cleaner imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils')
    }
  },
  
  // Asset handling for GLTF/GLB files
  assetsInclude: ['**/*.gltf', '**/*.glb', '**/*.bin']
});

/**
 * SpatialConstraints - Point-In-Mesh Containment Utility
 * 
 * PURPOSE:
 * This is NOT a physics simulation. This is a visual containment system.
 * It ensures vehicle meshes never visually exit the mine tunnels.
 * 
 * WHY CONTAINMENT (NOT PHYSICS):
 * - Physics engines are overkill for visual constraint
 * - We only need to answer: "Is this point inside the drivable area?"
 * - Real telemetry validation will replace this later
 * - This is architecturally clean and easy to swap out
 * 
 * HOW IT WORKS:
 * Uses ray casting with odd/even intersection counting.
 * A point is inside a closed mesh if a ray from that point
 * intersects the mesh an odd number of times.
 * 
 * PERFORMANCE:
 * - One raycast per vehicle per update (maximum)
 * - No per-frame mesh collision
 * - No geometry modification
 */

import * as THREE from 'three';

// Reusable objects to avoid garbage collection
const _raycaster = new THREE.Raycaster();
const _direction = new THREE.Vector3(0, 1, 0); // Cast upward
const _origin = new THREE.Vector3();

/**
 * Check if a point is inside a closed mesh volume
 * 
 * Uses raycasting with odd/even intersection count:
 * - Odd intersections = inside
 * - Even intersections = outside
 * 
 * @param {THREE.Vector3} point - The point to test
 * @param {THREE.Mesh|THREE.Object3D} volumeMesh - The containment volume mesh
 * @returns {boolean} True if point is inside the volume
 */
export function isInsideVolume(point, volumeMesh) {
  if (!point || !volumeMesh) {
    return false;
  }
  
  // Set ray origin to the test point
  _origin.copy(point);
  
  // Cast ray upward (Y+) from the point
  _raycaster.set(_origin, _direction);
  
  // Get all intersections with the volume mesh
  const intersects = _raycaster.intersectObject(volumeMesh, true);
  
  // Odd number of intersections = inside closed mesh
  // Even number (including 0) = outside
  return intersects.length % 2 === 1;
}

/**
 * Constrain a position to stay inside the drivable volume
 * 
 * If the new position is outside, returns the last valid position.
 * If no last valid position exists, returns the original position.
 * 
 * @param {THREE.Vector3} newPosition - Proposed new position
 * @param {THREE.Vector3|null} lastValidPosition - Last known valid position
 * @param {THREE.Mesh|THREE.Object3D} volumeMesh - The containment volume
 * @returns {{position: THREE.Vector3, isValid: boolean}} Constrained position and validity flag
 */
export function constrainToVolume(newPosition, lastValidPosition, volumeMesh) {
  // If no volume mesh, allow all positions (fallback)
  if (!volumeMesh) {
    return { position: newPosition, isValid: true };
  }
  
  const isInside = isInsideVolume(newPosition, volumeMesh);
  
  if (isInside) {
    // Position is valid - allow it
    return { position: newPosition, isValid: true };
  } else {
    // Position is outside - revert to last valid
    if (lastValidPosition) {
      return { position: lastValidPosition.clone(), isValid: false };
    }
    // No last valid position - allow but flag as invalid
    return { position: newPosition, isValid: false };
  }
}

/**
 * Alternative: Check if point is inside using bounding box + raycast hybrid
 * 
 * First does cheap bounding box check, then expensive raycast only if needed.
 * Use this for better performance with large volumes.
 * 
 * @param {THREE.Vector3} point - The point to test
 * @param {THREE.Mesh|THREE.Object3D} volumeMesh - The containment volume
 * @param {THREE.Box3} boundingBox - Pre-computed bounding box of volume
 * @returns {boolean} True if point is inside
 */
export function isInsideVolumeOptimized(point, volumeMesh, boundingBox) {
  // Quick reject: if outside bounding box, definitely outside
  if (boundingBox && !boundingBox.containsPoint(point)) {
    return false;
  }
  
  // Detailed check with raycast
  return isInsideVolume(point, volumeMesh);
}

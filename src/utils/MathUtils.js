/**
 * Math Utilities
 * 
 * Common mathematical functions for 3D calculations
 */

/**
 * Linear interpolation
 */
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

/**
 * Clamp value between min and max
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert degrees to radians
 */
export function degToRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians) {
  return radians * (180 / Math.PI);
}

/**
 * Normalize angle to 0-360 range
 */
export function normalizeAngle(angle) {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

/**
 * Calculate shortest angle difference
 */
export function angleDifference(from, to) {
  let diff = normalizeAngle(to) - normalizeAngle(from);
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

/**
 * Map value from one range to another
 */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Smooth step interpolation
 */
export function smoothStep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Calculate distance between two 3D points
 */
export function distance3D(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate heading from two points (in degrees)
 * Returns angle where 0 = North (+Z), 90 = East (+X)
 */
export function headingFromPoints(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return normalizeAngle(radToDeg(Math.atan2(dx, dz)));
}

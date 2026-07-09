import * as THREE from "three";

/**
 * Foot grounding for the VRM viewer.
 *
 * Problem it fixes: her feet float through / sink under the grid. Two causes:
 * (1) origin-CENTERED VRoid exports stand with hips at y=0 and feet at ~-0.9,
 * so the whole figure is half-buried in the ground plane; (2) .vrma clips and
 * procedural poses drop the feet below ground mid-motion.
 *
 * Approach: a ROOT-level grounding clamp — measure the lowest foot/toe bone in
 * the current (posed) skeleton each frame and, when its sole penetrates the
 * ground, raise `vrm.scene` just enough; ease back down when the animation
 * lifts, so intentional airtime (Jump) still reads as airtime. This is the
 * robust 90% of foot IK without fighting the animation. Per-leg analytic
 * 2-bone IK (planting each foot on uneven ground) can layer on later — this
 * module is where it belongs.
 */

const _v = new THREE.Vector3();

// The bone origin isn't the sole: ankles sit ~7 cm above it, toe bones ~2 cm.
const SOLE_OFFSET = { leftFoot: 0.07, rightFoot: 0.07, leftToes: 0.02, rightToes: 0.02 };

/** Lowest sole-point Y of the posed skeleton (world space), or null. */
function lowestSoleY(vrm) {
  const h = vrm.humanoid;
  if (!h) return null;
  let lowest = Infinity;
  for (const name of Object.keys(SOLE_OFFSET)) {
    const b = h.getRawBoneNode(name);
    if (!b) continue;
    b.getWorldPosition(_v); // forces parent matrixWorld refresh
    const sole = _v.y - SOLE_OFFSET[name];
    if (sole < lowest) lowest = sole;
  }
  return Number.isFinite(lowest) ? lowest : null;
}

/**
 * Per-frame grounding. Call AFTER vrm.update(dt). `state` is any persistent
 * object (the viewer's stateRef.current) — the current offset lives on
 * `state.groundOffset`. Fast rise (penetration is visibly wrong), slow settle
 * (no pogo bounce when a clip lifts her).
 */
export function groundFeet(vrm, state, dt, groundY = 0) {
  const lowest = lowestSoleY(vrm);
  if (lowest == null) return;
  const current = state.groundOffset || 0;
  const base = state.groundBase || 0; // resting offset from snapGround
  // `lowest` was measured WITH the current offset applied; undo it to get the
  // animation's own pose. Lift above base only to fix penetration; when the
  // pose lifts the feet (Jump), settle back to base — airtime stays airtime.
  const target = Math.max(base, groundY - (lowest - current));
  const rate = target > current ? 20 : 6;
  const next = current + (target - current) * Math.min(1, (dt || 0.016) * rate);
  state.groundOffset = next;
  vrm.scene.position.y = next;
}

/**
 * One-time snap at load: plant her on the ground BEFORE the camera auto-frames,
 * so origin-centered exports don't load half-buried (and the framing box then
 * includes the corrected position). Returns the applied offset.
 */
export function snapGround(vrm, state, groundY = 0) {
  vrm.scene.updateMatrixWorld(true);
  const lowest = lowestSoleY(vrm);
  if (lowest == null) return 0;
  // Exact plant — may be negative (model authored floating) or strongly
  // positive (origin-centered export, feet at ~-0.9). This becomes the
  // resting baseline groundFeet eases back to.
  const offset = groundY - lowest;
  state.groundBase = offset;
  state.groundOffset = offset;
  vrm.scene.position.y = offset;
  vrm.scene.updateMatrixWorld(true);
  return offset;
}

// Anatomically-plausible rotation limits (radians) applied on top of the animation clip.
const D = Math.PI / 180;

export const POSE_LIMITS = {
  head: { x: { min: -45*D, max: 45*D }, y: { min: -70*D, max: 70*D }, z: { min: -35*D, max: 35*D } },
  neck: { x: { min: -25*D, max: 25*D }, y: { min: -40*D, max: 40*D }, z: { min: -20*D, max: 20*D } },
  chest: { x: { min: -20*D, max: 25*D }, y: { min: -30*D, max: 30*D }, z: { min: -25*D, max: 25*D } },
  spine: { x: { min: -20*D, max: 25*D }, y: { min: -30*D, max: 30*D }, z: { min: -20*D, max: 20*D } },
  hips: { x: { min: -20*D, max: 20*D }, y: { min: -30*D, max: 30*D }, z: { min: -20*D, max: 20*D } },
  leftUpperArm: { x: { min: -90*D, max: 90*D }, y: { min: -80*D, max: 80*D }, z: { min: -30*D, max: 175*D } },
  rightUpperArm: { x: { min: -90*D, max: 90*D }, y: { min: -80*D, max: 80*D }, z: { min: -175*D, max: 30*D } },
  leftLowerArm: { x: { min: -150*D, max: 5*D }, y: { min: -20*D, max: 20*D }, z: { min: -30*D, max: 30*D } },
  rightLowerArm: { x: { min: -150*D, max: 5*D }, y: { min: -20*D, max: 20*D }, z: { min: -30*D, max: 30*D } },
  leftHand: { x: { min: -70*D, max: 70*D }, y: { min: -40*D, max: 40*D }, z: { min: -80*D, max: 20*D } },
  rightHand: { x: { min: -70*D, max: 70*D }, y: { min: -40*D, max: 40*D }, z: { min: -20*D, max: 80*D } },
  leftUpperLeg: { x: { min: -110*D, max: 45*D }, y: { min: -30*D, max: 45*D }, z: { min: -30*D, max: 45*D } },
  rightUpperLeg: { x: { min: -110*D, max: 45*D }, y: { min: -45*D, max: 30*D }, z: { min: -45*D, max: 30*D } },
  leftLowerLeg: { x: { min: -150*D, max: 2*D }, y: { min: -10*D, max: 10*D }, z: { min: -10*D, max: 10*D } },
  rightLowerLeg: { x: { min: -150*D, max: 2*D }, y: { min: -10*D, max: 10*D }, z: { min: -10*D, max: 10*D } },
};

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function clampBoneAxis(bone, axis, value) {
  const lim = POSE_LIMITS[bone]?.[axis];
  if (!lim) return value;
  return clamp(value, lim.min, lim.max);
}

export function clampBoneOffset(bone, offset) {
  if (!POSE_LIMITS[bone] || !offset) return offset;
  return {
    x: clampBoneAxis(bone, "x", offset.x || 0),
    y: clampBoneAxis(bone, "y", offset.y || 0),
    z: clampBoneAxis(bone, "z", offset.z || 0),
  };
}

export function clampAllBoneOffsets(boneOffsets) {
  const out = {};
  Object.entries(boneOffsets || {}).forEach(([bone, off]) => {
    out[bone] = clampBoneOffset(bone, off);
  });
  return out;
}

export function isAtLimit(bone, axis, value) {
  const lim = POSE_LIMITS[bone]?.[axis];
  if (!lim) return false;
  const eps = 0.005;
  return value <= lim.min + eps || value >= lim.max - eps;
}

export function getLimit(bone, axis) {
  return POSE_LIMITS[bone]?.[axis] || { min: -Math.PI, max: Math.PI };
}

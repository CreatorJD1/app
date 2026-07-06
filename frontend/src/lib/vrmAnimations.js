// Simple procedural animation clips for VRM humanoid, computed each frame.
// Instead of external clip files, we drive bones via math so the app is fully self-contained.

import * as THREE from "three";

export const CLIP_NAMES = ["idle", "wave", "dance", "walk", "sit", "none"];

function getBone(vrm, name) {
  return vrm?.humanoid?.getNormalizedBoneNode(name);
}

export function applyClip(vrm, clip, timeSec, speed = 1) {
  if (!vrm || !vrm.humanoid) return;
  const t = timeSec * speed;

  // Reset transforms of animated bones each frame (rotation only)
  const animatedBones = [
    "leftUpperArm",
    "rightUpperArm",
    "leftLowerArm",
    "rightLowerArm",
    "leftHand",
    "rightHand",
    "chest",
    "upperChest",
    "head",
    "neck",
    "spine",
    "hips",
    "leftUpperLeg",
    "rightUpperLeg",
    "leftLowerLeg",
    "rightLowerLeg",
  ];
  animatedBones.forEach((n) => {
    const b = getBone(vrm, n);
    if (b) b.rotation.set(0, 0, 0);
  });

  // Base T-pose corrections -> shoulders relaxed
  const relax = (bone, z) => {
    const b = getBone(vrm, bone);
    if (b) b.rotation.z = z;
  };
  relax("leftUpperArm", 1.2); // brings arm down
  relax("rightUpperArm", -1.2);

  switch (clip) {
    case "idle":
      idle(vrm, t);
      break;
    case "wave":
      idle(vrm, t * 0.7);
      wave(vrm, t);
      break;
    case "dance":
      dance(vrm, t);
      break;
    case "walk":
      walk(vrm, t);
      break;
    case "sit":
      sit(vrm, t);
      break;
    case "none":
    default:
      break;
  }
}

function idle(vrm, t) {
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const head = getBone(vrm, "head");
  const spine = getBone(vrm, "spine");
  const breath = Math.sin(t * 1.4) * 0.03;
  const sway = Math.sin(t * 0.6) * 0.03;
  if (chest) {
    chest.rotation.x += breath;
    chest.rotation.z += sway * 0.3;
  }
  if (spine) spine.rotation.z += sway * 0.15;
  if (head) {
    head.rotation.y += Math.sin(t * 0.5) * 0.08;
    head.rotation.x += Math.sin(t * 0.7) * 0.03;
  }
}

function wave(vrm, t) {
  const upper = getBone(vrm, "rightUpperArm");
  const lower = getBone(vrm, "rightLowerArm");
  const hand = getBone(vrm, "rightHand");
  if (upper) {
    upper.rotation.z = -1.5; // raise arm out
    upper.rotation.x = -0.6;
  }
  if (lower) {
    lower.rotation.z = -0.4 + Math.sin(t * 6) * 0.4;
  }
  if (hand) {
    hand.rotation.z = Math.sin(t * 6) * 0.3;
  }
}

function dance(vrm, t) {
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const spine = getBone(vrm, "spine");
  const hips = getBone(vrm, "hips");
  const head = getBone(vrm, "head");
  const lu = getBone(vrm, "leftUpperArm");
  const ru = getBone(vrm, "rightUpperArm");
  const ll = getBone(vrm, "leftLowerArm");
  const rl = getBone(vrm, "rightLowerArm");
  const beat = t * 3;
  const sway = Math.sin(beat) * 0.35;
  const bounce = Math.sin(beat * 2) * 0.15;
  if (hips) {
    hips.rotation.z = sway * 0.4;
    hips.rotation.y = Math.sin(beat * 0.5) * 0.2;
  }
  if (spine) spine.rotation.z = -sway * 0.3;
  if (chest) chest.rotation.z = -sway * 0.2;
  if (head) head.rotation.y = Math.sin(beat * 0.5) * 0.3;
  if (lu) lu.rotation.z = 1.0 + sway * 0.6;
  if (ru) ru.rotation.z = -1.0 - sway * 0.6;
  if (ll) ll.rotation.x = -1.0 - bounce;
  if (rl) rl.rotation.x = -1.0 + bounce;
}

function walk(vrm, t) {
  const speed = 3;
  const lUp = getBone(vrm, "leftUpperLeg");
  const rUp = getBone(vrm, "rightUpperLeg");
  const lLo = getBone(vrm, "leftLowerLeg");
  const rLo = getBone(vrm, "rightLowerLeg");
  const luA = getBone(vrm, "leftUpperArm");
  const ruA = getBone(vrm, "rightUpperArm");
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const swing = Math.sin(t * speed);
  if (lUp) lUp.rotation.x = swing * 0.6;
  if (rUp) rUp.rotation.x = -swing * 0.6;
  if (lLo) lLo.rotation.x = -Math.max(0, swing) * 0.6;
  if (rLo) rLo.rotation.x = -Math.max(0, -swing) * 0.6;
  if (luA) luA.rotation.x = -swing * 0.5;
  if (ruA) ruA.rotation.x = swing * 0.5;
  if (chest) chest.rotation.y = swing * 0.08;
}

function sit(vrm, t) {
  const lUp = getBone(vrm, "leftUpperLeg");
  const rUp = getBone(vrm, "rightUpperLeg");
  const lLo = getBone(vrm, "leftLowerLeg");
  const rLo = getBone(vrm, "rightLowerLeg");
  const spine = getBone(vrm, "spine");
  if (lUp) lUp.rotation.x = -1.5;
  if (rUp) rUp.rotation.x = -1.5;
  if (lLo) lLo.rotation.x = -1.5;
  if (rLo) rLo.rotation.x = -1.5;
  if (spine) spine.rotation.x = 0.05 + Math.sin(t * 1.2) * 0.02;
  const hips = getBone(vrm, "hips");
  if (hips) hips.position.y = -0.35;
}

export function applyAutoBlink(vrm, time) {
  if (!vrm.expressionManager) return;
  const blink = vrm.expressionManager.getExpression("blink");
  if (!blink) return;
  const cycle = 4.5; // seconds
  const local = time % cycle;
  let v = 0;
  if (local < 0.15) v = local / 0.15;
  else if (local < 0.3) v = 1 - (local - 0.15) / 0.15;
  else v = 0;
  // Blend with any user-set value: user override wins if > v
  const existing = blink.weight;
  if (v > existing) blink.weight = v;
}

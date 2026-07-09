// Procedural animation clips for VRM humanoid.
import * as THREE from "three";

function getBone(vrm, name) {
  return vrm?.humanoid?.getNormalizedBoneNode(name);
}

// All clips here are authored in the VRM 1.0 normalized-bone frame (the models
// Alpecca exports). three-vrm's normalized bones invert local x/z rotation on a
// VRM 0.x model, so for a 0.x model every clip is negated on x/z to match. On a
// 1.0 model the clips play as authored.
function _isVRM0(vrm) {
  const meta = vrm?.meta || {};
  return meta.metaVersion === "0" || !!meta.title;
}

const ANIMATED_BONES = [
  "leftUpperArm", "rightUpperArm", "leftLowerArm", "rightLowerArm",
  "leftHand", "rightHand",
  "chest", "upperChest", "head", "neck", "spine", "hips",
  "leftUpperLeg", "rightUpperLeg", "leftLowerLeg", "rightLowerLeg",
  "leftFoot", "rightFoot",
];

export function applyClip(vrm, clip, timeSec, speed = 1, extras = {}) {
  if (!vrm || !vrm.humanoid) return;
  const dur = extras.duration || 0;
  // If duration is set, remap time into a normalized cycle (loop or hold at end)
  let effT = timeSec * speed;
  if (dur > 0) {
    if (extras.loop === false) {
      effT = Math.min(effT, dur);
    } else {
      effT = effT % dur;
    }
  }
  const t = effT;

  ANIMATED_BONES.forEach((n) => {
    const b = getBone(vrm, n);
    if (b) b.rotation.set(0, 0, 0);
  });
  const hips = getBone(vrm, "hips");
  if (hips) hips.position.set(0, 0, 0);

  // Clips are authored 1.0-native; only a 0.x model needs the x/z negation.
  const isV0 = vrm.__isV0 ?? (vrm.__isV0 = _isVRM0(vrm));
  const flip = isV0 ? -1 : 1;

  relaxArms(vrm);

  switch (clip) {
    case "idle": idle(vrm, t); break;
    case "idle_soft": idleSoft(vrm, t); break;
    case "wave": idle(vrm, t * 0.7); wave(vrm, t); break;
    case "cheer": cheer(vrm, t); break;
    case "bow": bow(vrm, t); break;
    case "thinking": thinking(vrm, t); break;
    case "hands_hip": handsOnHips(vrm, t); break;
    case "peace": peaceSign(vrm, t); break;
    case "dance": dance(vrm, t); break;
    case "kpop": kpop(vrm, t); break;
    case "walk": walk(vrm, t); break;
    case "run": run(vrm, t); break;
    case "jump": jump(vrm, t); break;
    case "sit": sit(vrm, t); break;
    case "cry": cry(vrm, t); break;
    case "scream": scream(vrm, t); break;
    case "die": die(vrm, t); break;
    case "sleep": sleep(vrm, t); break;
    case "talking": talking(vrm, t, extras.talkEmotion); break;
    case "custom": custom(vrm, t, extras.customFrames); break;
    default: break;
  }

  // Normalize the authored clip into the model's bone frame. 'custom' timelines
  // are recorded live in the rendered frame, so leave them untouched.
  if (clip !== "custom" && flip < 0) {
    ANIMATED_BONES.forEach((n) => {
      const b = getBone(vrm, n);
      if (b) { b.rotation.x *= -1; b.rotation.z *= -1; }
    });
  }
}

// Rest arms down at the sides (VRM 1.0 frame): the left upper arm rests at
// z=-1.2, raising it needs +z. applyClip flips this for 0.x models.
function relaxArms(vrm) {
  const l = getBone(vrm, "leftUpperArm"); if (l) l.rotation.z = -1.2;
  const r = getBone(vrm, "rightUpperArm"); if (r) r.rotation.z = 1.2;
}

function idle(vrm, t) {
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const head = getBone(vrm, "head");
  const spine = getBone(vrm, "spine");
  const breath = Math.sin(t * 1.4) * 0.03;
  const sway = Math.sin(t * 0.6) * 0.03;
  if (chest) { chest.rotation.x += breath; chest.rotation.z += sway * 0.3; }
  if (spine) spine.rotation.z += sway * 0.15;
  if (head) { head.rotation.y += Math.sin(t * 0.5) * 0.08; head.rotation.x += Math.sin(t * 0.7) * 0.03; }
  const lh = getBone(vrm, "leftHand"), rh = getBone(vrm, "rightHand");
  if (lh) lh.rotation.z = Math.sin(t * 0.8) * 0.05;
  if (rh) rh.rotation.z = -Math.sin(t * 0.8) * 0.05;
}

function idleSoft(vrm, t) {
  idle(vrm, t * 0.6);
  const hips = getBone(vrm, "hips");
  if (hips) hips.rotation.y = Math.sin(t * 0.35) * 0.04;
}

function wave(vrm, t) {
  const upper = getBone(vrm, "rightUpperArm");
  const lower = getBone(vrm, "rightLowerArm");
  const hand = getBone(vrm, "rightHand");
  if (upper) { upper.rotation.z = -1.5; upper.rotation.x = -0.6; }
  if (lower) lower.rotation.z = -0.4 + Math.sin(t * 6) * 0.4;
  if (hand) hand.rotation.z = Math.sin(t * 6) * 0.3;
}

// NATIVE_1_0: authored in the VRM 1.0 frame (ported from the proven Alpecca /vrm
// renderer). ±2.2 puts both hands up overhead; Emergent's original ±3.0 overshot
// half a turn and landed the arms horizontal.
function cheer(vrm, t) {
  const lu = getBone(vrm, "leftUpperArm"), ru = getBone(vrm, "rightUpperArm");
  const ll = getBone(vrm, "leftLowerArm"), rl = getBone(vrm, "rightLowerArm");
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const head = getBone(vrm, "head");
  const beat = Math.sin(t * 5);
  if (lu) lu.rotation.z = 2.2 + Math.abs(beat) * 0.15;
  if (ru) ru.rotation.z = -2.2 - Math.abs(beat) * 0.15;
  if (ll) ll.rotation.z = 0.3 + beat * 0.15;    // elbows folded a touch, pulsing
  if (rl) rl.rotation.z = -0.3 - beat * 0.15;
  if (chest) chest.rotation.x = beat * 0.05;
  if (head) head.rotation.x = -beat * 0.08;
}

function bow(vrm, t) {
  const cycle = 3.0;
  const local = (t % cycle) / cycle;
  // ease down and up
  let amt = 0;
  if (local < 0.3) amt = local / 0.3;
  else if (local < 0.6) amt = 1;
  else amt = 1 - (local - 0.6) / 0.4;
  const spine = getBone(vrm, "spine");
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const head = getBone(vrm, "head");
  const bend = amt * 0.62;   // a polite ~30° bow, not folded to the knees
  if (spine) spine.rotation.x = bend * 0.5;
  if (chest) chest.rotation.x = bend * 0.4;
  if (head) head.rotation.x = bend * 0.15;
}

// NATIVE_1_0: fold the forearm up in the frontal plane so the hand rests near her
// chin. Emergent's original folded the elbow around x on a sideways arm, which is
// a twist — the arm just stuck straight out. Ported from the Alpecca /vrm renderer.
function thinking(vrm, t) {
  const ru = getBone(vrm, "rightUpperArm");
  const rl = getBone(vrm, "rightLowerArm");
  const rh = getBone(vrm, "rightHand");
  const head = getBone(vrm, "head");
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  if (ru) { ru.rotation.z = 0.9; ru.rotation.y = 0.25; }
  if (rl) { rl.rotation.z = -2.5; rl.rotation.y = 0.5; }
  if (rh) rh.rotation.z = -0.5;
  if (head) { head.rotation.z = -0.15; head.rotation.x = 0.08; head.rotation.y = Math.sin(t * 0.5) * 0.1; }
  if (chest) chest.rotation.z = 0.05;
}

function handsOnHips(vrm, t) {
  const lu = getBone(vrm, "leftUpperArm"), ru = getBone(vrm, "rightUpperArm");
  const ll = getBone(vrm, "leftLowerArm"), rl = getBone(vrm, "rightLowerArm");
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  // 1.0-native: upper arms hang near the sides with the elbows swung out and
  // back; forearms fold moderately forward-and-in so the hands settle on the
  // waist (too strong a fold lifts the hands up to the head).
  if (lu) { lu.rotation.z = -1.0; lu.rotation.y = 0.4; }
  if (ru) { ru.rotation.z = 1.0; ru.rotation.y = -0.4; }
  if (ll) { ll.rotation.z = 1.4; ll.rotation.y = -0.5; }
  if (rl) { rl.rotation.z = -1.4; rl.rotation.y = 0.5; }
  if (chest) chest.rotation.y = Math.sin(t * 0.9) * 0.05;
}

function peaceSign(vrm, t) {
  const ru = getBone(vrm, "rightUpperArm");
  const rl = getBone(vrm, "rightLowerArm");
  const rh = getBone(vrm, "rightHand");
  const head = getBone(vrm, "head");
  if (ru) { ru.rotation.z = -1.7; ru.rotation.x = -0.6; }
  if (rl) rl.rotation.x = -1.2;
  if (rh) rh.rotation.z = -0.1 + Math.sin(t * 3) * 0.05;
  if (head) head.rotation.y = Math.sin(t * 0.6) * 0.15;
  idle(vrm, t * 0.6);
}

function dance(vrm, t) {
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const spine = getBone(vrm, "spine");
  const hips = getBone(vrm, "hips");
  const head = getBone(vrm, "head");
  const lu = getBone(vrm, "leftUpperArm"), ru = getBone(vrm, "rightUpperArm");
  const ll = getBone(vrm, "leftLowerArm"), rl = getBone(vrm, "rightLowerArm");
  const beat = t * 3;
  const sway = Math.sin(beat) * 0.35;
  const bounce = Math.sin(beat * 2) * 0.15;
  if (hips) { hips.rotation.z = sway * 0.4; hips.rotation.y = Math.sin(beat * 0.5) * 0.2; hips.position.y = -Math.abs(Math.sin(beat)) * 0.06; }
  if (spine) spine.rotation.z = -sway * 0.3;
  if (chest) chest.rotation.z = -sway * 0.2;
  if (head) head.rotation.y = Math.sin(beat * 0.5) * 0.3;
  if (lu) lu.rotation.z = 1.0 + sway * 0.6;
  if (ru) ru.rotation.z = -1.0 - sway * 0.6;
  if (ll) ll.rotation.x = -1.0 - bounce;
  if (rl) rl.rotation.x = -1.0 + bounce;
}

function kpop(vrm, t) {
  const beat = t * 4;
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const spine = getBone(vrm, "spine");
  const hips = getBone(vrm, "hips");
  const head = getBone(vrm, "head");
  const lu = getBone(vrm, "leftUpperArm"), ru = getBone(vrm, "rightUpperArm");
  const ll = getBone(vrm, "leftLowerArm"), rl = getBone(vrm, "rightLowerArm");
  const step = Math.sin(beat);
  const punch = Math.sin(beat * 2) > 0.4 ? 1 : 0;
  if (hips) { hips.rotation.y = step * 0.25; hips.position.y = -Math.abs(step) * 0.04; }
  if (spine) spine.rotation.y = -step * 0.15;
  if (chest) chest.rotation.z = step * 0.12;
  if (head) head.rotation.y = step * 0.2;
  if (lu) { lu.rotation.z = 1.0 + (step > 0 ? 1.2 * punch : 0); lu.rotation.x = -0.3 - (step > 0 ? 0.9 * punch : 0); }
  if (ru) { ru.rotation.z = -1.0 - (step < 0 ? 1.2 * punch : 0); ru.rotation.x = -0.3 - (step < 0 ? 0.9 * punch : 0); }
  if (ll) ll.rotation.x = -0.6 - (step > 0 ? 0.5 * punch : 0);
  if (rl) rl.rotation.x = -0.6 - (step < 0 ? 0.5 * punch : 0);
}

function walk(vrm, t) {
  const swing = Math.sin(t * 3);
  const abs = Math.abs(swing);
  const lUp = getBone(vrm, "leftUpperLeg"), rUp = getBone(vrm, "rightUpperLeg");
  const lLo = getBone(vrm, "leftLowerLeg"), rLo = getBone(vrm, "rightLowerLeg");
  const luA = getBone(vrm, "leftUpperArm"), ruA = getBone(vrm, "rightUpperArm");
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const hips = getBone(vrm, "hips");
  if (lUp) lUp.rotation.x = swing * 0.6;
  if (rUp) rUp.rotation.x = -swing * 0.6;
  if (lLo) lLo.rotation.x = -Math.max(0, -swing) * 0.9;
  if (rLo) rLo.rotation.x = -Math.max(0, swing) * 0.9;
  if (luA) luA.rotation.x = -swing * 0.5;
  if (ruA) ruA.rotation.x = swing * 0.5;
  if (chest) chest.rotation.y = swing * 0.08;
  if (hips) hips.position.y = -abs * 0.02;
}

function run(vrm, t) {
  const swing = Math.sin(t * 6);
  const abs = Math.abs(swing);
  const lUp = getBone(vrm, "leftUpperLeg"), rUp = getBone(vrm, "rightUpperLeg");
  const lLo = getBone(vrm, "leftLowerLeg"), rLo = getBone(vrm, "rightLowerLeg");
  const luA = getBone(vrm, "leftUpperArm"), ruA = getBone(vrm, "rightUpperArm");
  const llA = getBone(vrm, "leftLowerArm"), rlA = getBone(vrm, "rightLowerArm");
  const spine = getBone(vrm, "spine");
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const hips = getBone(vrm, "hips");
  if (lUp) lUp.rotation.x = swing * 1.05;
  if (rUp) rUp.rotation.x = -swing * 1.05;
  if (lLo) lLo.rotation.x = -Math.max(0, -swing) * 1.6;
  if (rLo) rLo.rotation.x = -Math.max(0, swing) * 1.6;
  // Arms stay down at the sides (relaxArms rest z), elbows bent ~90°, pumping
  // forward/back opposite the legs.
  if (luA) luA.rotation.x = -0.2 + swing * 0.9;
  if (ruA) ruA.rotation.x = -0.2 - swing * 0.9;
  if (llA) llA.rotation.x = -1.6;
  if (rlA) rlA.rotation.x = -1.6;
  if (spine) spine.rotation.x = 0.18;
  if (chest) chest.rotation.y = swing * 0.15;
  if (hips) hips.position.y = -abs * 0.04;
}

function jump(vrm, t) {
  const cycle = 1.4;
  const local = (t % cycle) / cycle;
  const hips = getBone(vrm, "hips");
  const spine = getBone(vrm, "spine");
  const luA = getBone(vrm, "leftUpperArm"), ruA = getBone(vrm, "rightUpperArm");
  const lUp = getBone(vrm, "leftUpperLeg"), rUp = getBone(vrm, "rightUpperLeg");
  const lLo = getBone(vrm, "leftLowerLeg"), rLo = getBone(vrm, "rightLowerLeg");
  let hipY = 0, crouch = 0;
  if (local < 0.2) { crouch = local / 0.2; hipY = -0.18 * crouch; }
  else if (local < 0.5) {
    const air = (local - 0.2) / 0.3;
    hipY = Math.max(0, -Math.pow(1 - air * 2, 2) * 0.4 + 0.4);
  } else if (local < 0.7) {
    const land = (local - 0.5) / 0.2;
    hipY = -0.2 * land;
    crouch = land;
  } else {
    const rec = (local - 0.7) / 0.3;
    hipY = -0.2 * (1 - rec);
    crouch = 1 - rec;
  }
  if (hips) hips.position.y = hipY;
  if (spine) spine.rotation.x = crouch * 0.25;
  const knee = -1.2 * crouch;
  if (lUp) lUp.rotation.x = -0.5 * crouch + (local > 0.2 && local < 0.5 ? 0.5 : 0);
  if (rUp) rUp.rotation.x = -0.5 * crouch + (local > 0.2 && local < 0.5 ? 0.5 : 0);
  if (lLo) lLo.rotation.x = knee;
  if (rLo) rLo.rotation.x = knee;
  const armX = local < 0.2 ? -local / 0.2 * 0.5 : local < 0.5 ? -1.5 : local < 0.7 ? -1.0 : -0.2;
  if (luA) { luA.rotation.z = 1.2; luA.rotation.x = armX; }
  if (ruA) { ruA.rotation.z = -1.2; ruA.rotation.x = armX; }
}

function sit(vrm, t) {
  const lUp = getBone(vrm, "leftUpperLeg"), rUp = getBone(vrm, "rightUpperLeg");
  const lLo = getBone(vrm, "leftLowerLeg"), rLo = getBone(vrm, "rightLowerLeg");
  const spine = getBone(vrm, "spine");
  if (lUp) lUp.rotation.x = -1.5;
  if (rUp) rUp.rotation.x = -1.5;
  if (lLo) lLo.rotation.x = -1.5;
  if (rLo) rLo.rotation.x = -1.5;
  if (spine) spine.rotation.x = 0.05 + Math.sin(t * 1.2) * 0.02;
  const hips = getBone(vrm, "hips");
  if (hips) hips.position.y = -0.35;
}

// 1.0-native (from the Alpecca /vrm renderer): head down, shoulders hunched,
// elbows folded up in the frontal plane so both hands come to her face, shaking.
function cry(vrm, t) {
  const head = getBone(vrm, "head");
  const spine = getBone(vrm, "spine");
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const lu = getBone(vrm, "leftUpperArm"), ru = getBone(vrm, "rightUpperArm");
  const ll = getBone(vrm, "leftLowerArm"), rl = getBone(vrm, "rightLowerArm");
  const shake = Math.sin(t * 8) * 0.03;
  if (spine) spine.rotation.x = 0.25;
  if (chest) chest.rotation.x = 0.2 + shake;
  if (head) { head.rotation.x = 0.4; head.rotation.z = shake * 3; }
  if (lu) { lu.rotation.z = -0.9; lu.rotation.y = -0.35; }
  if (ru) { ru.rotation.z = 0.9; ru.rotation.y = 0.35; }
  if (ll) { ll.rotation.z = 2.5; ll.rotation.y = -0.5; }
  if (rl) { rl.rotation.z = -2.5; rl.rotation.y = 0.5; }
}

function scream(vrm, t) {
  // Head back, mouth open, arms flung wide, chest heaving
  const head = getBone(vrm, "head");
  const neck = getBone(vrm, "neck");
  const spine = getBone(vrm, "spine");
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const lu = getBone(vrm, "leftUpperArm"), ru = getBone(vrm, "rightUpperArm");
  const ll = getBone(vrm, "leftLowerArm"), rl = getBone(vrm, "rightLowerArm");
  const heave = Math.sin(t * 4) * 0.08;
  if (spine) spine.rotation.x = -0.15;
  if (chest) chest.rotation.x = -0.1 + heave;
  if (neck) neck.rotation.x = -0.35;
  if (head) head.rotation.x = -0.4;
  if (lu) { lu.rotation.z = 2.6; lu.rotation.x = -0.6; }
  if (ru) { ru.rotation.z = -2.6; ru.rotation.x = -0.6; }
  if (ll) ll.rotation.x = -0.4;
  if (rl) rl.rotation.x = -0.4;
  // Mouth + surprised face are tied in via applyClipExpressions().
}

function die(vrm, t) {
  // Fall down: crumple over ~1s, then rest.
  const collapseTime = 1.0;
  const p = Math.min(1, t / collapseTime);
  const ease = 1 - Math.pow(1 - p, 3); // ease-out cubic
  const spine = getBone(vrm, "spine");
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const head = getBone(vrm, "head");
  const hips = getBone(vrm, "hips");
  const lu = getBone(vrm, "leftUpperArm"), ru = getBone(vrm, "rightUpperArm");
  const ll = getBone(vrm, "leftLowerArm"), rl = getBone(vrm, "rightLowerArm");
  const lUp = getBone(vrm, "leftUpperLeg"), rUp = getBone(vrm, "rightUpperLeg");
  const lLo = getBone(vrm, "leftLowerLeg"), rLo = getBone(vrm, "rightLowerLeg");
  if (spine) spine.rotation.x = 1.2 * ease;
  if (chest) chest.rotation.x = 0.6 * ease;
  if (head) head.rotation.x = 0.6 * ease;
  if (hips) hips.position.y = -0.5 * ease;
  if (lu) { lu.rotation.z = 0.5 - 0.3 * ease; lu.rotation.x = 0.4 * ease; }
  if (ru) { ru.rotation.z = -0.5 + 0.3 * ease; ru.rotation.x = 0.4 * ease; }
  if (ll) ll.rotation.x = -0.5 * ease;
  if (rl) rl.rotation.x = -0.5 * ease;
  if (lUp) lUp.rotation.x = -0.5 * ease;
  if (rUp) rUp.rotation.x = -0.5 * ease;
  if (lLo) lLo.rotation.x = -0.8 * ease;
  if (rLo) rLo.rotation.x = -0.8 * ease;
  // Tiny post-death sway
  if (p >= 1 && chest) chest.rotation.z = Math.sin(t * 0.3) * 0.02;
}

function sleep(vrm, t) {
  // Sit + head lolling, gentle breathing
  const lUp = getBone(vrm, "leftUpperLeg"), rUp = getBone(vrm, "rightUpperLeg");
  const lLo = getBone(vrm, "leftLowerLeg"), rLo = getBone(vrm, "rightLowerLeg");
  const spine = getBone(vrm, "spine");
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const head = getBone(vrm, "head");
  const lu = getBone(vrm, "leftUpperArm"), ru = getBone(vrm, "rightUpperArm");
  const hips = getBone(vrm, "hips");
  const breath = Math.sin(t * 1.0) * 0.04;
  if (lUp) lUp.rotation.x = -1.5;
  if (rUp) rUp.rotation.x = -1.5;
  if (lLo) lLo.rotation.x = -1.5;
  if (rLo) rLo.rotation.x = -1.5;
  if (spine) spine.rotation.x = 0.3;
  if (chest) chest.rotation.x = 0.2 + breath;
  if (head) { head.rotation.x = 0.5; head.rotation.z = 0.35; }   // lolls to the side
  if (lu) { lu.rotation.z = -1.4; lu.rotation.x = -0.15; }   // arms resting (1.0 frame)
  if (ru) { ru.rotation.z = 1.4; ru.rotation.x = -0.15; }
  if (hips) hips.position.y = -0.35;
  // Closed eyes + relaxed face are tied in via applyClipExpressions().
}

// Talking: light idle sway + a head bob for emphasis. The mouth-shape cycling
// and the emotion overlay are time-driven expressions, applied in
// applyClipExpressions() (which runs after the viewer resets expressions).
function talking(vrm, t /*, emotion */) {
  idle(vrm, t * 0.5);
  const head = getBone(vrm, "head");
  if (head) head.rotation.x += Math.sin(t * 4) * 0.02;
}

function custom(vrm, t, frames) {
  if (!frames || frames.length < 1) return;
  const sorted = [...frames].sort((a, b) => a.time - b.time);
  const duration = Math.max(0.001, sorted[sorted.length - 1].time || 1);
  const local = t % duration;
  let prev = sorted[0], next = sorted[sorted.length - 1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].time <= local && sorted[i + 1].time >= local) {
      prev = sorted[i]; next = sorted[i + 1]; break;
    }
  }
  const span = Math.max(0.001, next.time - prev.time);
  const alpha = (local - prev.time) / span;
  const a = alpha < 0.5 ? 2 * alpha * alpha : 1 - Math.pow(-2 * alpha + 2, 2) / 2;
  const pOff = prev.boneOffsets || {}, nOff = next.boneOffsets || {};
  const bones = new Set([...Object.keys(pOff), ...Object.keys(nOff)]);
  bones.forEach((bone) => {
    const p = pOff[bone] || { x: 0, y: 0, z: 0 };
    const n = nOff[bone] || { x: 0, y: 0, z: 0 };
    const node = getBone(vrm, bone);
    if (!node) return;
    node.rotation.set(p.x + (n.x - p.x) * a, p.y + (n.y - p.y) * a, p.z + (n.z - p.z) * a);
  });
}

export function applyAutoBlink(vrm, time) {
  if (!vrm.expressionManager) return;
  const blink = vrm.expressionManager.getExpression("blink");
  if (!blink) return;
  const cycle = 4.5;
  const local = time % cycle;
  let v = 0;
  if (local < 0.15) v = local / 0.15;
  else if (local < 0.3) v = 1 - (local - 0.15) / 0.15;
  const existing = blink.weight;
  if (v > existing) blink.weight = v;
}

// ---- Procedural gaze: natural saccades + gaze-aversion (ChatVRM AutoLookAt) ----
// When the user isn't actively steering the eyes with the mouse, the eyes should
// still move: brief fixations, occasional aversions (look away/down), smooth
// pursuit between them. Returns a small normalized {x,y} gaze offset. One VRM at
// a time, so a module-level accumulator is fine.
const _gaze = { next: 0, cur: { x: 0, y: 0 }, tgt: { x: 0, y: 0 } };
export function computeGaze(time) {
  if (time >= _gaze.next) {
    const avert = Math.random() < 0.3; // occasionally look away/down
    _gaze.tgt.x = (Math.random() * 2 - 1) * (avert ? 0.55 : 0.3);
    _gaze.tgt.y = (Math.random() * 2 - 1) * 0.18 - (avert ? 0.12 : 0.03);
    _gaze.next = time + 0.8 + Math.random() * 2.4; // fixation 0.8–3.2s
  }
  // smooth pursuit toward the current fixation point
  _gaze.cur.x += (_gaze.tgt.x - _gaze.cur.x) * 0.1;
  _gaze.cur.y += (_gaze.tgt.y - _gaze.cur.y) * 0.1;
  return _gaze.cur;
}

// ---- Facial expressions tied to each clip's emotion ----
// Static preset weights layered over the user's Face-tab settings (whichever is
// stronger wins). "blink" here means the clip holds the eyes closed (sleep/die),
// which also suppresses the auto-blink. Time-driven mouths (talking, scream) are
// handled procedurally below, not here.
const CLIP_EXPRESSIONS = {
  idle:      { relaxed: 0.2 },
  idle_soft: { relaxed: 0.35 },
  wave:      { happy: 0.7 },
  cheer:     { happy: 1.0 },
  bow:       { relaxed: 0.3 },
  thinking:  { relaxed: 0.15 },
  hands_hip: { happy: 0.45 },
  peace:     { happy: 0.85 },
  talking:   {},
  cry:       { sad: 1.0 },
  scream:    { surprised: 1.0 },
  sleep:     { relaxed: 0.7, blink: 1.0 },
  die:       { blink: 1.0 },
  dance:     { happy: 0.85 },
  kpop:      { happy: 0.9 },
  walk:      { relaxed: 0.2 },
  run:       { surprised: 0.25 },
  jump:      { happy: 0.6 },
  sit:       { relaxed: 0.35 },
};

const MOUTH_SHAPES = ["aa", "ih", "ou", "ee", "oh"];

// Whether a clip holds the eyes closed (so the viewer skips auto-blink).
export function clipHoldsEyesClosed(clip) {
  const e = CLIP_EXPRESSIONS[clip];
  return !!(e && "blink" in e);
}

// Apply the emotion tied to the current clip. Call AFTER resetting expressions
// to the user's Face-tab values so the clip's emotion layers on top (max), and
// BEFORE expressionManager.update(). talkEmotion overrides the talking overlay.
export function applyClipExpressions(vrm, clip, t, extras = {}) {
  const em = vrm?.expressionManager;
  if (!em) return;
  const atLeast = (name, v) => {
    if (!name) return;
    const e = em.getExpression(name);
    if (e) e.weight = Math.max(e.weight, v);
  };

  const preset = CLIP_EXPRESSIONS[clip] || {};
  for (const name in preset) atLeast(name, preset[name]);

  if (clip === "talking") {
    // Cycle a mouth shape every ~0.28s at a speaking cadence.
    const cyc = 0.28;
    const idx = Math.floor(t / cyc);
    const local = (t % cyc) / cyc;
    const env = Math.max(0, Math.sin(local * Math.PI) * (0.55 + 0.35 * Math.sin(t * 3.0)));
    const active = MOUTH_SHAPES[idx % MOUTH_SHAPES.length];
    const a = em.getExpression(active);
    if (a) a.weight = Math.max(a.weight, env);
    const emo = extras.talkEmotion;
    if (emo && emo !== "neutral") atLeast(emo, 0.55);
  } else if (clip === "scream") {
    // Wide-open "aa" mouth, pulsing.
    const a = em.getExpression("aa");
    if (a) a.weight = Math.max(a.weight, 0.9 + Math.sin(t * 6) * 0.1);
  }
}

export const CLIP_META = [
  { id: "idle", label: "Idle", desc: "Breathing + head sway", group: "Idle" },
  { id: "idle_soft", label: "Idle Soft", desc: "Slower + weight shift", group: "Idle" },
  { id: "wave", label: "Wave", desc: "Right-hand friendly wave", group: "Gesture" },
  { id: "cheer", label: "Cheer", desc: "Both arms up + bounce", group: "Gesture" },
  { id: "bow", label: "Bow", desc: "Polite bow cycle", group: "Gesture" },
  { id: "thinking", label: "Thinking", desc: "Hand to chin + tilt", group: "Gesture" },
  { id: "hands_hip", label: "Hands on Hips", desc: "Confident pose", group: "Gesture" },
  { id: "peace", label: "Peace Sign", desc: "Classic V pose", group: "Gesture" },
  { id: "talking", label: "Talking", desc: "Mouth shapes + emotion overlay", group: "Emotion" },
  { id: "cry", label: "Cry", desc: "Head down, hands to face, shakes", group: "Emotion" },
  { id: "scream", label: "Scream", desc: "Head back, wide arms, mouth open", group: "Emotion" },
  { id: "sleep", label: "Sleep", desc: "Sits, head lolling, closed eyes", group: "Emotion" },
  { id: "die", label: "Die", desc: "One-shot fall & rest", group: "Emotion" },
  { id: "dance", label: "Dance", desc: "Rhythmic sway", group: "Dance" },
  { id: "kpop", label: "K-Pop", desc: "Punchy alternating hits", group: "Dance" },
  { id: "walk", label: "Walk", desc: "Step cycle", group: "Locomotion" },
  { id: "run", label: "Run", desc: "Fast pumping run", group: "Locomotion" },
  { id: "jump", label: "Jump", desc: "Crouch → launch → land", group: "Locomotion" },
  { id: "sit", label: "Sit", desc: "Seated pose", group: "Pose" },
  { id: "custom", label: "Custom", desc: "Play recorded timeline", group: "Custom" },
  { id: "none", label: "T-Pose", desc: "Neutral rest", group: "Pose" },
];

export const CLIP_NAMES = CLIP_META.map((c) => c.id);

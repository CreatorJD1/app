// Procedural animation clips for VRM humanoid.
import * as THREE from "three";

function getBone(vrm, name) {
  return vrm?.humanoid?.getNormalizedBoneNode(name);
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
}

function relaxArms(vrm) {
  const l = getBone(vrm, "leftUpperArm"); if (l) l.rotation.z = 1.2;
  const r = getBone(vrm, "rightUpperArm"); if (r) r.rotation.z = -1.2;
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

function cheer(vrm, t) {
  const lu = getBone(vrm, "leftUpperArm"), ru = getBone(vrm, "rightUpperArm");
  const ll = getBone(vrm, "leftLowerArm"), rl = getBone(vrm, "rightLowerArm");
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const head = getBone(vrm, "head");
  const beat = Math.sin(t * 5);
  if (lu) { lu.rotation.z = 3.0; lu.rotation.x = -0.4 - Math.abs(beat) * 0.15; }
  if (ru) { ru.rotation.z = -3.0; ru.rotation.x = -0.4 - Math.abs(beat) * 0.15; }
  if (ll) ll.rotation.x = -0.3 + beat * 0.2;
  if (rl) rl.rotation.x = -0.3 - beat * 0.2;
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
  const bend = amt * 0.9;
  if (spine) spine.rotation.x = bend * 0.5;
  if (chest) chest.rotation.x = bend * 0.4;
  if (head) head.rotation.x = bend * 0.15;
}

function thinking(vrm, t) {
  const ru = getBone(vrm, "rightUpperArm");
  const rl = getBone(vrm, "rightLowerArm");
  const rh = getBone(vrm, "rightHand");
  const head = getBone(vrm, "head");
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  if (ru) { ru.rotation.z = -0.5; ru.rotation.x = -0.5; }
  if (rl) rl.rotation.x = -1.9;
  if (rh) rh.rotation.z = 0.4;
  if (head) { head.rotation.z = -0.15; head.rotation.x = 0.08; head.rotation.y = Math.sin(t * 0.5) * 0.1; }
  if (chest) chest.rotation.z = 0.05;
}

function handsOnHips(vrm, t) {
  const lu = getBone(vrm, "leftUpperArm"), ru = getBone(vrm, "rightUpperArm");
  const ll = getBone(vrm, "leftLowerArm"), rl = getBone(vrm, "rightLowerArm");
  const lh = getBone(vrm, "leftHand"), rh = getBone(vrm, "rightHand");
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  if (lu) { lu.rotation.z = 1.0; lu.rotation.x = -0.05; lu.rotation.y = -0.3; }
  if (ru) { ru.rotation.z = -1.0; ru.rotation.x = -0.05; ru.rotation.y = 0.3; }
  if (ll) { ll.rotation.x = -1.6; ll.rotation.z = 0.4; }
  if (rl) { rl.rotation.x = -1.6; rl.rotation.z = -0.4; }
  if (lh) lh.rotation.z = 0.3;
  if (rh) rh.rotation.z = -0.3;
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
  if (luA) { luA.rotation.z = 1.0; luA.rotation.x = -0.2 + swing * 0.9; }
  if (ruA) { ruA.rotation.z = -1.0; ruA.rotation.x = -0.2 - swing * 0.9; }
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

function cry(vrm, t) {
  // Head down, shoulders hunched, hands to face, small shakes
  const head = getBone(vrm, "head");
  const spine = getBone(vrm, "spine");
  const chest = getBone(vrm, "chest") || getBone(vrm, "upperChest");
  const lu = getBone(vrm, "leftUpperArm"), ru = getBone(vrm, "rightUpperArm");
  const ll = getBone(vrm, "leftLowerArm"), rl = getBone(vrm, "rightLowerArm");
  const lh = getBone(vrm, "leftHand"), rh = getBone(vrm, "rightHand");
  const shake = Math.sin(t * 8) * 0.03;
  if (spine) spine.rotation.x = 0.25;
  if (chest) chest.rotation.x = 0.2 + shake;
  if (head) { head.rotation.x = 0.4; head.rotation.z = shake * 3; }
  // Hands up to face
  if (lu) { lu.rotation.z = 0.6; lu.rotation.x = -0.4; }
  if (ru) { ru.rotation.z = -0.6; ru.rotation.x = -0.4; }
  if (ll) ll.rotation.x = -2.0;
  if (rl) rl.rotation.x = -2.0;
  if (lh) lh.rotation.x = -0.3;
  if (rh) rh.rotation.x = -0.3;
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
  // Drive mouth "aa" if expression available
  if (vrm.expressionManager) {
    const aa = vrm.expressionManager.getExpression("aa");
    if (aa) aa.weight = Math.max(aa.weight, 0.9 + Math.sin(t * 6) * 0.1);
    const surprised = vrm.expressionManager.getExpression("surprised");
    if (surprised) surprised.weight = Math.max(surprised.weight, 0.8);
  }
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
  if (head) { head.rotation.x = 0.7; head.rotation.z = 0.2; }
  if (lu) { lu.rotation.z = 1.4; lu.rotation.x = -0.15; }
  if (ru) { ru.rotation.z = -1.4; ru.rotation.x = -0.15; }
  if (hips) hips.position.y = -0.35;
  // Closed eyes if blink expression available
  if (vrm.expressionManager) {
    const blink = vrm.expressionManager.getExpression("blink");
    if (blink) blink.weight = 1.0;
    const relaxed = vrm.expressionManager.getExpression("relaxed");
    if (relaxed) relaxed.weight = Math.max(relaxed.weight, 0.6);
  }
}

// Talking: cycles mouth shapes (aa/ih/ou/ee/oh) at natural cadence.
// emotion (optional): "happy" | "sad" | "angry" | "surprised" \u2014 overlays that expression.
function talking(vrm, t, emotion) {
  // Very light idle sway
  idle(vrm, t * 0.5);
  if (!vrm.expressionManager) return;
  const em = vrm.expressionManager;
  const shapes = ["aa", "ih", "ou", "ee", "oh"];
  // Envelope: fast attack/release with mostly-mid amplitude
  // Cycle a shape every ~0.25s using a pseudo-random selector.
  const cycleLen = 0.28;
  const idx = Math.floor(t / cycleLen);
  const local = (t % cycleLen) / cycleLen;
  const envelope = Math.sin(local * Math.PI) * (0.55 + 0.35 * Math.sin(t * 3.0));
  // Reset mouth shapes we control
  shapes.forEach((s) => {
    const e = em.getExpression(s); if (e) e.weight = 0;
  });
  const activeShape = shapes[idx % shapes.length];
  const active = em.getExpression(activeShape);
  if (active) active.weight = Math.max(0, envelope);

  // Emotion overlay
  if (emotion) {
    const map = { happy: "happy", sad: "sad", angry: "angry", surprised: "surprised", relaxed: "relaxed" };
    const target = map[emotion];
    if (target) {
      const e = em.getExpression(target);
      if (e) e.weight = Math.max(e.weight, 0.55);
    }
  }
  // Small head bob for emphasis
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

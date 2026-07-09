import * as THREE from "three";

/**
 * Heuristic material classifier — infers what body region a VRM material
 * targets based on its name. Used to power guided "apply to face / hair /
 * outfit" workflows.
 *
 * Returns one of:
 *   "face" | "hair" | "eye" | "skin" | "top" | "bottom" | "shoes" |
 *   "accessory" | "outfit" | "other"
 */
export function classifyMaterial(name = "") {
  const n = String(name).toLowerCase();
  const has = (...tokens) => tokens.some((t) => n.includes(t));

  if (has("eyeline", "eyelash", "brow", "eyebrow")) return "face";
  if (has("iris", "pupil", "sclera", "cornea", "highlight_eye", "eye_")) return "eye";
  if (has("eye")) return "eye";
  if (has("face", "cheek", "mouth", "lip", "tongue", "teeth")) return "face";
  if (has("hair", "bang", "ponytail", "twintail")) return "hair";
  if (has("skin", "body_", "arm", "leg_skin", "torso_skin")) return "skin";
  if (has("shirt", "top", "blouse", "vest", "jacket", "hoodie", "coat", "outer", "onepiece", "dress", "uniform")) return "top";
  if (has("skirt", "pants", "trouser", "shorts", "bottom", "leg_wear", "leggings", "stockings", "socks")) return "bottom";
  if (has("shoe", "boot", "sneaker", "footwear")) return "shoes";
  if (has("hat", "cap", "ribbon", "bow", "glass", "earring", "necklace", "jewel", "accessory", "acc_", "tail", "wing")) return "accessory";
  if (has("cloth", "fabric", "outfit", "costume", "material")) return "outfit";
  return "other";
}

export const CATEGORY_ORDER = [
  "face",
  "eye",
  "hair",
  "skin",
  "top",
  "bottom",
  "shoes",
  "outfit",
  "accessory",
  "other",
];

export const CATEGORY_LABELS = {
  face: "Face",
  eye: "Eyes",
  hair: "Hair",
  skin: "Skin",
  top: "Tops",
  bottom: "Bottoms",
  shoes: "Shoes",
  outfit: "Outfit",
  accessory: "Accessories",
  other: "Other",
};

/**
 * Find the first mesh in a VRM scene that uses the given material name.
 * Returns { mesh, material } or null.
 */
export function findMeshForMaterial(vrm, materialName) {
  let hit = null;
  vrm.scene.traverse((obj) => {
    if (hit) return;
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if ((mat.name || "material") === materialName) {
        hit = { mesh: obj, material: mat };
        return;
      }
    }
  });
  return hit;
}

/**
 * Iterate every material instance across the VRM scene that matches
 * materialName (materials are commonly deduped by name but instances
 * live on multiple SkinnedMeshes).
 */
export function forEachMaterialInstance(vrm, materialName, cb) {
  vrm.scene.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((mat) => {
      if ((mat.name || "material") === materialName) cb(mat, obj);
    });
  });
}

/**
 * Extract a UV-template preview image for a material. Renders:
 *   - The current diffuse texture (if any) as background at half brightness
 *   - A high-contrast wireframe of the mesh's UV triangles overlaid
 *
 * Result: a PNG data-URL sized `size × size` that the user can drop back
 * into the reference-based generator to produce a NEW anime texture that
 * respects the model's existing UV layout.
 */
export async function extractUvTemplate(vrm, materialName, size = 1024) {
  const hit = findMeshForMaterial(vrm, materialName);
  if (!hit) throw new Error(`Material "${materialName}" not found on model`);
  const { mesh, material } = hit;
  const geom = mesh.geometry;
  const uvAttr = geom?.attributes?.uv;
  if (!uvAttr) throw new Error("Mesh has no UV attribute");

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // 1. Fill background
  ctx.fillStyle = "#111318";
  ctx.fillRect(0, 0, size, size);

  // 2. Draw current diffuse texture (dimmed) if available
  const map = material?.map;
  const src = map?.image;
  if (src && (src instanceof HTMLImageElement || src instanceof HTMLCanvasElement || src instanceof ImageBitmap)) {
    try {
      ctx.globalAlpha = 0.6;
      ctx.drawImage(src, 0, 0, size, size);
      ctx.globalAlpha = 1;
    } catch (_) {
      /* CORS or unsupported bitmap - skip */
    }
  }

  // 3. Overlay UV triangles as wireframe
  const uvs = uvAttr.array;
  const drawTri = (a, b, c, stroke) => {
    ctx.beginPath();
    ctx.moveTo(uvs[a * 2] * size, (1 - uvs[a * 2 + 1]) * size);
    ctx.lineTo(uvs[b * 2] * size, (1 - uvs[b * 2 + 1]) * size);
    ctx.lineTo(uvs[c * 2] * size, (1 - uvs[c * 2 + 1]) * size);
    ctx.closePath();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  };

  ctx.strokeStyle = "#2FE6D0";
  ctx.lineWidth = 0.5;

  const idx = geom.index;
  const triCount = idx ? idx.count / 3 : uvAttr.count / 3;
  const cap = Math.min(triCount, 200000); // guard against enormous meshes
  const stride = triCount > cap ? Math.ceil(triCount / cap) : 1;

  ctx.beginPath();
  for (let t = 0; t < triCount; t += stride) {
    let a, b, c;
    if (idx) {
      a = idx.getX(t * 3);
      b = idx.getX(t * 3 + 1);
      c = idx.getX(t * 3 + 2);
    } else {
      a = t * 3;
      b = t * 3 + 1;
      c = t * 3 + 2;
    }
    ctx.moveTo(uvs[a * 2] * size, (1 - uvs[a * 2 + 1]) * size);
    ctx.lineTo(uvs[b * 2] * size, (1 - uvs[b * 2 + 1]) * size);
    ctx.lineTo(uvs[c * 2] * size, (1 - uvs[c * 2 + 1]) * size);
    ctx.lineTo(uvs[a * 2] * size, (1 - uvs[a * 2 + 1]) * size);
  }
  ctx.strokeStyle = "#2FE6D0";
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // 4. Border frame (helps reference-generation preserve edges)
  ctx.strokeStyle = "#FF8A7A";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, size - 4, size - 4);

  return canvas.toDataURL("image/png");
}

/**
 * Capture a material's ORIGINAL diffuse atlas (material.map) as a clean PNG
 * data-URL with its alpha channel intact — this is the UV-correct texture the
 * model already ships with. It's the right img2img seed for a low-denoise
 * "restyle in place" (unlike the wireframe UV template, which the model would
 * literally repaint AS a grid). Returns { dataUrl, flipY, width, height } or
 * null when the material has no base texture (flat-colour material).
 */
export async function extractOriginalAtlas(vrm, materialName, maxSize = 2048) {
  const hit = findMeshForMaterial(vrm, materialName);
  if (!hit) return null;
  const map = hit.material?.map;
  const src = map?.image;
  if (!src) return null;
  const w = src.width || src.videoWidth || src.naturalWidth || 0;
  const h = src.height || src.videoHeight || src.naturalHeight || 0;
  if (!w || !h) return null;

  const scale = Math.min(1, maxSize / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, cw, ch); // keep transparency — do NOT fill a background
  try {
    ctx.drawImage(src, 0, 0, cw, ch);
  } catch (_) {
    return null; // tainted/unsupported source
  }
  return {
    dataUrl: canvas.toDataURL("image/png"),
    // Preserve the model's own sampling orientation so the restyle drops back in
    // exactly aligned (VRM/glTF maps are usually flipY:false).
    flipY: map.flipY ?? false,
    width: cw,
    height: ch,
  };
}

/**
 * Save the ORIGINAL texture on the first apply so we can restore later.
 * Attaches metadata to the material via `__vcs_originalMap`.
 */
function snapshotOriginal(mat) {
  if (!mat.__vcs_originalMap) {
    mat.__vcs_originalMap = mat.map || null;
    mat.__vcs_originalColor = mat.color ? mat.color.clone() : null;
  }
}

/**
 * Apply a texture data-URL to every instance of `materialName` on the VRM.
 * Supports an optional transform: { offset:[x,y], repeat:[x,y], rotation, flipY }.
 * Returns count of material instances updated.
 */
export async function applyTexture(vrm, materialName, dataUrl, transform = null) {
  const image = await loadImage(dataUrl);
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.flipY = transform?.flipY ?? true;
  texture.center.set(0.5, 0.5);
  if (transform) {
    if (Array.isArray(transform.offset)) texture.offset.set(transform.offset[0], transform.offset[1]);
    if (Array.isArray(transform.repeat)) texture.repeat.set(transform.repeat[0], transform.repeat[1]);
    if (typeof transform.rotation === "number") texture.rotation = transform.rotation;
  }
  texture.needsUpdate = true;

  let count = 0;
  forEachMaterialInstance(vrm, materialName, (mat) => {
    snapshotOriginal(mat);
    mat.map = texture;
    // A full generated texture is self-coloured, so we neutralise the base color
    // multiplier to white. But an in-place RECOLOR (hair gradient) keeps
    // the atlas's own colours and must NOT lose the material's tint (e.g. her
    // ivory jacket #f7efe7) — pass transform.preserveColor for those.
    if (mat.color && !transform?.preserveColor) mat.color.set(0xffffff);
    mat.needsUpdate = true;
    count++;
  });
  return count;
}

function _mapFlipY(vrm, materialName) {
  const hit = findMeshForMaterial(vrm, materialName);
  return hit?.material?.map?.flipY ?? false;
}

/**
 * Derive an emissive MASK from a material's current diffuse: bright + saturated
 * pixels (Alpecca's glowing core emblem, neon accents) keep their colour, the
 * rest goes black. Returns a PNG data-URL, or null if the map can't be read.
 */
export function deriveEmissiveMask(vrm, materialName, threshold = 0.62) {
  const hit = findMeshForMaterial(vrm, materialName);
  const src = hit?.material?.map?.image;
  const w = src && (src.width || src.naturalWidth);
  const h = src && (src.height || src.naturalHeight);
  if (!w || !h) return null;
  const cap = 1024;
  const scale = Math.min(1, cap / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  try { ctx.drawImage(src, 0, 0, cw, ch); } catch (_) { return null; }
  let img;
  try { img = ctx.getImageData(0, 0, cw, ch); } catch (_) { return null; }
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = mx <= 0 ? 0 : (mx - mn) / mx;
    if (!(lum > threshold && (sat > 0.28 || lum > 0.9))) { d[i] = d[i + 1] = d[i + 2] = 0; }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Average colour + saturation of a material's diffuse (downsampled). Basis for
 * the MToon-safe glow: tint the emissive COLOR uniform by the material's own
 * dominant colour instead of adding an emissiveMap (verified live: swapping in a
 * canvas emissiveMap does NOT reliably recompile MToon's shader, which then
 * applies the flat emissive colour everywhere and blows out white fabric).
 */
function sampleAlbedo(mat) {
  const src = mat.map && mat.map.image;
  if (!src) return null;
  try {
    const w = 128, h = 128;
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    cx.drawImage(src, 0, 0, w, h);
    const d = cx.getImageData(0, 0, w, h).data;
    let sr = 0, sg = 0, sb = 0, satSum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 32) continue;
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      sr += r; sg += g; sb += b;
      satSum += mx > 0 ? (mx - mn) / mx : 0;
      n++;
    }
    if (!n) return null;
    return { r: sr / n, g: sg / n, b: sb / n, sat: satSum / n };
  } catch (_) {
    return null;
  }
}

/**
 * Make a material self-lit (MToon emissive). MToon-safe approach: glow via the
 * emissive COLOR uniform tinted by the material's own dominant albedo colour —
 * saturated accent materials (her glowing core, eyes, blue trim) light up in
 * their own hue; white/ivory fabric (low saturation) is skipped unless `force`.
 * `pulse` registers the material for a heartbeat in the render loop
 * (`vrm.__vcs_emissivePulse`). Returns count of instances updated.
 */
export async function applyEmissive(vrm, materialName, opts = {}) {
  const {
    intensity = 1.6, color = null, pulse = false,
    minSaturation = 0.3, force = false,
  } = opts;
  const list = (vrm.__vcs_emissivePulse = vrm.__vcs_emissivePulse || []);
  let count = 0;
  forEachMaterialInstance(vrm, materialName, (mat) => {
    if (!mat.emissive) return; // material has no emissive slot
    const s = sampleAlbedo(mat);
    if (!force && !color && (!s || s.sat < minSaturation)) return; // white fabric: no glow
    if (mat.__vcs_emissiveBase == null) {
      mat.__vcs_origEmissive = {
        map: mat.emissiveMap || null,
        intensity: mat.emissiveIntensity ?? 0,
        color: mat.emissive.clone(),
      };
    }
    if (color != null) mat.emissive.set(color);
    else if (s) mat.emissive.setRGB(Math.min(1, s.r * 1.2), Math.min(1, s.g * 1.2), Math.min(1, s.b * 1.2));
    else mat.emissive.set(0xffffff);
    mat.emissiveIntensity = intensity;
    mat.__vcs_emissiveBase = intensity;
    mat.needsUpdate = true;
    const idx = list.indexOf(mat);
    if (pulse && idx < 0) list.push(mat);
    else if (!pulse && idx >= 0) list.splice(idx, 1);
    count++;
  });
  return count;
}

/** Restore a material's original (usually zero) emissive. */
export function clearEmissive(vrm, materialName) {
  const list = vrm.__vcs_emissivePulse || [];
  let count = 0;
  forEachMaterialInstance(vrm, materialName, (mat) => {
    const o = mat.__vcs_origEmissive;
    if (o) {
      mat.emissiveMap = o.map;
      mat.emissiveIntensity = o.intensity;
      if (mat.emissive) mat.emissive.copy(o.color);
    } else if (mat.emissive) {
      mat.emissiveIntensity = 0;
    }
    mat.__vcs_emissiveBase = null;
    mat.needsUpdate = true;
    const idx = list.indexOf(mat);
    if (idx >= 0) list.splice(idx, 1);
    count++;
  });
  return count;
}

function _hexToRgb(h) {
  h = String(h).replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function _materialNames(vrm, predicate) {
  const names = [];
  vrm?.scene?.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      const name = m?.name || "";
      if (name && predicate(m, name) && !names.includes(name)) names.push(name);
    });
  });
  return names;
}

function _sourceImageForMaterial(mat) {
  return mat?.__vcs_originalMap?.image || mat?.map?.image || null;
}

function _materialFlipY(mat) {
  return mat?.map?.flipY ?? mat?.__vcs_originalMap?.flipY ?? false;
}

async function _applyTintedTexture(vrm, materialName, colorAt, opts = {}) {
  const { amount = 0.7, boost = 1.12 } = opts;
  const hit = findMeshForMaterial(vrm, materialName);
  const src = _sourceImageForMaterial(hit?.material);
  const w = src && (src.width || src.naturalWidth);
  const h = src && (src.height || src.naturalHeight);
  if (!w || !h) {
    let fallback = 0;
    const [r, g, b] = Array.isArray(opts.fallbackColor)
      ? opts.fallbackColor
      : _hexToRgb(opts.fallbackColor || "#ffffff");
    forEachMaterialInstance(vrm, materialName, (mat) => {
      if (mat.color) {
        mat.color.setRGB(r / 255, g / 255, b / 255);
        mat.needsUpdate = true;
        fallback++;
      }
    });
    return fallback;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  try { ctx.drawImage(src, 0, 0, w, h); } catch (_) { return 0; }
  let img;
  try { img = ctx.getImageData(0, 0, w, h); } catch (_) { return 0; }
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 8) continue;
      const [tr, tg, tb, localAmount = amount] = colorAt(x / Math.max(1, w - 1), y / Math.max(1, h - 1), d, i);
      const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      d[i] = d[i] * (1 - localAmount) + Math.min(255, tr * lum * boost) * localAmount;
      d[i + 1] = d[i + 1] * (1 - localAmount) + Math.min(255, tg * lum * boost) * localAmount;
      d[i + 2] = d[i + 2] * (1 - localAmount) + Math.min(255, tb * lum * boost) * localAmount;
    }
  }
  ctx.putImageData(img, 0, 0);
  return applyTexture(vrm, materialName, canvas.toDataURL("image/png"), {
    flipY: _materialFlipY(hit.material),
    preserveColor: true,
  });
}

export async function applyShadedTint(vrm, materialName, color, opts = {}) {
  const rgb = Array.isArray(color) ? color : _hexToRgb(color);
  return _applyTintedTexture(vrm, materialName, () => rgb, { ...opts, fallbackColor: color });
}

/**
 * Recolour a material's diffuse with a vertical gradient between two colours,
 * shading-preserving (each pixel keeps its own luminance/highlights). Used to
 * give Alpecca's hair her canon silver-root → lavender-blue-tip fade. `startAt`
 * keeps the top fraction pure `topColor` before the ramp begins; `flip` inverts
 * the axis if a material's UV runs tip→root. Returns instances updated.
 */
export async function applyGradientTint(vrm, materialName, topColor, bottomColor, opts = {}) {
  const { amount = 0.8, startAt = 0.3, boost = 1.18, flip = false } = opts;
  const hit = findMeshForMaterial(vrm, materialName);
  const src = _sourceImageForMaterial(hit?.material);
  const w = src && (src.width || src.naturalWidth);
  const h = src && (src.height || src.naturalHeight);
  if (!w || !h) return 0;
  const [tr, tg, tb] = Array.isArray(topColor) ? topColor : _hexToRgb(topColor);
  const [br, bg, bb] = Array.isArray(bottomColor) ? bottomColor : _hexToRgb(bottomColor);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  try { ctx.drawImage(src, 0, 0, w, h); } catch (_) { return 0; }
  let img;
  try { img = ctx.getImageData(0, 0, w, h); } catch (_) { return 0; }
  const d = img.data;
  for (let y = 0; y < h; y++) {
    let f = (y / (h - 1) - startAt) / (1 - startAt);
    f = Math.max(0, Math.min(1, flip ? 1 - f : f));
    const cr = tr + (br - tr) * f, cg = tg + (bg - tg) * f, cb = tb + (bb - tb) * f;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 8) continue;
      const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      d[i] = d[i] * (1 - amount) + Math.min(255, cr * lum * boost) * amount;
      d[i + 1] = d[i + 1] * (1 - amount) + Math.min(255, cg * lum * boost) * amount;
      d[i + 2] = d[i + 2] * (1 - amount) + Math.min(255, cb * lum * boost) * amount;
    }
  }
  ctx.putImageData(img, 0, 0);
  return applyTexture(vrm, materialName, canvas.toDataURL("image/png"), { flipY: _materialFlipY(hit.material), preserveColor: true });
}

// Alpecca's canon hair: silver roots fading to lavender-blue tips.
export async function matchAlpeccaHair(vrm) {
  const hairMats = _materialNames(vrm, (_m, name) => /hair|bang|ponytail|twintail/i.test(name));
  let count = 0;
  for (const name of hairMats) {
    count += await applyGradientTint(vrm, name, [206, 209, 219], [150, 158, 228], { amount: 0.8, startAt: 0.3 });
  }
  return count;
}

async function _matchAlpeccaBoots(vrm) {
  const mats = _materialNames(vrm, (_m, name) => classifyMaterial(name) === "shoes");
  let count = 0;
  const cream = _hexToRgb("#F3EEE6");
  const accent = _hexToRgb("#AFC7FF");
  for (const name of mats) {
    count += await _applyTintedTexture(vrm, name, (x, y) => {
      const sole = y > 0.72;
      const sidePanel = (x < 0.12 || x > 0.88) && y > 0.28;
      return (sole || sidePanel) ? [...accent, 0.65] : [...cream, 0.78];
    }, { boost: 1.08, fallbackColor: "#F3EEE6" });
  }
  return count;
}

async function _matchAlpeccaOutfit(vrm) {
  let count = 0;
  const topMats = _materialNames(vrm, (_m, name) => {
    const n = name.toLowerCase();
    return classifyMaterial(name) === "top" || /cloth|fabric|hoodie|jacket|outer|onepiece/.test(n);
  });
  for (const name of topMats) {
    count += await applyShadedTint(vrm, name, "#F7EFE7", { amount: 0.42, boost: 1.14 });
  }

  const stockingMats = _materialNames(vrm, (_m, name) => /stocking|sock|leg_wear|legwear|tights/i.test(name));
  for (const name of stockingMats) {
    count += await applyShadedTint(vrm, name, "#F8FAFF", { amount: 0.88, boost: 1.18 });
  }

  const shortsMats = _materialNames(vrm, (_m, name) => /shorts|pants|bottom/i.test(name) && !/stocking|sock|leg/i.test(name));
  for (const name of shortsMats) {
    count += await applyShadedTint(vrm, name, "#151821", { amount: 0.55, boost: 0.9 });
  }

  count += await _matchAlpeccaBoots(vrm);
  return count;
}

async function _matchAlpeccaAccessories(vrm) {
  let count = 0;
  const clipMats = _materialNames(vrm, (_m, name) => /clip|bow|ribbon|hairornament|hair_ornament|accessory|acc_/i.test(name));
  for (const name of clipMats) {
    count += await applyShadedTint(vrm, name, "#276BFF", { amount: 0.78, boost: 1.22 });
  }
  const lanyardMats = _materialNames(vrm, (_m, name) => /lanyard|badge|strap|tie/i.test(name));
  for (const name of lanyardMats) {
    count += await applyShadedTint(vrm, name, "#2A63D9", { amount: 0.72, boost: 1.15 });
  }
  return count;
}

export async function matchAlpeccaDesign(vrm) {
  const hair = await matchAlpeccaHair(vrm);
  const outfit = await _matchAlpeccaOutfit(vrm);
  const accessories = await _matchAlpeccaAccessories(vrm);
  return { hair, outfit, accessories, total: hair + outfit + accessories };
}

/**
 * Update transform on an already-applied texture without re-uploading pixels.
 * Cheap enough to run on slider drag.
 */
export function updateMaterialTransform(vrm, materialName, transform) {
  let count = 0;
  forEachMaterialInstance(vrm, materialName, (mat) => {
    const tex = mat.map;
    if (!tex) return;
    tex.center.set(0.5, 0.5);
    if (Array.isArray(transform.offset)) tex.offset.set(transform.offset[0], transform.offset[1]);
    if (Array.isArray(transform.repeat)) tex.repeat.set(transform.repeat[0], transform.repeat[1]);
    if (typeof transform.rotation === "number") tex.rotation = transform.rotation;
    if (typeof transform.flipY === "boolean") {
      tex.flipY = transform.flipY;
      tex.needsUpdate = true;
    }
    mat.needsUpdate = true;
    count++;
  });
  return count;
}

/**
 * Restore the material's original diffuse map (captured on first apply).
 */
export function restoreMaterial(vrm, materialName) {
  let count = 0;
  forEachMaterialInstance(vrm, materialName, (mat) => {
    if (!("__vcs_originalMap" in mat)) return;
    mat.map = mat.__vcs_originalMap || null;
    if (mat.color && mat.__vcs_originalColor) mat.color.copy(mat.__vcs_originalColor);
    if (mat.map) {
      mat.map.offset.set(0, 0);
      mat.map.repeat.set(1, 1);
      mat.map.rotation = 0;
      mat.map.needsUpdate = true;
    }
    mat.needsUpdate = true;
    count++;
  });
  return count;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

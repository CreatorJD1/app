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
    if (mat.color) mat.color.set(0xffffff);
    mat.needsUpdate = true;
    count++;
  });
  return count;
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

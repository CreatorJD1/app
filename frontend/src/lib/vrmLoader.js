import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, VRMExpressionPresetName } from "@pixiv/three-vrm";

export const EXPRESSION_PRESETS = [
  "happy",
  "angry",
  "sad",
  "relaxed",
  "surprised",
  "neutral",
  "blink",
  "blinkLeft",
  "blinkRight",
  "aa",
  "ih",
  "ou",
  "ee",
  "oh",
];

export async function loadVRM(url, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.crossOrigin = "anonymous";
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(
      url,
      (gltf) => {
        const vrm = gltf.userData.vrm;
        if (!vrm) {
          reject(new Error("Not a valid VRM file"));
          return;
        }
        try {
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.combineSkeletons(gltf.scene);
        } catch (_) {
          // best effort
        }
        vrm.scene.traverse((obj) => {
          if (obj.isMesh) {
            obj.frustumCulled = false;
            obj.castShadow = true;
            obj.receiveShadow = false;
          }
        });
        resolve(vrm);
      },
      (progress) => {
        if (onProgress && progress.lengthComputable) {
          onProgress(progress.loaded / progress.total);
        }
      },
      (err) => reject(err),
    );
  });
}

/**
 * Discover materials on the VRM scene.
 * Returns [{name, uuid, mesh}] deduped by material name.
 */
export function discoverMaterials(vrm) {
  const found = new Map();
  vrm.scene.traverse((obj) => {
    if (obj.isMesh && obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        const name = mat.name || "material";
        if (!found.has(name)) {
          found.set(name, { name, uuid: mat.uuid, mesh: obj });
        }
      });
    }
  });
  return Array.from(found.values());
}

export function discoverExpressionNames(vrm) {
  if (!vrm.expressionManager) return [];
  const names = new Set();
  // From presets
  Object.values(VRMExpressionPresetName || {}).forEach((n) => {
    if (vrm.expressionManager.getExpression(n)) names.add(n);
  });
  // Custom expressions
  (vrm.expressionManager.expressions || []).forEach((exp) => {
    if (exp.expressionName) names.add(exp.expressionName);
  });
  return Array.from(names);
}

/**
 * Apply a data-url image to all materials matching materialName.
 * Overwrites baseColor / _MainTex map with a THREE.Texture built from image.
 */
export async function applyTextureToMaterial(vrm, materialName, dataUrl) {
  const image = await loadImage(dataUrl);
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;

  let count = 0;
  vrm.scene.traverse((obj) => {
    if (obj.isMesh && obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if ((mat.name || "material") === materialName) {
          // MToon material has `map` for base color as well.
          mat.map = texture;
          if (mat.color) mat.color.set(0xffffff);
          mat.needsUpdate = true;
          count += 1;
        }
      });
    }
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

/**
 * Apply Y/Z bone rotations offset to a VRM humanoid bone.
 * Values are radians. This is added on top of animation transforms each frame.
 */
export function applyBoneOffsets(vrm, boneOffsets) {
  if (!vrm.humanoid) return;
  Object.entries(boneOffsets || {}).forEach(([bone, off]) => {
    const node = vrm.humanoid.getNormalizedBoneNode(bone);
    if (!node) return;
    node.rotation.x += off.x || 0;
    node.rotation.y += off.y || 0;
    node.rotation.z += off.z || 0;
  });
}

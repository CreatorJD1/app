import { LoopSubdivision } from "three-subdivide";

// Apply Loop subdivision to VRM meshes. Iterations 1-2 is typical; higher gets slow.
// We attempt to preserve skinning attributes; may distort weights on complex meshes.
export function subdivideVRM(vrm, iterations = 1) {
  if (!vrm?.scene || iterations <= 0) return { changed: 0, skipped: 0 };
  let changed = 0;
  let skipped = 0;
  vrm.scene.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    // Guard: skip if too big already or if skinned index count too large
    const idxCount = obj.geometry.index ? obj.geometry.index.count : 0;
    if (idxCount > 200_000) { skipped++; return; }
    if (obj.userData._vcs_subdivided) { skipped++; return; }
    if (!obj.userData._vcs_originalGeometry) {
      obj.userData._vcs_originalGeometry = obj.geometry;
    }
    try {
      const params = { split: true, uvSmooth: false, preserveEdges: true, flatOnly: false, maxTriangles: 800_000 };
      const subdivided = LoopSubdivision.modify(obj.geometry, iterations, params);
      obj.geometry = subdivided;
      obj.userData._vcs_subdivided = iterations;
      changed++;
    } catch (e) {
      skipped++;
      // eslint-disable-next-line no-console
      console.warn("[subdivide] skipped mesh", obj.name, e?.message);
    }
  });
  return { changed, skipped };
}

export function restoreVRM(vrm) {
  if (!vrm?.scene) return 0;
  let restored = 0;
  vrm.scene.traverse((obj) => {
    if (obj.isMesh && obj.userData._vcs_originalGeometry) {
      obj.geometry = obj.userData._vcs_originalGeometry;
      obj.userData._vcs_subdivided = 0;
      restored++;
    }
  });
  return restored;
}

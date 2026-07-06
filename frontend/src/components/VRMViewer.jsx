import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { VRMExpressionPresetName } from "@pixiv/three-vrm";
import { toast } from "sonner";

import { useStudioStore } from "@/store/studioStore";
import {
  loadVRM,
  discoverMaterials,
  discoverExpressionNames,
  applyBoneOffsets,
} from "@/lib/vrmLoader";
import { applyClip, applyAutoBlink } from "@/lib/vrmAnimations";
import { subdivideVRM, restoreVRM } from "@/lib/subdivide";

const LIGHTING = {
  studio: [
    { type: "ambient", color: 0xffffff, intensity: 0.55 },
    { type: "dir", color: 0xffffff, intensity: 1.1, pos: [1.5, 2.2, 1.5] },
    { type: "dir", color: 0x88bbff, intensity: 0.35, pos: [-1.8, 1.4, -1.5] },
  ],
  soft: [
    { type: "ambient", color: 0xffffff, intensity: 0.85 },
    { type: "dir", color: 0xffffff, intensity: 0.65, pos: [0.6, 2.0, 1.4] },
  ],
  rim: [
    { type: "ambient", color: 0xffffff, intensity: 0.35 },
    { type: "dir", color: 0xffffff, intensity: 1.35, pos: [0, 1.7, 1.0] },
    { type: "dir", color: 0x2fe6d0, intensity: 0.75, pos: [-2.0, 1.6, -2.0] },
    { type: "dir", color: 0xff8a7a, intensity: 0.5, pos: [2.0, 1.4, -1.5] },
  ],
  sunset: [
    { type: "ambient", color: 0xffd6a5, intensity: 0.6 },
    { type: "dir", color: 0xffb977, intensity: 1.2, pos: [1.8, 1.8, 1.2] },
    { type: "dir", color: 0x6b8ff5, intensity: 0.4, pos: [-1.8, 1.5, -1.5] },
  ],
};

export const VRMViewer = () => {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [statusMessage, setStatusMessage] = useState("");

  const vrmUrl = useStudioStore((s) => s.vrmUrl);
  const setAvailableExpressions = useStudioStore((s) => s.setAvailableExpressions);
  const setAvailableMaterials = useStudioStore((s) => s.setAvailableMaterials);

  // ---- initial scene setup ----
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 1.35, 2.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x0b0d10, 0); // transparent
    mount.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("data-testid", "studio-viewport-canvas");

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.25, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.5;
    controls.maxDistance = 8;

    // Groups for easy lighting swap
    const lightGroup = new THREE.Group();
    scene.add(lightGroup);

    // Ground gradient plane / grid
    const grid = new THREE.GridHelper(6, 24, 0x243447, 0x152030);
    grid.material.transparent = true;
    grid.material.opacity = 0.45;
    scene.add(grid);

    const clock = new THREE.Clock();
    const raycaster = new THREE.Raycaster();

    const mouse = new THREE.Vector2(0, 0);
    const onMouseMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    renderer.domElement.addEventListener("mousemove", onMouseMove);

    const lookTarget = new THREE.Object3D();
    scene.add(lookTarget);

    // Resize
    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    stateRef.current = {
      scene,
      camera,
      renderer,
      controls,
      lightGroup,
      grid,
      clock,
      raycaster,
      mouse,
      lookTarget,
      vrm: null,
      currentLighting: null,
    };

    // Set initial lighting
    setLighting(useStudioStore.getState().lightingPreset);

    // Animate loop
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const s = useStudioStore.getState();
      const dt = clock.getDelta();
      const t = clock.elapsedTime;

      const ref = stateRef.current;
      controls.update();
      if (ref.vrm) {
        // 1) apply base procedural clip (resets rotations first)
        applyClip(ref.vrm, s.animationClip, t, s.animationSpeed, { customFrames: s.customFrames });
        // 2) apply user bone offsets on top
        applyBoneOffsets(ref.vrm, s.boneOffsets);
        // 3) apply expressions from store
        if (ref.vrm.expressionManager) {
          // Reset all first
          (ref.vrm.expressionManager.expressions || []).forEach((exp) => {
            const name = exp.expressionName || exp.name;
            const wanted = s.expressions[name];
            if (typeof wanted === "number") {
              exp.weight = wanted;
            } else {
              exp.weight = 0;
            }
          });
          // Auto-blink overlay
          if (s.autoBlink) applyAutoBlink(ref.vrm, t);
          ref.vrm.expressionManager.update();
        }
        // 4) LookAt mouse
        if (ref.vrm.lookAt) {
          if (s.lookAtMouse) {
            // Convert mouse ndc to world-ish target near head
            const head = ref.vrm.humanoid?.getNormalizedBoneNode("head");
            if (head) {
              const headWorld = new THREE.Vector3();
              head.getWorldPosition(headWorld);
              const targetVec = new THREE.Vector3(mouse.x * 1.2, headWorld.y + mouse.y * 0.6, 1.5);
              lookTarget.position.copy(targetVec);
              ref.vrm.lookAt.target = lookTarget;
            }
          } else {
            ref.vrm.lookAt.target = null;
          }
        }
        ref.vrm.update(dt);
      }

      renderer.render(scene, camera);
    };
    tick();

    // Cleanup
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Load VRM whenever url changes ----
  useEffect(() => {
    const ref = stateRef.current;
    if (!ref.scene) return;
    // Remove previous VRM
    if (ref.vrm) {
      ref.scene.remove(ref.vrm.scene);
      ref.vrm = null;
    }
    if (!vrmUrl) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    setStatusMessage("Parsing VRM...");
    loadVRM(vrmUrl, {
      onProgress: (p) => setStatusMessage(`Parsing VRM... ${Math.round(p * 100)}%`),
    })
      .then((vrm) => {
        ref.vrm = vrm;
        ref.scene.add(vrm.scene);
        window.__vcs_vrm = vrm;

        // Auto-frame the character
        try {
          const box = new THREE.Box3().setFromObject(vrm.scene);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const height = Math.max(size.y, 1.0);
          const dist = height * 1.8;
          if (ref.controls && ref.camera) {
            ref.controls.target.set(center.x, center.y + height * 0.05, center.z);
            ref.camera.position.set(center.x, center.y + height * 0.15, center.z + dist);
            ref.camera.near = 0.05;
            ref.camera.far = Math.max(50, dist * 20);
            ref.camera.updateProjectionMatrix();
            ref.controls.update();
          }
        } catch (_) {}

        setStatus("ready");
        setStatusMessage("");

        // Discover expressions + materials
        const expressions = discoverExpressionNames(vrm);
        const materials = discoverMaterials(vrm).map((m) => ({ name: m.name, uuid: m.uuid }));
        setAvailableExpressions(expressions);
        setAvailableMaterials(materials);

        toast.success("VRM loaded", {
          description: `${expressions.length} expressions · ${materials.length} materials`,
        });
      })
      .catch((err) => {
        console.error(err);
        setStatus("error");
        setStatusMessage(String(err?.message || err));
        toast.error("Failed to load VRM", { description: String(err?.message || err) });
      });
  }, [vrmUrl, setAvailableExpressions, setAvailableMaterials]);

  // ---- Watch lighting preset changes ----
  useEffect(() => {
    const unsub = useStudioStore.subscribe((s, prev) => {
      if (s.lightingPreset !== prev.lightingPreset) setLighting(s.lightingPreset);
      if (s.background !== prev.background || s.backgroundColor !== prev.backgroundColor) {
        applyBackground(s.background, s.backgroundColor);
      }
      if (s.screenshotRequest !== prev.screenshotRequest) {
        doScreenshot();
      }
      if (s.subdivideRequest !== prev.subdivideRequest) {
        applySubdivision();
      }
    });
    // Initial background
    const cur = useStudioStore.getState();
    applyBackground(cur.background, cur.backgroundColor);
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLighting = (preset) => {
    const ref = stateRef.current;
    if (!ref.lightGroup) return;
    ref.lightGroup.clear();
    const spec = LIGHTING[preset] || LIGHTING.studio;
    spec.forEach((l) => {
      if (l.type === "ambient") {
        ref.lightGroup.add(new THREE.AmbientLight(l.color, l.intensity));
      } else if (l.type === "dir") {
        const d = new THREE.DirectionalLight(l.color, l.intensity);
        d.position.set(...l.pos);
        ref.lightGroup.add(d);
      }
    });
  };

  const applyBackground = (mode, color) => {
    const ref = stateRef.current;
    if (!ref.renderer) return;
    if (mode === "transparent") {
      ref.renderer.setClearColor(0x000000, 0);
      if (ref.scene) ref.scene.background = null;
    } else if (mode === "color") {
      const c = new THREE.Color(color);
      ref.renderer.setClearColor(c, 1);
      if (ref.scene) ref.scene.background = c;
    } else {
      // gradient - render a subtle radial gradient via canvas texture
      ref.renderer.setClearColor(0x0b0d10, 1);
      if (ref.scene) ref.scene.background = makeGradientTexture();
    }
  };

  const doScreenshot = () => {
    const ref = stateRef.current;
    if (!ref.renderer) return;
    const url = ref.renderer.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `vcs-shot-${Date.now()}.png`;
    a.click();
    toast.success("Screenshot saved");
  };

  const applySubdivision = () => {
    const ref = stateRef.current;
    if (!ref.vrm) return toast.error("No VRM loaded");
    const level = useStudioStore.getState().subdivisionLevel;
    // Always restore first to work from originals
    restoreVRM(ref.vrm);
    if (level > 0) {
      const { changed, skipped } = subdivideVRM(ref.vrm, level);
      toast.success(`Subdivision applied (level ${level})`, { description: `${changed} meshes subdivided, ${skipped} skipped` });
    } else {
      toast.info("Subdivision cleared");
    }
  };

  return (
    <div className="relative w-full h-full" ref={mountRef}>
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl bg-black/50 backdrop-blur px-5 py-4 border border-white/10">
            <div className="text-sm font-medium">{statusMessage || "Loading..."}</div>
            <div className="mt-2 h-1 w-56 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-pulse bg-primary" />
            </div>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl bg-black/60 backdrop-blur px-5 py-4 border border-destructive/50">
            <div className="text-sm font-semibold text-destructive">VRM failed to load</div>
            <div className="text-xs text-muted-foreground mt-1 max-w-sm">{statusMessage}</div>
          </div>
        </div>
      )}
    </div>
  );
};

function makeGradientTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(128, 100, 20, 128, 128, 220);
  g.addColorStop(0, "#1B2A3B");
  g.addColorStop(0.7, "#0F1318");
  g.addColorStop(1, "#0B0D10");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Client-side high-quality upscaling of generated textures using progressive canvas passes.
// Nano Banana usually outputs ~1024×1024. We upscale to 2048 / 4096 / 8192 with
// browser bicubic (imageSmoothingQuality high) in doubling steps for best perceived quality.

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function scaleStep(source, targetW, targetH) {
  const cnv = document.createElement("canvas");
  cnv.width = targetW;
  cnv.height = targetH;
  const ctx = cnv.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return cnv;
}

/**
 * Progressive upscale to `target` (e.g. 4096 or 8192). Doubles each pass.
 * Returns { dataUrl, width, height } (JPEG @ 0.92)
 */
export async function upscaleImage(dataUrl, target = 4096, mime = "image/jpeg", quality = 0.92) {
  const img = await loadImage(dataUrl);
  let current = img;
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  const aspect = w / h;

  // Compute target dims preserving aspect while ensuring longest side == target
  let targetW, targetH;
  if (aspect >= 1) { targetW = target; targetH = Math.round(target / aspect); }
  else { targetH = target; targetW = Math.round(target * aspect); }

  // Double until we reach target
  while (w < targetW || h < targetH) {
    const nw = Math.min(targetW, w * 2);
    const nh = Math.min(targetH, h * 2);
    current = await scaleStep(current, nw, nh);
    w = nw; h = nh;
  }

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = w; finalCanvas.height = h;
  const ctx = finalCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(current, 0, 0, w, h);

  // Add a very light unsharp-mask style pass to add crispness
  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      // subtle contrast/saturation bump for perceived sharpness
      d[i] = Math.min(255, Math.max(0, (d[i] - 128) * 1.06 + 128));
      d[i+1] = Math.min(255, Math.max(0, (d[i+1] - 128) * 1.06 + 128));
      d[i+2] = Math.min(255, Math.max(0, (d[i+2] - 128) * 1.06 + 128));
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (_) { /* skip if cross-origin */ }

  return { dataUrl: finalCanvas.toDataURL(mime, quality), width: w, height: h };
}

export const UPSCALE_PRESETS = [
  { id: 2048, label: "2K (2048)" },
  { id: 4096, label: "4K (4096)" },
  { id: 8192, label: "8K (8192)" },
];

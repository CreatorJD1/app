import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Upload, X, Shirt, ShieldCheck, Check, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudioStore } from "@/store/studioStore";
import { api } from "@/lib/api";
import {
  applyTexture,
  extractUvTemplate,
  extractOriginalAtlas,
  classifyMaterial,
  CATEGORY_LABELS,
} from "@/lib/materialUtils";

// Map an extracted garment slot to the model material category it belongs on.
const SLOT_TO_CATEGORY = {
  headwear: "accessory", top: "top", innerwear: "top", outerwear: "top",
  dress: "top", bottom: "bottom", legwear: "bottom", footwear: "shoes",
  gloves: "accessory", accessory: "accessory", hair: "hair", eye: "eye",
};

function readImages(files, onEach) {
  const list = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
  if (!list.length) return toast.error("Choose image file(s)");
  list.forEach((file) => {
    const r = new FileReader();
    r.onload = () => onEach(String(r.result || ""));
    r.readAsDataURL(file);
  });
}

const RefDropzone = ({ refs, setRefs, testid, hint }) => {
  const inputRef = useRef(null);
  return (
    <div className="space-y-2">
      <div
        className="rounded-lg border border-dashed border-border/80 bg-black/30 p-2 min-h-[120px]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); readImages(e.dataTransfer.files, (u) => setRefs((s) => [...s, u])); }}
      >
        {refs.length ? (
          <div className="grid grid-cols-3 gap-2">
            {refs.map((u, i) => (
              <div key={i} className="relative aspect-square rounded-md overflow-hidden border border-border/60">
                <img src={u} alt={`ref ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setRefs((s) => s.filter((_, x) => x !== i))}
                  className="absolute top-0.5 right-0.5 rounded bg-black/70 p-0.5 text-white hover:text-destructive"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-5 text-xs text-muted-foreground">{hint}</div>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => inputRef.current?.click()} data-testid={`${testid}-upload`}>
          <Upload size={14} className="mr-1.5" /> Add art
        </Button>
        <Button variant="ghost" onClick={() => setRefs([])} disabled={!refs.length}><X size={14} /></Button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" data-testid={`${testid}-input`}
        onChange={(e) => readImages(e.target.files, (u) => setRefs((s) => [...s, u]))} />
    </div>
  );
};

const GuardBadge = ({ guard }) => {
  if (!guard) return null;
  const ok = guard.ok !== false;
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full border ${
        ok ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
           : "text-amber-400 border-amber-500/40 bg-amber-500/10"
      }`}
      title={guard.reason || ""}
    >
      {ok ? "anime ✓" : `flagged: ${guard.deviation || "deviation"}`}
    </span>
  );
};

export const TextureLabDialog = () => {
  const open = useStudioStore((s) => s.isTextureLabOpen);
  const setOpen = useStudioStore((s) => s.setTextureLabOpen);
  const pendingUvReference = useStudioStore((s) => s.pendingUvReference);
  const clearPendingUvReference = useStudioStore((s) => s.clearPendingUvReference);

  const [tab, setTab] = useState("dress");
  const [guard, setGuard] = useState(true);
  const [provider, setProvider] = useState("zerogpu"); // zerogpu (Pony V6 + Qwen2.5-VL on Jason's H200) | cloud (HF) | local (ComfyUI) | hybrid
  // restyle = low-denoise recolor in place (subtle, safest) | bold = ControlNet
  // UV-lock repaint (new fabric/pattern, panel edges held; ZeroGPU only).
  const [mode, setMode] = useState("restyle");
  const [seedMaterial, setSeedMaterial] = useState("");

  // A "UV → Lab" click from the Materials panel jumps straight to the Material tab.
  useEffect(() => {
    if (open && pendingUvReference?.materialName) {
      setSeedMaterial(pendingUvReference.materialName);
      setTab("material");
      clearPendingUvReference();
    }
  }, [open, pendingUvReference, clearPendingUvReference]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-5xl h-[82vh] flex flex-col" data-testid="texture-lab-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" /> Texture Lab
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between gap-3 flex-wrap">
            <span>Extract clothing from reference art and paint it onto the model's real UVs — anime only.</span>
            <span className="flex items-center gap-3 shrink-0 text-xs">
              <span className="inline-flex rounded-md border border-border/70 overflow-hidden" data-testid="texlab-provider">
                {[["zerogpu", "ZeroGPU"], ["cloud", "Cloud"], ["hybrid", "Hybrid"], ["local", "Local"]].map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setProvider(v)}
                    data-testid={`texlab-provider-${v}`}
                    className={`px-2.5 py-1 transition-colors ${provider === v ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-white/5"}`}
                    title={v === "zerogpu" ? "Pony V6 XL + Qwen2.5-VL on your ZeroGPU H200 (quality, free)" : v === "cloud" ? "HuggingFace (quality)" : v === "local" ? "ComfyUI (free/offline)" : "local draft → cloud refine"}
                  >
                    {label}
                  </button>
                ))}
              </span>
              <span className="inline-flex rounded-md border border-border/70 overflow-hidden" data-testid="texlab-mode">
                {[["restyle", "Restyle"], ["bold", "Bold"]].map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setMode(v)}
                    data-testid={`texlab-mode-${v}`}
                    className={`px-2.5 py-1 transition-colors ${mode === v ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-white/5"}`}
                    title={v === "restyle"
                      ? "Recolor the material's existing texture in place (subtle, safest)"
                      : "Repaint with new fabric/pattern — ControlNet holds the UV panel edges (ZeroGPU)"}
                  >
                    {label}
                  </button>
                ))}
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={13} className={guard ? "text-emerald-400" : "text-muted-foreground"} />
                Guard
                <Switch checked={guard} onCheckedChange={setGuard} data-testid="texlab-guard-toggle" />
              </span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
          <TabsList>
            <TabsTrigger value="dress" data-testid="texlab-tab-dress">Dress from reference</TabsTrigger>
            <TabsTrigger value="material" data-testid="texlab-tab-material">Single material</TabsTrigger>
          </TabsList>

          <TabsContent value="dress" className="flex-1 min-h-0 mt-2">
            <DressTab guard={guard} provider={provider} mode={mode} />
          </TabsContent>
          <TabsContent value="material" className="flex-1 min-h-0 mt-2">
            <MaterialTab guard={guard} provider={provider} mode={mode} seedMaterial={seedMaterial} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// ---------- Goal 1 + 2 combined: extract clothing, paint it onto the model ----------
const DressTab = ({ guard, provider, mode }) => {
  const project = useStudioStore((s) => s.project);
  const availableMaterials = useStudioStore((s) => s.availableMaterials);
  const assignMaterial = useStudioStore((s) => s.assignMaterial);
  const [refs, setRefs] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [outfit, setOutfit] = useState(null);
  const [rows, setRows] = useState([]); // {garment, material, status, guard, dataUrl}

  const materialsByCat = (cat) => availableMaterials.filter((m) => classifyMaterial(m.name) === cat);

  const doExtract = async () => {
    if (!refs.length) return toast.error("Add reference art first");
    setExtracting(true); setOutfit(null); setRows([]);
    try {
      const { outfit } = await api.extractOutfit({ reference_data_urls: refs, provider, project_id: project?.id || null });
      setOutfit(outfit);
      // Auto-match each garment to a model material via its slot → category.
      const next = (outfit.garments || []).map((g) => {
        const cat = SLOT_TO_CATEGORY[g.slot] || "top";
        const mat = materialsByCat(cat)[0];
        return { garment: g, material: mat?.name || "", status: "idle", guard: null, dataUrl: null };
      });
      setRows(next);
      toast.success(`Found ${(outfit.garments || []).length} garments · matched to materials`);
    } catch (e) {
      toast.error("Extract failed", { description: e?.response?.data?.detail || String(e?.message || e) });
    } finally {
      setExtracting(false);
    }
  };

  const generateRow = async (i) => {
    const vrm = window.__vcs_vrm;
    if (!vrm) return toast.error("Load a VRM first");
    const row = rows[i];
    if (!row.material) return toast.error("Pick a target material");
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, status: "busy" } : x)));
    try {
      // The material's ORIGINAL atlas is the correct restyle seed (UV-safe).
      // The wireframe UV template is only a fallback for flat-colour materials.
      const atlas = await extractOriginalAtlas(vrm, row.material);
      const uv = atlas ? null : await extractUvTemplate(vrm, row.material, 1024);
      const cat = classifyMaterial(row.material);
      const g = row.garment;
      const desc = [g.name, g.material, g.pattern && g.pattern !== "solid" ? g.pattern : null, g.details]
        .filter(Boolean).join(", ");
      const palette = [g.primary_color, g.secondary_color].filter(Boolean).join(", ");
      const { asset, guard: verdict } = await api.generateMaterialTexture({
        original_atlas_data_url: atlas?.dataUrl || null,
        uv_template_data_url: uv,
        garment_data_url: refs[0],
        region: cat,
        description: desc,
        palette,
        guard,
        provider,
        mode,
        project_id: project?.id || null,
      });
      const count = await applyTexture(vrm, row.material, asset.data_url,
        atlas ? { flipY: atlas.flipY } : null);
      if (count > 0) assignMaterial(row.material, asset);
      setRows((r) => r.map((x, idx) => (idx === i ? { ...x, status: "done", guard: verdict, dataUrl: asset.data_url } : x)));
      toast.success(`Painted ${row.material}`, verdict && verdict.ok === false ? { description: `guard flagged: ${verdict.deviation}` } : undefined);
    } catch (e) {
      setRows((r) => r.map((x, idx) => (idx === i ? { ...x, status: "error" } : x)));
      toast.error("Generation failed", { description: e?.response?.data?.detail || String(e?.message || e) });
    }
  };

  const generateAll = async () => {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].material) await generateRow(i);
    }
  };

  return (
    <div className="grid grid-cols-[360px_1fr] gap-4 h-full">
      <div className="space-y-3 overflow-auto pr-2">
        <RefDropzone refs={refs} setRefs={setRefs} testid="dress-ref"
          hint="Drop reference art of the clothing / character / object. Multiple angles improve the read." />
        <Button onClick={doExtract} disabled={extracting || !refs.length} className="w-full" data-testid="dress-extract">
          <Shirt size={14} className="mr-1.5" /> {extracting ? "Reading outfit…" : "Extract clothing"}
        </Button>
        {outfit?.style_summary && <p className="text-[11px] text-muted-foreground leading-4">{outfit.style_summary}</p>}
        {(outfit?.palette || []).length > 0 && (
          <div className="flex gap-1.5">
            {outfit.palette.map((c, i) => <div key={i} className="h-5 w-5 rounded border border-border/60" style={{ background: c }} title={c} />)}
          </div>
        )}
        {rows.length > 0 && (
          <Button onClick={generateAll} className="w-full" data-testid="dress-generate-all">
            <Sparkles size={14} className="mr-1.5" /> Generate &amp; apply all ({rows.filter((r) => r.material).length})
          </Button>
        )}
      </div>

      <ScrollArea className="h-full min-h-0">
        <div className="pr-2 pb-4 space-y-2">
          {!rows.length && !extracting && (
            <div className="text-xs text-muted-foreground py-8 text-center">
              Drop reference art and extract — each garment is matched to a model material, then painted onto its real UV layout.
            </div>
          )}
          {extracting && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          {rows.map((row, i) => (
            <div key={i} className="rounded-lg border border-border/60 p-2.5 bg-card/60" data-testid={`dress-row-${i}`}>
              <div className="flex items-center gap-2">
                <div className="h-12 w-12 rounded-md overflow-hidden bg-black/40 border border-border/60 shrink-0">
                  {row.dataUrl
                    ? <img src={row.dataUrl} alt="" className="h-full w-full object-cover" />
                    : <div className="h-full grid place-items-center text-[10px] text-muted-foreground p-1 text-center">{row.garment.slot}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{row.garment.name || row.garment.slot}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    {row.garment.primary_color && <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full border border-border/60" style={{ background: row.garment.primary_color }} />{row.garment.material}</span>}
                    <GuardBadge guard={row.guard} />
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2 items-center">
                <Select value={row.material} onValueChange={(v) => setRows((r) => r.map((x, idx) => idx === i ? { ...x, material: v } : x))}>
                  <SelectTrigger className="h-8 text-xs" data-testid={`dress-material-${i}`}>
                    <SelectValue placeholder="Target material…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMaterials.map((m) => (
                      <SelectItem key={m.uuid} value={m.name}>{CATEGORY_LABELS[classifyMaterial(m.name)]} · {m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-8" onClick={() => generateRow(i)} disabled={row.status === "busy" || !row.material} data-testid={`dress-apply-${i}`}>
                  {row.status === "busy" ? <RefreshCw size={13} className="animate-spin" /> : row.status === "done" ? <Check size={13} /> : "Paint"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

// ---------- Manual per-material generation (fine control) ----------
const MaterialTab = ({ guard, provider, mode, seedMaterial }) => {
  const project = useStudioStore((s) => s.project);
  const availableMaterials = useStudioStore((s) => s.availableMaterials);
  const assignMaterial = useStudioStore((s) => s.assignMaterial);
  const [material, setMaterial] = useState(seedMaterial || "");
  const [refs, setRefs] = useState([]);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { if (seedMaterial) setMaterial(seedMaterial); }, [seedMaterial]);

  const doGen = async () => {
    const vrm = window.__vcs_vrm;
    if (!vrm) return toast.error("Load a VRM first");
    if (!material) return toast.error("Pick a material");
    if (!refs.length && !desc.trim()) return toast.error("Add a garment reference or a description");
    setBusy(true); setResult(null);
    try {
      const atlas = await extractOriginalAtlas(vrm, material);
      const uv = atlas ? null : await extractUvTemplate(vrm, material, 1024);
      const cat = classifyMaterial(material);
      const { asset, guard: verdict } = await api.generateMaterialTexture({
        original_atlas_data_url: atlas?.dataUrl || null,
        uv_template_data_url: uv,
        garment_data_url: refs[0] || null,
        region: cat,
        description: desc,
        guard,
        provider,
        mode,
        project_id: project?.id || null,
      });
      const count = await applyTexture(vrm, material, asset.data_url,
        atlas ? { flipY: atlas.flipY } : null);
      if (count > 0) assignMaterial(material, asset);
      setResult({ dataUrl: asset.data_url, guard: verdict });
      toast.success(`Painted ${material}`);
    } catch (e) {
      toast.error("Generation failed", { description: e?.response?.data?.detail || String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-[360px_1fr] gap-4 h-full">
      <div className="space-y-3 overflow-auto pr-2">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Target material (its real UV is used)</div>
          <Select value={material} onValueChange={setMaterial}>
            <SelectTrigger className="h-8 text-xs" data-testid="material-target-select">
              <SelectValue placeholder={availableMaterials.length ? "Choose material…" : "Load a VRM first"} />
            </SelectTrigger>
            <SelectContent>
              {availableMaterials.map((m) => (
                <SelectItem key={m.uuid} value={m.name}>{CATEGORY_LABELS[classifyMaterial(m.name)]} · {m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <RefDropzone refs={refs} setRefs={setRefs} testid="material-ref"
          hint="Optional: drop the garment/object reference to copy its look." />
        <div>
          <div className="text-xs text-muted-foreground mb-1">Describe it (optional)</div>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="navy sailor collar with white trim" data-testid="material-desc" />
        </div>
        <Button onClick={doGen} disabled={busy || !material} className="w-full" data-testid="material-generate">
          <Sparkles size={14} className="mr-1.5" /> {busy ? "Painting…" : "Generate & apply"}
        </Button>
      </div>
      <ScrollArea className="h-full min-h-0">
        <div className="pr-2 pb-4">
          {!result && !busy && (
            <div className="text-xs text-muted-foreground py-8 text-center">
              Pick a material, add a garment reference or description, and it paints an anime texture onto that material's real UV layout — then applies it live.
            </div>
          )}
          {busy && <Skeleton className="aspect-square max-w-[320px] rounded-lg" />}
          {result && (
            <div className="max-w-[360px] space-y-2" data-testid="material-result">
              <img src={result.dataUrl} alt="texture" className="w-full rounded-lg border border-border/60" />
              <div className="flex items-center gap-2"><GuardBadge guard={result.guard} /><span className="text-[11px] text-muted-foreground">applied to {material}</span></div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

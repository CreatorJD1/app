import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, ImagePlus, Wand2, Upload, RefreshCw, X, Check, ZoomIn, Shirt } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { applyTextureToMaterial } from "@/lib/vrmLoader";
import { upscaleImage, UPSCALE_PRESETS } from "@/lib/upscaler";

const TEXTURE_KINDS = [
  { id: "texture", label: "Clothing / Cloth", prompt: "An anime clothing fabric texture, seamless tileable, cel-shaded" },
  { id: "hair", label: "Hair Strands", prompt: "Anime hair texture with glossy highlights, seamless" },
  { id: "skin", label: "Skin", prompt: "Soft pastel anime skin material, smooth gradients" },
  { id: "eye", label: "Eye Iris", prompt: "A single detailed anime eye iris, centered, high detail" },
  { id: "pattern", label: "Decorative Pattern", prompt: "An anime decorative pattern, seamless tileable" },
];

const QUICK_PROMPTS = [
  "pastel pink lolita fabric with cherry blossoms",
  "navy sailor uniform with white trim",
  "cyberpunk hoodie with glowing teal circuit lines",
  "kimono silk with koi fish and gold leaf",
  "denim jacket with painted anime graffiti",
  "lavender ombre hair with silver tips",
];

export const TextureLabDialog = () => {
  const open = useStudioStore((s) => s.isTextureLabOpen);
  const setOpen = useStudioStore((s) => s.setTextureLabOpen);
  const project = useStudioStore((s) => s.project);
  const addRecentAsset = useStudioStore((s) => s.addRecentAsset);
  const availableMaterials = useStudioStore((s) => s.availableMaterials);
  const assignMaterial = useStudioStore((s) => s.assignMaterial);

  const [kind, setKind] = useState("texture");
  const [prompt, setPrompt] = useState(TEXTURE_KINDS[0].prompt);
  const [busy, setBusy] = useState(false);
  const [assets, setAssets] = useState([]);
  const [refFile, setRefFile] = useState(null);
  const [refDataUrl, setRefDataUrl] = useState("");
  const [variantPrompt, setVariantPrompt] = useState("Change palette to pastel mint");
  const [pending, setPending] = useState([]); // ids for skeletons

  const refInputRef = useRef(null);

  const loadAssets = async () => {
    try {
      const params = { limit: 60 };
      const { assets } = await api.listAssets(params);
      setAssets(assets || []);
    } catch (e) {}
  };
  useEffect(() => {
    if (open) loadAssets();
  }, [open]);

  const doGenerateTexture = async () => {
    if (!prompt.trim()) return toast.error("Enter a prompt");
    const pid = `p-${Date.now()}`;
    setPending((p) => [pid, ...p]);
    setBusy(true);
    try {
      const { asset } = await api.generateTexture(prompt, kind, project?.id || null);
      addRecentAsset(asset);
      setAssets((a) => [asset, ...a]);
      toast.success("Texture generated");
    } catch (e) {
      toast.error("Generation failed", { description: e?.response?.data?.detail || String(e?.message || e) });
    } finally {
      setPending((p) => p.filter((x) => x !== pid));
      setBusy(false);
    }
  };

  const doGenerateVariant = async () => {
    if (!refDataUrl) return toast.error("Upload a reference image first");
    if (!variantPrompt.trim()) return toast.error("Describe the change");
    const pid = `p-${Date.now()}`;
    setPending((p) => [pid, ...p]);
    setBusy(true);
    try {
      const { asset } = await api.generateVariant({
        prompt: variantPrompt,
        reference_data_url: refDataUrl,
        project_id: project?.id || null,
      });
      addRecentAsset(asset);
      setAssets((a) => [asset, ...a]);
      toast.success("Variant generated");
    } catch (e) {
      toast.error("Generation failed", { description: e?.response?.data?.detail || String(e?.message || e) });
    } finally {
      setPending((p) => p.filter((x) => x !== pid));
      setBusy(false);
    }
  };

  const onRefFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setRefFile(file);
    const reader = new FileReader();
    reader.onload = () => setRefDataUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const applyToMaterial = async (asset, matName) => {
    const vrm = window.__vcs_vrm;
    if (!vrm) return toast.error("Load a VRM to apply textures");
    try {
      const count = await applyTextureToMaterial(vrm, matName, asset.data_url);
      if (count === 0) toast.warning("Material not found");
      else {
        assignMaterial(matName, asset);
        toast.success(`Applied to ${matName}`);
      }
    } catch (e) {
      toast.error("Apply failed", { description: String(e?.message || e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col" data-testid="texture-lab-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" /> Texture Lab
          </DialogTitle>
          <DialogDescription>
            Generate anime-only textures, hair &amp; eye materials, or upload a reference and iterate.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="prompt" className="flex-1 flex flex-col min-h-0">
          <TabsList>
            <TabsTrigger value="prompt" data-testid="texlab-tab-prompt">From Prompt</TabsTrigger>
            <TabsTrigger value="wardrobe" data-testid="texlab-tab-wardrobe">Wardrobe</TabsTrigger>
            <TabsTrigger value="accessories" data-testid="texlab-tab-accessories">Accessories</TabsTrigger>
            <TabsTrigger value="reference" data-testid="texlab-tab-reference">From Reference</TabsTrigger>
            <TabsTrigger value="library" data-testid="texlab-tab-library">Library</TabsTrigger>
          </TabsList>

          {/* Prompt-based */}
          <TabsContent value="prompt" className="flex-1 min-h-0 mt-2">
            <div className="grid grid-cols-[380px_1fr] gap-4 h-full">
              <div className="space-y-3 overflow-auto pr-2">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Texture type</div>
                  <Select value={kind} onValueChange={(v) => {
                    setKind(v);
                    const k = TEXTURE_KINDS.find((k) => k.id === v);
                    if (k) setPrompt(k.prompt);
                  }}>
                    <SelectTrigger data-testid="texlab-kind-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TEXTURE_KINDS.map((k) => (
                        <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Describe the material</div>
                  <Textarea
                    data-testid="texlab-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[120px] font-mono text-xs"
                  />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground mb-1">Quick prompts</div>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setPrompt(p)}
                        className="text-[11px] rounded-full border border-border/70 px-2.5 py-1 hover:border-primary/50 hover:text-primary transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  data-testid="texture-lab-generate-button"
                  onClick={doGenerateTexture}
                  disabled={busy}
                  className="w-full"
                >
                  <Sparkles size={14} className="mr-1.5" /> {busy ? "Generating..." : "Generate Texture"}
                </Button>
              </div>

              <ResultsGrid
                assets={assets}
                pendingCount={pending.length}
                materials={availableMaterials}
                onApply={applyToMaterial}
              />
            </div>
          </TabsContent>

          {/* Reference-based */}
          <TabsContent value="reference" className="flex-1 min-h-0 mt-2">
            <div className="grid grid-cols-[380px_1fr] gap-4 h-full">
              <div className="space-y-3 overflow-auto pr-2">
                <div
                  className="aspect-square rounded-lg border border-dashed border-border/80 flex items-center justify-center overflow-hidden bg-black/30 relative"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    onRefFile(e.dataTransfer.files?.[0]);
                  }}
                >
                  {refDataUrl ? (
                    <img src={refDataUrl} alt="reference" className="h-full w-full object-contain" />
                  ) : (
                    <div className="text-center p-4 text-xs text-muted-foreground">
                      Drop or upload a reference image (any subject).
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => refInputRef.current?.click()} data-testid="texture-lab-reference-upload">
                    <Upload size={14} className="mr-1.5" /> Upload
                  </Button>
                  <Button variant="ghost" onClick={() => { setRefFile(null); setRefDataUrl(""); }}>
                    <X size={14} />
                  </Button>
                </div>
                <input
                  ref={refInputRef}
                  data-testid="texture-lab-reference-upload-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onRefFile(e.target.files?.[0])}
                />
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Describe the change (anime style locked)</div>
                  <Textarea
                    data-testid="texlab-variant-prompt"
                    value={variantPrompt}
                    onChange={(e) => setVariantPrompt(e.target.value)}
                    className="min-h-[100px] font-mono text-xs"
                  />
                </div>
                <Button
                  data-testid="texture-lab-generate-variant"
                  onClick={doGenerateVariant}
                  disabled={busy || !refDataUrl}
                  className="w-full"
                >
                  <Wand2 size={14} className="mr-1.5" />
                  {busy ? "Generating..." : "Generate Anime Variant"}
                </Button>
              </div>
              <ResultsGrid
                assets={assets}
                pendingCount={pending.length}
                materials={availableMaterials}
                onApply={applyToMaterial}
              />
            </div>
          </TabsContent>

          {/* Library */}
          <TabsContent value="library" className="flex-1 min-h-0 mt-2">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-muted-foreground">All generated assets</div>
                <Button variant="ghost" size="sm" onClick={loadAssets}><RefreshCw size={12} className="mr-1" /> Refresh</Button>
              </div>
              <ResultsGrid
                assets={assets}
                pendingCount={0}
                materials={availableMaterials}
                onApply={applyToMaterial}
                showAll
              />
            </div>
          </TabsContent>

          {/* Wardrobe */}
          <TabsContent value="wardrobe" className="flex-1 min-h-0 mt-2">
            <WardrobeTab onGenerated={(items) => { setAssets((a) => [...items.filter(Boolean), ...a]); loadAssets(); }} />
          </TabsContent>

          {/* Accessories */}
          <TabsContent value="accessories" className="flex-1 min-h-0 mt-2">
            <AccessoriesTab onGenerated={(items) => { setAssets((a) => [...items.filter(Boolean), ...a]); loadAssets(); }} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

const ResultsGrid = ({ assets, pendingCount, materials, onApply, showAll = false }) => {
  return (
    <ScrollArea className="h-full min-h-0">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 pr-2 pb-4">
        {Array.from({ length: pendingCount }).map((_, i) => (
          <Skeleton key={`sk-${i}`} className="aspect-square rounded-lg" />
        ))}
        {assets.length === 0 && pendingCount === 0 && (
          <div className="col-span-full text-xs text-muted-foreground py-8 text-center">
            No assets yet. Generate a texture or a variant to get started.
          </div>
        )}
        {assets.map((a) => (
          <AssetCard key={a.id} asset={a} materials={materials} onApply={onApply} />
        ))}
      </div>
    </ScrollArea>
  );
};

const AssetCard = ({ asset, materials, onApply }) => {
  const [selectMat, setSelectMat] = useState("");
  const [upscaling, setUpscaling] = useState(false);
  const project = useStudioStore((s) => s.project);
  const addRecentAsset = useStudioStore((s) => s.addRecentAsset);
  const bumpAssets = useStudioStore((s) => s.bumpAssetsList);

  const doUpscale = async (target) => {
    setUpscaling(true);
    try {
      toast.info(`Upscaling to ${target}px...`);
      const { dataUrl, width, height } = await upscaleImage(asset.data_url, target);
      const { asset: saved } = await api.saveUpscale({
        source_asset_id: asset.id,
        data_url: dataUrl,
        width, height,
        label: `${target}px`,
        project_id: project?.id || null,
      });
      addRecentAsset(saved);
      bumpAssets();
      toast.success(`Upscaled to ${width}\u00d7${height}`);
    } catch (e) {
      toast.error("Upscale failed", { description: String(e?.message || e) });
    } finally {
      setUpscaling(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden group" data-testid={`asset-card-${asset.id}`}>
      <div className="aspect-square overflow-hidden bg-black/40 relative">
        <img src={asset.data_url} alt="" className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform" />
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {UPSCALE_PRESETS.map((p) => (
            <button
              key={p.id}
              disabled={upscaling}
              onClick={() => doUpscale(p.id)}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/70 border border-white/10 hover:border-primary/60 hover:text-primary"
              title={`Upscale to ${p.label}`}
              data-testid={`upscale-${asset.id}-${p.id}`}
            >
              {p.id >= 8192 ? "8K" : p.id >= 4096 ? "4K" : "2K"}
            </button>
          ))}
        </div>
      </div>
      <div className="p-2 space-y-1.5 bg-card/60">
        <div className="text-[10px] font-mono text-muted-foreground uppercase">{asset.kind}{asset.subkind ? ` · ${asset.subkind}` : ""}</div>
        <div className="text-[11px] leading-4 line-clamp-2" title={asset.prompt}>{asset.prompt}</div>
        {materials?.length > 0 && (
          <div className="flex gap-1">
            <Select value={selectMat} onValueChange={setSelectMat}>
              <SelectTrigger className="h-7 text-[11px]" data-testid={`asset-mat-select-${asset.id}`}>
                <SelectValue placeholder="Apply to..." />
              </SelectTrigger>
              <SelectContent>
                {materials.map((m) => <SelectItem key={m.uuid} value={m.name}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              data-testid={`asset-apply-${asset.id}`}
              size="icon"
              className="h-7 w-7"
              disabled={!selectMat}
              onClick={() => onApply(asset, selectMat)}
            >
              <Check size={14} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};


const WARDROBE_THEMES = [
  "school uniform seifuku set, navy + white",
  "cyberpunk street outfit, black + neon teal",
  "gothic lolita, black + lace",
  "magical girl, pastel pink + gold",
  "streetwear hoodie set, ivory + electric blue",
  "kimono festival outfit, red + gold",
];

const WardrobeTab = ({ onGenerated }) => {
  const project = useStudioStore((s) => s.project);
  const [theme, setTheme] = useState(WARDROBE_THEMES[0]);
  const [palette, setPalette] = useState("navy and white");
  const [pieces, setPieces] = useState(["tops", "bottoms", "shoes", "outerwear"]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);

  const togglePiece = (p) => setPieces((s) => s.includes(p) ? s.filter((x) => x !== p) : [...s, p]);

  const doGen = async () => {
    if (!theme.trim()) return toast.error("Enter a theme");
    setBusy(true);
    setResults([]);
    try {
      const r = await api.generateWardrobe({ theme, palette, pieces, project_id: project?.id || null });
      setResults(r.items || []);
      onGenerated((r.items || []).filter((i) => i.asset).map((i) => i.asset));
      toast.success(`Wardrobe ready (${(r.items || []).filter((i) => i.asset).length}/${(r.items || []).length})`);
    } catch (e) {
      toast.error("Failed", { description: e?.response?.data?.detail || String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-[380px_1fr] gap-4 h-full">
      <div className="space-y-3 overflow-auto pr-2">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Outfit theme</div>
          <Textarea data-testid="wardrobe-theme" className="min-h-[80px] font-mono text-xs" value={theme} onChange={(e) => setTheme(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Color palette</div>
          <Input data-testid="wardrobe-palette" value={palette} onChange={(e) => setPalette(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Pieces (auto-generated)</div>
          <div className="flex flex-wrap gap-1.5">
            {["tops", "bottoms", "shoes", "outerwear", "onepiece", "accessory"].map((p) => (
              <button key={p} data-testid={`wardrobe-piece-${p}`} onClick={() => togglePiece(p)}
                className={`text-[11px] rounded-full border px-2.5 py-1 transition-colors ${
                  pieces.includes(p) ? "border-primary/60 text-primary bg-primary/10" : "border-border/70"
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground mb-1">Quick themes</div>
          <div className="flex flex-wrap gap-1.5">
            {WARDROBE_THEMES.map((t) => (
              <button key={t} onClick={() => setTheme(t)} className="text-[11px] rounded-full border border-border/70 px-2.5 py-1 hover:border-primary/50 hover:text-primary">{t.slice(0, 32)}...</button>
            ))}
          </div>
        </div>
        <Button data-testid="wardrobe-generate" onClick={doGen} disabled={busy || !pieces.length} className="w-full">
          <Shirt size={14} className="mr-1.5" /> {busy ? "Generating..." : `Generate Wardrobe (${pieces.length})`}
        </Button>
      </div>
      <ScrollArea className="h-full min-h-0">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pr-2 pb-4">
          {busy && Array.from({ length: pieces.length || 4 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
          {results.map((r, i) => (
            <div key={i} className="rounded-lg border border-border/60 overflow-hidden">
              <div className="aspect-square bg-black/40 overflow-hidden">
                {r.asset ? <img src={r.asset.data_url} alt={r.piece} className="h-full w-full object-cover" /> : <div className="h-full grid place-items-center text-[10px] text-destructive p-2 text-center">Failed</div>}
              </div>
              <div className="p-2 text-[10px] font-mono uppercase text-muted-foreground">{r.piece}</div>
            </div>
          ))}
          {!busy && results.length === 0 && (
            <div className="col-span-full text-xs text-muted-foreground py-8 text-center">
              Pick a theme + pieces and generate a coordinated outfit set.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

const ACCESSORY_KINDS = ["hair_accessory", "earring", "necklace", "glasses", "tail", "wings"];

const AccessoriesTab = ({ onGenerated }) => {
  const project = useStudioStore((s) => s.project);
  const [theme, setTheme] = useState("kawaii pastel accessories with ribbons");
  const [kinds, setKinds] = useState(["hair_accessory", "earring", "necklace"]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);

  const toggleKind = (k) => setKinds((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]);

  const doGen = async () => {
    if (!kinds.length) return toast.error("Pick at least one accessory kind");
    setBusy(true);
    setResults([]);
    try {
      const r = await api.generateAccessories({ theme, kinds, project_id: project?.id || null });
      setResults(r.items || []);
      onGenerated((r.items || []).filter((i) => i.asset).map((i) => i.asset));
      toast.success(`Accessories ready (${(r.items || []).filter((i) => i.asset).length}/${(r.items || []).length})`);
    } catch (e) {
      toast.error("Failed", { description: e?.response?.data?.detail || String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-[380px_1fr] gap-4 h-full">
      <div className="space-y-3 overflow-auto pr-2">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Style theme</div>
          <Textarea data-testid="accessory-theme" className="min-h-[80px] font-mono text-xs" value={theme} onChange={(e) => setTheme(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Kinds</div>
          <div className="flex flex-wrap gap-1.5">
            {ACCESSORY_KINDS.map((k) => (
              <button key={k} data-testid={`accessory-kind-${k}`} onClick={() => toggleKind(k)}
                className={`text-[11px] rounded-full border px-2.5 py-1 ${kinds.includes(k) ? "border-primary/60 text-primary bg-primary/10" : "border-border/70"}`}>
                {k.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
        <Button data-testid="accessory-generate" onClick={doGen} disabled={busy || !kinds.length} className="w-full">
          <Sparkles size={14} className="mr-1.5" /> {busy ? "Generating..." : `Generate ${kinds.length} accessories`}
        </Button>
      </div>
      <ScrollArea className="h-full min-h-0">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pr-2 pb-4">
          {busy && kinds.map((k, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
          {results.map((r, i) => (
            <div key={i} className="rounded-lg border border-border/60 overflow-hidden">
              <div className="aspect-square bg-black/40 overflow-hidden">
                {r.asset ? <img src={r.asset.data_url} alt={r.kind} className="h-full w-full object-cover" /> : <div className="h-full grid place-items-center text-[10px] text-destructive p-2 text-center">Failed</div>}
              </div>
              <div className="p-2 text-[10px] font-mono uppercase text-muted-foreground">{r.kind.replace("_", " ")}</div>
            </div>
          ))}
          {!busy && results.length === 0 && (
            <div className="col-span-full text-xs text-muted-foreground py-8 text-center">Pick kinds and generate matching accessories.</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Upload, X, Copy, Wand2, Boxes, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useStudioStore } from "@/store/studioStore";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const CharacterAnalyzerDialog = () => {
  const open = useStudioStore((s) => s.isAnalyzerOpen);
  const setOpen = useStudioStore((s) => s.setAnalyzerOpen);
  const project = useStudioStore((s) => s.project);
  const addRecentAsset = useStudioStore((s) => s.addRecentAsset);
  const bumpAssets = useStudioStore((s) => s.bumpAssetsList);

  const [refDataUrl, setRefDataUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [wantTurnaround, setWantTurnaround] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [preview, setPreview] = useState(null);
  const [turnaround, setTurnaround] = useState([]);
  const inputRef = useRef(null);

  const onFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image");
    const reader = new FileReader();
    reader.onload = () => setRefDataUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const doAnalyze = async () => {
    if (!refDataUrl) return toast.error("Upload a reference image first");
    setBusy(true);
    setAnalysis(null);
    setPreview(null);
    setTurnaround([]);
    try {
      const { data } = await axios.post(`${API}/analyze/character`, {
        reference_data_url: refDataUrl,
        notes,
        project_id: project?.id || null,
        generate_turnaround: wantTurnaround,
      }, { timeout: 300000 });
      setAnalysis(data.analysis);
      setPreview(data.preview_asset);
      setTurnaround(data.turnaround_panels || []);
      if (data.preview_asset) addRecentAsset(data.preview_asset);
      (data.turnaround_panels || []).forEach((p) => p.asset && addRecentAsset(p.asset));
      bumpAssets();
      toast.success("Character analyzed");
    } catch (e) {
      toast.error("Analysis failed", { description: e?.response?.data?.detail || String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  };

  const copyRecipe = () => {
    if (!analysis) return;
    const text = renderRecipe(analysis);
    navigator.clipboard.writeText(text).then(() => toast.success("Recipe copied"));
  };

  const copyJson = () => {
    if (!analysis) return;
    navigator.clipboard.writeText(JSON.stringify(analysis, null, 2)).then(() => toast.success("JSON copied"));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-6xl h-[88vh] flex flex-col" data-testid="analyzer-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary" /> Character Analyzer &mdash; Reference to VRoid Recipe
          </DialogTitle>
          <DialogDescription>
            Upload character sheet / reference art. AI extracts every attribute and outputs a copy-paste recipe for VRoid Studio, plus a matching turnaround.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[380px_1fr] gap-4 flex-1 min-h-0">
          <div className="space-y-3 overflow-auto pr-2">
            <div className="aspect-square rounded-lg border border-dashed border-border/80 flex items-center justify-center overflow-hidden bg-black/30 relative"
                 onDragOver={(e) => e.preventDefault()}
                 onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}>
              {refDataUrl ? (
                <img src={refDataUrl} alt="ref" className="h-full w-full object-contain" />
              ) : (
                <div className="text-center p-4 text-xs text-muted-foreground">
                  Drop character sheet or reference image<br />(front view works best)
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => inputRef.current?.click()} data-testid="analyzer-upload">
                <Upload size={14} className="mr-1.5" /> Upload
              </Button>
              <Button variant="ghost" onClick={() => setRefDataUrl("")}>
                <X size={14} />
              </Button>
            </div>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

            <div>
              <Label className="text-xs">Optional notes (things AI might miss)</Label>
              <Textarea data-testid="analyzer-notes" className="mt-1 min-h-[80px] text-xs" placeholder="e.g. she has a fox tail, glowing pink eyes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/70 p-2">
              <div>
                <div className="text-xs font-medium">Also generate turnaround</div>
                <div className="text-[10px] text-muted-foreground">Adds ~60s for 4-angle sheet</div>
              </div>
              <Switch data-testid="analyzer-turnaround-toggle" checked={wantTurnaround} onCheckedChange={setWantTurnaround} />
            </div>

            <Button data-testid="analyzer-run" onClick={doAnalyze} disabled={busy || !refDataUrl} className="w-full">
              {busy ? <Loader2 className="animate-spin mr-1.5" size={14} /> : <Wand2 size={14} className="mr-1.5" />}
              {busy ? "Analyzing..." : "Analyze Character"}
            </Button>

            <div className="text-[11px] text-muted-foreground pt-2">
              <div className="font-mono">How this works</div>
              <ol className="list-decimal list-inside space-y-0.5 mt-1">
                <li>Gemini vision reads your reference</li>
                <li>Extracts VRoid parameters (colors, style, outfit)</li>
                <li>Produces a copy-paste recipe + concept preview</li>
                <li>Optional 4-angle turnaround for VRoid modeling</li>
              </ol>
              <div className="mt-2">Note: VRoid Studio has no external automation API. Follow the recipe manually to build the model; the analyzer removes the guesswork.</div>
            </div>
          </div>

          <ScrollArea className="h-full min-h-0">
            <div className="space-y-4 pr-2 pb-4">
              {!analysis && !busy && (
                <div className="h-64 grid place-items-center text-xs text-muted-foreground">
                  Analysis results will appear here.
                </div>
              )}
              {busy && !analysis && (
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-40" />
                  <Skeleton className="h-40" />
                  <Skeleton className="h-40" />
                  <Skeleton className="h-40" />
                </div>
              )}
              {analysis && (
                <>
                  {preview && (
                    <div>
                      <div className="text-xs uppercase font-mono tracking-wider text-muted-foreground mb-1">Concept Preview</div>
                      <div className="aspect-video rounded-lg overflow-hidden bg-black/30 border border-border/60">
                        <img src={preview.data_url} alt="preview" className="h-full w-full object-contain" />
                      </div>
                    </div>
                  )}

                  {turnaround.length > 0 && (
                    <div>
                      <div className="text-xs uppercase font-mono tracking-wider text-muted-foreground mb-1">Turnaround</div>
                      <div className="grid grid-cols-4 gap-2">
                        {turnaround.map((p) => (
                          <div key={p.label} className="aspect-[3/4] rounded-lg overflow-hidden bg-black/30 border border-border/60">
                            {p.asset ? <img src={p.asset.data_url} className="h-full w-full object-cover" alt={p.label} /> : <div className="h-full grid place-items-center text-[10px] text-destructive p-2 text-center">Failed</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={copyRecipe} data-testid="analyzer-copy-recipe">
                      <Copy size={12} className="mr-1.5" /> Copy VRoid Recipe
                    </Button>
                    <Button size="sm" variant="ghost" onClick={copyJson} data-testid="analyzer-copy-json">
                      <Copy size={12} className="mr-1.5" /> Copy JSON
                    </Button>
                  </div>

                  <AnalysisSummary analysis={analysis} />
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ label, value }) => (
  <div className="grid grid-cols-[130px_1fr] gap-2 text-xs">
    <div className="text-muted-foreground">{label}</div>
    <div className="font-mono">{value ?? "—"}</div>
  </div>
);

const Swatch = ({ hex }) => hex ? (
  <span className="inline-flex items-center gap-1 mr-1 font-mono text-[10px]">
    <span className="h-3 w-3 rounded-sm border border-white/20" style={{ background: hex }} />
    {hex}
  </span>
) : null;

const Section = ({ title, children }) => (
  <div className="rounded-lg border border-border/60 p-3 bg-card/50">
    <div className="text-xs uppercase font-mono tracking-wider text-primary mb-2">{title}</div>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const AnalysisSummary = ({ analysis }) => {
  const a = analysis || {};
  const eye = a.eyes || {};
  const hair = a.hair || {};
  const face = a.face || {};
  const outfit = a.outfit || {};
  return (
    <div className="grid grid-cols-2 gap-3">
      <Section title="Identity">
        <Row label="Name idea" value={a.identity?.name_suggestion} />
        <Row label="Vibe" value={(a.identity?.vibe_tags || []).join(" · ")} />
        <Row label="Gender expr." value={a.identity?.gender_expression} />
        <Row label="Age look" value={a.identity?.age_appearance} />
      </Section>
      <Section title="Face">
        <Row label="Shape" value={face.face_shape} />
        <Row label="Skin tone" value={<Swatch hex={face.skin_tone_hex} />} />
        <Row label="Finish" value={face.skin_finish} />
        <Row label="Blush" value={face.blush} />
      </Section>
      <Section title="Eyes">
        <Row label="Shape" value={eye.shape} />
        <Row label="Size" value={eye.size} />
        <Row label="Iris" value={<><Swatch hex={eye.iris_color_hex} /><Swatch hex={eye.iris_secondary_hex} /></>} />
        <Row label="Highlight" value={eye.highlight} />
        <Row label="Eyelash" value={eye.eyelash_style} />
      </Section>
      <Section title="Hair">
        <Row label="Style" value={hair.style} />
        <Row label="Length" value={hair.length} />
        <Row label="Bangs" value={hair.bangs} />
        <Row label="Color" value={<><Swatch hex={hair.base_color_hex} /><Swatch hex={hair.streaks_color_hex} /></>} />
        <Row label="Highlights" value={hair.highlights} />
      </Section>
      <Section title="Body">
        <Row label="Height" value={a.body?.height_class} />
        <Row label="Build" value={a.body?.build} />
      </Section>
      <Section title="Outfit">
        <Row label="Top" value={outfit.top?.description} />
        <Row label="Colors" value={(outfit.top?.colors_hex || []).map((h) => <Swatch key={h} hex={h} />)} />
        <Row label="Bottom" value={outfit.bottom?.description} />
        <Row label="Shoes" value={outfit.shoes?.description} />
        <Row label="Outerwear" value={outfit.outerwear?.description} />
        <Row label="One-piece?" value={outfit.is_onepiece ? "yes" : "no"} />
      </Section>
      {a.accessories?.length > 0 && (
        <Section title="Accessories">
          {a.accessories.map((acc, i) => (
            <Row key={i} label={acc.kind} value={<>{acc.description} {(acc.colors_hex || []).map((h) => <Swatch key={h} hex={h} />)}</>} />
          ))}
        </Section>
      )}
      {a.vroid_recipe?.suggested_steps && (
        <div className="col-span-2">
          <Section title="VRoid Studio Recipe">
            <ol className="list-decimal list-inside text-xs space-y-1">
              {a.vroid_recipe.suggested_steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            {a.vroid_recipe.notes && (
              <div className="mt-2 text-[11px] text-muted-foreground italic">{a.vroid_recipe.notes}</div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
};

function renderRecipe(a) {
  const lines = [];
  lines.push("=== VRoid Studio Recipe ===");
  if (a.identity?.name_suggestion) lines.push(`Name: ${a.identity.name_suggestion}`);
  if (a.identity?.vibe_tags?.length) lines.push(`Vibe: ${a.identity.vibe_tags.join(", ")}`);
  lines.push("");
  lines.push("-- Face --");
  lines.push(`Shape: ${a.face?.face_shape || ""}\nSkin: ${a.face?.skin_tone_hex || ""} (${a.face?.skin_finish || ""})\nBlush: ${a.face?.blush || ""}`);
  lines.push("");
  lines.push("-- Eyes --");
  lines.push(`Shape/Size: ${a.eyes?.shape || ""} / ${a.eyes?.size || ""}\nIris: ${a.eyes?.iris_color_hex || ""}${a.eyes?.iris_secondary_hex ? " + " + a.eyes.iris_secondary_hex : ""}\nHighlight: ${a.eyes?.highlight || ""}\nEyelash: ${a.eyes?.eyelash_style || ""}`);
  lines.push("");
  lines.push("-- Hair --");
  lines.push(`Style: ${a.hair?.style || ""} · Length: ${a.hair?.length || ""} · Bangs: ${a.hair?.bangs || ""}\nColor: ${a.hair?.base_color_hex || ""}${a.hair?.streaks_color_hex ? " + " + a.hair.streaks_color_hex : ""}\nHighlights: ${a.hair?.highlights || ""}\nAccessories: ${(a.hair?.accessories || []).join(", ") || "none"}`);
  lines.push("");
  lines.push("-- Body --");
  lines.push(`${a.body?.height_class || ""} / ${a.body?.build || ""}`);
  lines.push("");
  lines.push("-- Outfit --");
  if (a.outfit?.top) lines.push(`Top: ${a.outfit.top.description} (${(a.outfit.top.colors_hex || []).join(", ")}) [${a.outfit.top.material || ""}]`);
  if (a.outfit?.bottom) lines.push(`Bottom: ${a.outfit.bottom.description} (${(a.outfit.bottom.colors_hex || []).join(", ")}) [${a.outfit.bottom.material || ""}]`);
  if (a.outfit?.shoes) lines.push(`Shoes: ${a.outfit.shoes.description} (${(a.outfit.shoes.colors_hex || []).join(", ")})`);
  if (a.outfit?.outerwear?.description) lines.push(`Outerwear: ${a.outfit.outerwear.description} (${(a.outfit.outerwear.colors_hex || []).join(", ")})`);
  lines.push(`One-piece: ${a.outfit?.is_onepiece ? "yes" : "no"}`);
  lines.push("");
  if (a.accessories?.length) {
    lines.push("-- Accessories --");
    a.accessories.forEach((acc) => lines.push(`- ${acc.kind}: ${acc.description}`));
    lines.push("");
  }
  if (a.vroid_recipe?.suggested_steps?.length) {
    lines.push("-- Steps in VRoid Studio --");
    a.vroid_recipe.suggested_steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push("");
  }
  if (a.vroid_recipe?.clothing_categories_to_use?.length) {
    lines.push("Clothing categories: " + a.vroid_recipe.clothing_categories_to_use.join(", "));
  }
  if (a.vroid_recipe?.notes) {
    lines.push("");
    lines.push("Notes: " + a.vroid_recipe.notes);
  }
  return lines.join("\n");
}

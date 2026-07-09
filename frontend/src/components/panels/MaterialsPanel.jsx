import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Download, RotateCcw, Sliders, Sparkles, Undo2, Grid3x3, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudioStore, defaultTransform } from "@/store/studioStore";
import {
  applyTexture,
  updateMaterialTransform,
  restoreMaterial,
  extractUvTemplate,
  applyEmissive,
  clearEmissive,
  matchAlpeccaDesign,
  classifyMaterial,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
} from "@/lib/materialUtils";
import { api } from "@/lib/api";

export const MaterialsPanel = () => {
  const availableMaterials = useStudioStore((s) => s.availableMaterials);
  const setTextureLabOpen = useStudioStore((s) => s.setTextureLabOpen);
  const materialAssignments = useStudioStore((s) => s.materialAssignments);
  const assignMaterial = useStudioStore((s) => s.assignMaterial);
  const materialTransforms = useStudioStore((s) => s.materialTransforms);
  const setMaterialTransform = useStudioStore((s) => s.setMaterialTransform);
  const resetMaterialTransform = useStudioStore((s) => s.resetMaterialTransform);
  const clearAssignment = useStudioStore((s) => s.clearMaterialAssignment);
  const setPendingUvReference = useStudioStore((s) => s.setPendingUvReference);
  const bloomStrength = useStudioStore((s) => s.bloomStrength);
  const setBloomStrength = useStudioStore((s) => s.setBloomStrength);

  const [assets, setAssets] = useState([]);
  const [selected, setSelected] = useState({}); // materialName -> assetId
  const [openGroups, setOpenGroups] = useState({ face: true, hair: true, top: true });
  const [openControls, setOpenControls] = useState({}); // materialName -> boolean
  const [glowing, setGlowing] = useState({}); // materialName -> boolean

  const [matchingHair, setMatchingHair] = useState(false);
  const doMatchDesign = async () => {
    const vrm = window.__vcs_vrm;
    if (!vrm) return toast.error("No VRM loaded");
    setMatchingHair(true);
    try {
      const result = await matchAlpeccaDesign(vrm);
      toast.success("Matched to design", {
        description: [
          result.hair ? "hair gradient" : null,
          result.outfit ? "outfit palette" : null,
          result.accessories ? "blue accessories" : null,
        ].filter(Boolean).join(" · ") || "No matching material names found",
      });
    } catch (e) {
      toast.error("Design match failed", { description: String(e?.message || e) });
    } finally {
      setMatchingHair(false);
    }
  };

  const toggleGlow = async (matName) => {
    const vrm = window.__vcs_vrm;
    if (!vrm) return toast.error("No VRM loaded");
    try {
      if (glowing[matName]) {
        clearEmissive(vrm, matName);
        setGlowing((s) => ({ ...s, [matName]: false }));
        toast.info(`Glow off · ${matName}`);
      } else {
        const n = await applyEmissive(vrm, matName, { intensity: 1.8, pulse: true });
        if (n === 0) return toast.warning("No glow-able surface here", {
          description: "This material is unsaturated (white/grey fabric) or has no emissive slot — saturated accents like her core, eyes and trim glow best.",
        });
        setGlowing((s) => ({ ...s, [matName]: true }));
        toast.success(`Glow on · ${matName}`, { description: "Self-lit in its own colour, with a bloom halo + heartbeat" });
      }
    } catch (e) {
      toast.error("Glow failed", { description: String(e?.message || e) });
    }
  };

  const loadAssets = async () => {
    try {
      const { assets } = await api.listAssets({ limit: 60 });
      setAssets(assets || []);
    } catch (e) {
      /* ignore */
    }
  };

  useEffect(() => {
    loadAssets();
    const unsub = useStudioStore.subscribe((s, prev) => {
      if (s.recentAssets.length !== prev.recentAssets.length) loadAssets();
      if (s.bumpAssets !== prev.bumpAssets) loadAssets();
    });
    return () => unsub();
  }, []);

  // Group materials by category
  const grouped = useMemo(() => {
    const g = {};
    for (const cat of CATEGORY_ORDER) g[cat] = [];
    availableMaterials.forEach((m) => {
      const cat = classifyMaterial(m.name);
      g[cat].push({ ...m, category: cat });
    });
    return g;
  }, [availableMaterials]);

  const applyToSlot = async (matName) => {
    const assetId = selected[matName];
    if (!assetId) {
      toast.error("Pick a texture first");
      return;
    }
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    const vrm = window.__vcs_vrm;
    if (!vrm) {
      toast.error("No VRM loaded");
      return;
    }
    try {
      const t = materialTransforms[matName] || defaultTransform();
      const count = await applyTexture(vrm, matName, asset.data_url, t);
      if (count === 0) {
        toast.warning("No material was updated");
      } else {
        assignMaterial(matName, asset);
        toast.success(`Applied to ${matName}`, {
          description: `${count} material instance(s) updated`,
        });
      }
    } catch (e) {
      toast.error("Failed to apply texture", { description: String(e?.message || e) });
    }
  };

  const doExtractUv = async (matName) => {
    const vrm = window.__vcs_vrm;
    if (!vrm) return toast.error("No VRM loaded");
    try {
      const dataUrl = await extractUvTemplate(vrm, matName, 1024);
      setPendingUvReference({ materialName: matName, dataUrl });
      setTextureLabOpen(true);
      toast.success("UV template ready", {
        description: `Reference loaded in Texture Lab — describe your target style and generate.`,
      });
    } catch (e) {
      toast.error("UV extraction failed", { description: String(e?.message || e) });
    }
  };

  const downloadUvTemplate = async (matName) => {
    const vrm = window.__vcs_vrm;
    if (!vrm) return toast.error("No VRM loaded");
    try {
      const dataUrl = await extractUvTemplate(vrm, matName, 1024);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `uv-template-${matName}.png`;
      a.click();
      toast.success("UV template downloaded");
    } catch (e) {
      toast.error("Download failed", { description: String(e?.message || e) });
    }
  };

  const doRestore = (matName) => {
    const vrm = window.__vcs_vrm;
    if (!vrm) return toast.error("No VRM loaded");
    const count = restoreMaterial(vrm, matName);
    resetMaterialTransform(matName);
    clearAssignment(matName);
    setSelected((s) => ({ ...s, [matName]: "" }));
    if (count > 0) toast.success(`Restored ${matName}`);
    else toast.info("Nothing to restore");
  };

  const updateTransform = (matName, patch) => {
    const vrm = window.__vcs_vrm;
    const current = { ...(materialTransforms[matName] || defaultTransform()), ...patch };
    setMaterialTransform(matName, patch);
    if (vrm) updateMaterialTransform(vrm, matName, current);
  };

  const toggleGroup = (cat) => setOpenGroups((s) => ({ ...s, [cat]: !s[cat] }));
  const toggleControls = (name) => setOpenControls((s) => ({ ...s, [name]: !s[name] }));

  const nonEmptyGroups = CATEGORY_ORDER.filter((c) => grouped[c].length > 0);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold tracking-wide">Material Slots</CardTitle>
          <Button
            data-testid="materials-open-lab"
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            onClick={() => setTextureLabOpen(true)}
          >
            Open Texture Lab
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {availableMaterials.length === 0 && (
            <div className="text-xs text-muted-foreground">
              Load a VRM to see its material slots. Generated textures can be applied to any slot,
              with per-material offset / rotation / repeat controls and one-click UV templates for
              anime-style regeneration.
            </div>
          )}

          {availableMaterials.length > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-black/20 px-2 py-1.5 border border-border/40" data-testid="bloom-row">
              <Zap size={12} className="text-primary shrink-0" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-12 shrink-0">Bloom</span>
              <Slider value={[bloomStrength]} min={0} max={1.5} step={0.05} onValueChange={([v]) => setBloomStrength(v)} data-testid="bloom-strength" />
              <span className="text-[10px] font-mono tabular-nums w-8 text-right text-foreground/80">{Number(bloomStrength).toFixed(2)}</span>
            </div>
          )}

          {availableMaterials.length > 0 && (
            <Button
              data-testid="match-hair"
              size="sm"
              variant="secondary"
              className="h-7 text-[11px] w-full"
              onClick={doMatchDesign}
              disabled={matchingHair}
              title="Match her to the design-lock art: hair gradient, ivory outfit, pale-blue accents, white stockings, cream-blue boots, and blue clip/accessories when matching materials exist"
            >
              <Sparkles size={12} className="mr-1" /> {matchingHair ? "Matching…" : "Match to design"}
            </Button>
          )}

          {nonEmptyGroups.map((cat) => (
            <div key={cat} data-testid={`materials-group-${cat}`}>
              <button
                type="button"
                className="w-full flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors py-1"
                onClick={() => toggleGroup(cat)}
                data-testid={`materials-group-toggle-${cat}`}
              >
                {openGroups[cat] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {CATEGORY_LABELS[cat]}
                <span className="text-muted-foreground/60 font-mono normal-case">
                  ({grouped[cat].length})
                </span>
              </button>
              {openGroups[cat] && (
                <div className="space-y-2 pt-1">
                  {grouped[cat].map((m) => {
                    const assigned = materialAssignments[m.name];
                    const controlsOpen = openControls[m.name];
                    const t = materialTransforms[m.name] || defaultTransform();
                    return (
                      <div
                        key={m.uuid}
                        className="rounded-lg border border-border/60 p-2"
                        data-testid={`material-slot-${m.name}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-md overflow-hidden bg-black/40 border border-border/60 shrink-0">
                            {assigned ? (
                              <img src={assigned.data_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full grid place-items-center text-[10px] text-muted-foreground">n/a</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium truncate" title={m.name}>{m.name}</div>
                            <div className="font-mono text-[10px] text-muted-foreground truncate">
                              {CATEGORY_LABELS[m.category]} · {m.uuid.slice(0, 6)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                          <Select
                            value={selected[m.name] || ""}
                            onValueChange={(v) => setSelected((s) => ({ ...s, [m.name]: v }))}
                          >
                            <SelectTrigger
                              className="h-8 text-xs"
                              data-testid={`material-select-${m.name}`}
                            >
                              <SelectValue placeholder={assets.length ? "Choose texture..." : "No textures yet"} />
                            </SelectTrigger>
                            <SelectContent>
                              {assets.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {(a.subkind || a.kind || "texture") + " · " + (a.prompt || "").slice(0, 40)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            data-testid={`material-apply-${m.name}`}
                            size="sm"
                            className="h-8"
                            onClick={() => applyToSlot(m.name)}
                            disabled={!selected[m.name]}
                          >
                            Apply
                          </Button>
                        </div>

                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          <Button
                            data-testid={`material-uv-${m.name}`}
                            size="sm"
                            variant="secondary"
                            className="h-7 text-[11px]"
                            onClick={() => doExtractUv(m.name)}
                            title="Send this material's UV layout to Texture Lab as a reference image"
                          >
                            <Grid3x3 size={12} className="mr-1" /> UV → Lab
                          </Button>
                          <Button
                            data-testid={`material-uv-download-${m.name}`}
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px]"
                            onClick={() => downloadUvTemplate(m.name)}
                            title="Download UV template PNG"
                          >
                            <Download size={12} className="mr-1" /> Save UV
                          </Button>
                          <Button
                            data-testid={`material-fit-${m.name}`}
                            size="sm"
                            variant={controlsOpen ? "default" : "ghost"}
                            className="h-7 text-[11px]"
                            onClick={() => toggleControls(m.name)}
                          >
                            <Sliders size={12} className="mr-1" /> Fit
                          </Button>
                        </div>

                        <Button
                          data-testid={`material-glow-${m.name}`}
                          size="sm"
                          variant={glowing[m.name] ? "default" : "secondary"}
                          className="h-7 text-[11px] w-full mt-1.5"
                          onClick={() => toggleGlow(m.name)}
                          title="Self-illuminate this material's bright regions (her core emblem, neon accents) with a bloom halo + heartbeat pulse"
                        >
                          <Zap size={12} className="mr-1" /> {glowing[m.name] ? "Glowing" : "Glow"}
                        </Button>

                        {controlsOpen && (
                          <div className="mt-2 rounded-md bg-black/30 p-2 space-y-2 border border-border/40">
                            <TransformRow
                              label="Offset X"
                              value={t.offset[0]}
                              min={-1}
                              max={1}
                              step={0.01}
                              testId={`fit-offset-x-${m.name}`}
                              onChange={(v) => updateTransform(m.name, { offset: [v, t.offset[1]] })}
                            />
                            <TransformRow
                              label="Offset Y"
                              value={t.offset[1]}
                              min={-1}
                              max={1}
                              step={0.01}
                              testId={`fit-offset-y-${m.name}`}
                              onChange={(v) => updateTransform(m.name, { offset: [t.offset[0], v] })}
                            />
                            <TransformRow
                              label="Repeat X"
                              value={t.repeat[0]}
                              min={0.1}
                              max={4}
                              step={0.05}
                              testId={`fit-repeat-x-${m.name}`}
                              onChange={(v) => updateTransform(m.name, { repeat: [v, t.repeat[1]] })}
                            />
                            <TransformRow
                              label="Repeat Y"
                              value={t.repeat[1]}
                              min={0.1}
                              max={4}
                              step={0.05}
                              testId={`fit-repeat-y-${m.name}`}
                              onChange={(v) => updateTransform(m.name, { repeat: [t.repeat[0], v] })}
                            />
                            <TransformRow
                              label="Rotation°"
                              value={(t.rotation * 180) / Math.PI}
                              min={-180}
                              max={180}
                              step={1}
                              testId={`fit-rotation-${m.name}`}
                              onChange={(deg) => updateTransform(m.name, { rotation: (deg * Math.PI) / 180 })}
                            />
                            <div className="flex gap-1 pt-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] flex-1"
                                onClick={() => {
                                  resetMaterialTransform(m.name);
                                  updateTransform(m.name, defaultTransform());
                                }}
                                data-testid={`fit-reset-${m.name}`}
                              >
                                <RotateCcw size={10} className="mr-1" /> Reset
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-[10px] flex-1"
                                onClick={() => doRestore(m.name)}
                                data-testid={`material-restore-${m.name}`}
                              >
                                <Undo2 size={10} className="mr-1" /> Original
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {availableMaterials.length > 0 && (
            <div className="rounded-md border border-primary/25 bg-primary/5 p-2 text-[11px] leading-4 text-muted-foreground">
              <div className="font-semibold text-primary flex items-center gap-1 mb-0.5">
                <Sparkles size={11} /> Tip
              </div>
              For pixel-perfect UV alignment, click <strong>UV → Lab</strong> on a material, then
              describe the target style in Texture Lab. Gemini will paint a new texture on the
              exact UV layout.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const TransformRow = ({ label, value, min, max, step, onChange, testId }) => {
  return (
    <div className="grid grid-cols-[70px_1fr_50px] items-center gap-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        data-testid={testId}
      />
      <div className="text-[10px] font-mono tabular-nums text-right text-foreground/80">{Number(value).toFixed(step >= 1 ? 0 : 2)}</div>
    </div>
  );
};

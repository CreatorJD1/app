import { useRef, useState } from "react";
import { toast } from "sonner";
import { Wand2, Upload, X, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudioStore } from "@/store/studioStore";
import { api } from "@/lib/api";

const PRESETS = [
  "A cheerful anime girl with silver twin-tails, teal eyes, magical girl uniform",
  "An anime boy with pink hair and gold eyes, sci-fi bomber jacket and cargo shorts",
  "A gothic anime idol with black hair, purple eyes, lace dress, thigh-high boots",
  "A cyberpunk anime warrior with neon accents, split hair (teal + violet), armor plates",
];

export const ReferenceStudioDialog = () => {
  const open = useStudioStore((s) => s.isReferenceStudioOpen);
  const setOpen = useStudioStore((s) => s.setReferenceStudioOpen);
  const project = useStudioStore((s) => s.project);
  const addRecentAsset = useStudioStore((s) => s.addRecentAsset);

  const [charDesc, setCharDesc] = useState(PRESETS[0]);
  const [busy, setBusy] = useState(false);
  const [concept, setConcept] = useState(null); // asset object
  const [refDataUrl, setRefDataUrl] = useState("");
  const [panels, setPanels] = useState([]);
  const [pendingConcept, setPendingConcept] = useState(false);
  const [pendingTurnaround, setPendingTurnaround] = useState(false);
  const inputRef = useRef(null);

  const doGenerateConcept = async () => {
    if (!charDesc.trim()) return toast.error("Describe the character");
    setPendingConcept(true);
    setBusy(true);
    try {
      const { asset } = await api.generateConcept(charDesc, project?.id || null);
      addRecentAsset(asset);
      setConcept(asset);
      setRefDataUrl(asset.data_url); // usable as reference for turnaround
      toast.success("Concept generated");
    } catch (e) {
      toast.error("Failed", { description: e?.response?.data?.detail || String(e?.message || e) });
    } finally {
      setPendingConcept(false);
      setBusy(false);
    }
  };

  const doGenerateTurnaround = async () => {
    if (!charDesc.trim()) return toast.error("Describe the character");
    setPendingTurnaround(true);
    setBusy(true);
    setPanels([]);
    try {
      const res = await api.generateTurnaround({
        character_desc: charDesc,
        reference_data_url: refDataUrl || undefined,
        project_id: project?.id || null,
      });
      setPanels(res.panels || []);
      (res.panels || []).forEach((p) => p.asset && addRecentAsset(p.asset));
      const ok = (res.panels || []).filter((p) => p.asset).length;
      toast.success(`Turnaround ready (${ok}/4)`);
    } catch (e) {
      toast.error("Failed", { description: e?.response?.data?.detail || String(e?.message || e) });
    } finally {
      setPendingTurnaround(false);
      setBusy(false);
    }
  };

  const onFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Choose an image");
    const reader = new FileReader();
    reader.onload = () => setRefDataUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col" data-testid="reference-studio-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 size={18} className="text-primary" /> Reference Studio
          </DialogTitle>
          <DialogDescription>
            Design an anime character concept and generate a 4-angle model sheet for your VRM workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[380px_1fr] gap-4 flex-1 min-h-0">
          <div className="space-y-3 overflow-auto pr-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Character description</div>
              <Textarea
                data-testid="refstudio-desc"
                className="min-h-[140px] font-mono text-xs"
                value={charDesc}
                onChange={(e) => setCharDesc(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setCharDesc(p)}
                  className="text-[11px] rounded-full border border-border/70 px-2.5 py-1 hover:border-primary/50 hover:text-primary transition-colors max-w-full text-left"
                >
                  {p.slice(0, 34)}...
                </button>
              ))}
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-1">Optional reference photo</div>
              <div
                className="aspect-square rounded-lg border border-dashed border-border/80 flex items-center justify-center overflow-hidden bg-black/30"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]); }}
              >
                {refDataUrl ? (
                  <img src={refDataUrl} alt="ref" className="h-full w-full object-contain" />
                ) : (
                  <div className="text-center p-4 text-xs text-muted-foreground">Drop or upload (optional)</div>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="secondary" className="flex-1" onClick={() => inputRef.current?.click()} data-testid="refstudio-upload">
                  <Upload size={14} className="mr-1.5" /> Upload
                </Button>
                <Button variant="ghost" onClick={() => setRefDataUrl("")}>
                  <X size={14} />
                </Button>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                data-testid="refstudio-generate-concept"
                variant="secondary"
                onClick={doGenerateConcept}
                disabled={busy}
              >
                <Sparkles size={14} className="mr-1.5" /> Concept
              </Button>
              <Button
                data-testid="refstudio-generate-turnaround"
                onClick={doGenerateTurnaround}
                disabled={busy}
              >
                <Wand2 size={14} className="mr-1.5" /> Turnaround
              </Button>
            </div>
          </div>

          {/* Right side output */}
          <div className="space-y-3 overflow-auto pr-2">
            <div>
              <div className="text-xs uppercase font-mono tracking-wider text-muted-foreground mb-1">Concept</div>
              <div className="aspect-video rounded-lg bg-black/30 border border-border/60 overflow-hidden">
                {pendingConcept ? (
                  <Skeleton className="h-full w-full" />
                ) : concept ? (
                  <img src={concept.data_url} alt="concept" className="h-full w-full object-contain" />
                ) : (
                  <div className="h-full grid place-items-center text-xs text-muted-foreground">
                    Concept art will appear here after generation.
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase font-mono tracking-wider text-muted-foreground mb-1">Turnaround (Front / 3⁄4 / Side / Back)</div>
              <div className="grid grid-cols-4 gap-2">
                {(pendingTurnaround ? [0,1,2,3] : (panels.length ? panels : [null, null, null, null])).map((p, i) => (
                  <div key={i} className="aspect-[3/4] rounded-lg overflow-hidden bg-black/30 border border-border/60">
                    {pendingTurnaround ? (
                      <Skeleton className="h-full w-full" />
                    ) : p?.asset ? (
                      <img src={p.asset.data_url} alt={p.label} className="h-full w-full object-cover" />
                    ) : p?.error ? (
                      <div className="h-full grid place-items-center text-[10px] text-destructive p-2 text-center">Failed</div>
                    ) : (
                      <div className="h-full grid place-items-center text-[10px] text-muted-foreground">Empty</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground">
              Tip: Use the concept as a reference to keep the turnaround consistent, then feed the front sheet into an
              image-to-3D workflow of your choice (Meshy, Tripo, Hunyuan3D). Import the resulting mesh as a VRM to continue in Studio.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

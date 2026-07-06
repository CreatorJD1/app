import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudioStore } from "@/store/studioStore";
import { applyTextureToMaterial } from "@/lib/vrmLoader";
import { api } from "@/lib/api";

export const MaterialsPanel = () => {
  const availableMaterials = useStudioStore((s) => s.availableMaterials);
  const setTextureLabOpen = useStudioStore((s) => s.setTextureLabOpen);
  const materialAssignments = useStudioStore((s) => s.materialAssignments);
  const assignMaterial = useStudioStore((s) => s.assignMaterial);
  const clearAssignment = useStudioStore((s) => s.clearMaterialAssignment);
  const [assets, setAssets] = useState([]);
  const [selected, setSelected] = useState({}); // materialName -> assetId

  const loadAssets = async () => {
    try {
      const { assets } = await api.listAssets({ kind: "texture" });
      setAssets(assets || []);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    loadAssets();
    const unsub = useStudioStore.subscribe((s, prev) => {
      // when a new asset added, refresh
      if (s.recentAssets.length !== prev.recentAssets.length) loadAssets();
    });
    return () => unsub();
  }, []);

  const applyToSlot = async (matName) => {
    const assetId = selected[matName];
    if (!assetId) {
      toast.error("Pick a texture first");
      return;
    }
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    // Access three vrm via a global exposed on window? We stored vrm in stateRef inside VRMViewer.
    const vrm = window.__vcs_vrm;
    if (!vrm) {
      toast.error("No VRM loaded");
      return;
    }
    try {
      const count = await applyTextureToMaterial(vrm, matName, asset.data_url);
      if (count === 0) {
        toast.warning("No material was updated", {
          description: "The selected slot could not be found on the model",
        });
      } else {
        assignMaterial(matName, asset);
        toast.success(`Applied to ${matName}`, {
          description: `${count} material(s) updated`,
        });
      }
    } catch (e) {
      toast.error("Failed to apply texture", { description: String(e?.message || e) });
    }
  };

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
              Load a VRM to see its material slots. Generated textures can be applied to any slot.
            </div>
          )}
          {availableMaterials.map((m) => {
            const assigned = materialAssignments[m.name];
            return (
              <div key={m.uuid} className="rounded-lg border border-border/60 p-2" data-testid={`material-slot-${m.name}`}>
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
                    <div className="font-mono text-[10px] text-muted-foreground truncate">{m.uuid.slice(0, 8)}</div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                  <Select
                    value={selected[m.name] || ""}
                    onValueChange={(v) => setSelected((s) => ({ ...s, [m.name]: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs" data-testid={`material-select-${m.name}`}>
                      <SelectValue placeholder={assets.length ? "Choose texture..." : "No textures yet"} />
                    </SelectTrigger>
                    <SelectContent>
                      {assets.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {(a.subkind || "texture") + " · " + (a.prompt || "").slice(0, 40)}
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
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

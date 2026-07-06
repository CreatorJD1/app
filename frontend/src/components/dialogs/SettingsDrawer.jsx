import { useStudioStore } from "@/store/studioStore";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Layers } from "lucide-react";

export const SettingsDrawer = () => {
  const open = useStudioStore((s) => s.isSettingsOpen);
  const setOpen = useStudioStore((s) => s.setSettingsOpen);
  const lightingPreset = useStudioStore((s) => s.lightingPreset);
  const setLightingPreset = useStudioStore((s) => s.setLightingPreset);
  const background = useStudioStore((s) => s.background);
  const setBackground = useStudioStore((s) => s.setBackground);
  const backgroundColor = useStudioStore((s) => s.backgroundColor);
  const setBackgroundColor = useStudioStore((s) => s.setBackgroundColor);
  const subdivisionLevel = useStudioStore((s) => s.subdivisionLevel);
  const setSubdivisionLevel = useStudioStore((s) => s.setSubdivisionLevel);
  const requestSubdivideApply = useStudioStore((s) => s.requestSubdivideApply);

  const applySub = () => {
    if (!window.__vcs_vrm) return toast.error("Load a VRM first");
    requestSubdivideApply();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-[400px] overflow-y-auto" data-testid="settings-drawer">
        <SheetHeader>
          <SheetTitle>Studio Settings</SheetTitle>
          <SheetDescription>Lighting, background, HQ subdivision, VRoid Hub setup.</SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-4">
          <div>
            <Label className="text-xs">Lighting preset</Label>
            <Select value={lightingPreset} onValueChange={setLightingPreset}>
              <SelectTrigger className="mt-1" data-testid="settings-lighting-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="studio">Studio</SelectItem>
                <SelectItem value="soft">Soft Diffuse</SelectItem>
                <SelectItem value="rim">Neon Rim</SelectItem>
                <SelectItem value="sunset">Sunset</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Background</Label>
            <Select value={background} onValueChange={setBackground}>
              <SelectTrigger className="mt-1" data-testid="settings-background-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gradient">Gradient</SelectItem>
                <SelectItem value="color">Solid Color</SelectItem>
                <SelectItem value="transparent">Transparent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {background === "color" && (
            <div>
              <Label className="text-xs">Background color</Label>
              <Input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="h-10 mt-1" data-testid="settings-background-color" />
            </div>
          )}

          <div className="pt-4 border-t border-border/60">
            <div className="flex items-center gap-2 mb-1">
              <Layers size={14} className="text-primary" />
              <div className="text-sm font-semibold">HQ Poly Subdivision</div>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">
              Loop subdivision smooths mesh edges for a higher-poly look. Skinned meshes may distort at higher levels; 1 level is usually safe.
            </p>
            <Select value={String(subdivisionLevel)} onValueChange={(v) => setSubdivisionLevel(parseInt(v, 10))}>
              <SelectTrigger className="mt-1" data-testid="settings-subdivision-select"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Off</SelectItem>
                <SelectItem value="1">1 iteration (~4x tris)</SelectItem>
                <SelectItem value="2">2 iterations (~16x tris)</SelectItem>
              </SelectContent>
            </Select>
            <Button data-testid="settings-subdivision-apply" className="w-full mt-2" onClick={applySub}>
              Apply Subdivision
            </Button>
          </div>

          <div className="pt-4 border-t border-border/60 text-[11px] text-muted-foreground">
            <div className="font-mono mb-1">VRoid Hub / SDK</div>
            <p>The official VRoid SDK is a Unity C# package — it cannot run inside a browser. Use the <b>URL Import</b> in the tool rail (Globe icon) to paste any public *.vroid.com or hub.vroid.com .vrm URL.</p>
            <p className="mt-1">Full private-library OAuth needs a VRoid Hub OAuth app registered at <span className="font-mono">hub.vroid.com/oauth/applications</span>. Contact your deployer to wire the callback.</p>
          </div>

          <div className="pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
            <div className="mb-1 font-mono">Keyboard shortcuts</div>
            <ul className="space-y-1">
              <li><kbd className="font-mono">A</kbd> — Character Analyzer</li>
              <li><kbd className="font-mono">G</kbd> — Texture Lab</li>
              <li><kbd className="font-mono">R</kbd> — Reference Studio</li>
              <li><kbd className="font-mono">P</kbd> — Projects</li>
              <li><kbd className="font-mono">S</kbd> — Screenshot</li>
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

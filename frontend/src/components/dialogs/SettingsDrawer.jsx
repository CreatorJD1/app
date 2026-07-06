import { useStudioStore } from "@/store/studioStore";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const SettingsDrawer = () => {
  const open = useStudioStore((s) => s.isSettingsOpen);
  const setOpen = useStudioStore((s) => s.setSettingsOpen);
  const lightingPreset = useStudioStore((s) => s.lightingPreset);
  const setLightingPreset = useStudioStore((s) => s.setLightingPreset);
  const background = useStudioStore((s) => s.background);
  const setBackground = useStudioStore((s) => s.setBackground);
  const backgroundColor = useStudioStore((s) => s.backgroundColor);
  const setBackgroundColor = useStudioStore((s) => s.setBackgroundColor);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-[380px]" data-testid="settings-drawer">
        <SheetHeader>
          <SheetTitle>Studio Settings</SheetTitle>
          <SheetDescription>Lighting, background, and performance options.</SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-4">
          <div>
            <Label className="text-xs">Lighting preset</Label>
            <Select value={lightingPreset} onValueChange={setLightingPreset}>
              <SelectTrigger className="mt-1" data-testid="settings-lighting-select">
                <SelectValue />
              </SelectTrigger>
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
              <SelectTrigger className="mt-1" data-testid="settings-background-select">
                <SelectValue />
              </SelectTrigger>
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
              <Input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="h-10 mt-1"
                data-testid="settings-background-color"
              />
            </div>
          )}

          <div className="pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
            <div className="mb-1 font-mono">Keyboard shortcuts</div>
            <ul className="space-y-1">
              <li><kbd className="font-mono">I</kbd> — Import VRM</li>
              <li><kbd className="font-mono">G</kbd> — Texture Lab</li>
              <li><kbd className="font-mono">R</kbd> — Reference Studio</li>
              <li><kbd className="font-mono">S</kbd> — Screenshot</li>
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

import { useRef } from "react";
import {
  Camera,
  Sun,
  Image as ImageIcon,
  Focus,
  RotateCcw,
  Sparkles,
  Video,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudioStore } from "@/store/studioStore";
import { toast } from "sonner";

const HudButton = ({ children, label, testId, onClick, active }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          data-testid={testId}
          onClick={onClick}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/40 backdrop-blur hover:bg-black/60 transition-colors ${
            active ? "text-primary shadow-[0_0_0_1px_rgba(47,230,208,0.4)]" : "text-foreground"
          }`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const ViewportHUD = () => {
  const requestScreenshot = useStudioStore((s) => s.requestScreenshot);
  const project = useStudioStore((s) => s.project);
  const vrmFilename = useStudioStore((s) => s.vrmFilename);
  const lightingPreset = useStudioStore((s) => s.lightingPreset);
  const setLightingPreset = useStudioStore((s) => s.setLightingPreset);
  const background = useStudioStore((s) => s.background);
  const setBackground = useStudioStore((s) => s.setBackground);

  const cameraTargetRef = useRef(null);

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Top HUD */}
      <div className="absolute top-3 left-3 pointer-events-auto">
        <div className="inline-flex items-center gap-2 rounded-full bg-black/40 backdrop-blur px-3 py-1.5 border border-white/10 text-xs">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-mono">
            {project?.name || "Untitled"} · {vrmFilename || "no vrm"}
          </span>
        </div>
      </div>

      {/* Right stack - camera / lighting */}
      <div className="absolute top-3 right-3 pointer-events-auto flex flex-col gap-2">
        <div className="rounded-xl bg-black/40 backdrop-blur border border-white/10 p-2 flex flex-col gap-2">
          <HudButton
            label="Frame character (F)"
            testId="viewport-frame-button"
            onClick={() => toast.info("Use mouse drag to orbit, wheel to zoom")}
          >
            <Focus size={16} />
          </HudButton>
          <HudButton
            label="Reset camera"
            testId="viewport-reset-camera"
            onClick={() => {
              // Trigger a rerender by dispatching a fake resize event; simpler: reload
              window.dispatchEvent(new Event("resize"));
            }}
          >
            <RotateCcw size={16} />
          </HudButton>
        </div>

        <div className="rounded-xl bg-black/40 backdrop-blur border border-white/10 p-2 flex flex-col gap-2 min-w-[168px]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-1">
            Lighting
          </div>
          <Select value={lightingPreset} onValueChange={setLightingPreset}>
            <SelectTrigger
              className="h-8 text-xs bg-black/30"
              data-testid="viewport-lighting-select"
            >
              <div className="flex items-center gap-2">
                <Sun size={12} />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="studio">Studio</SelectItem>
              <SelectItem value="soft">Soft Diffuse</SelectItem>
              <SelectItem value="rim">Neon Rim</SelectItem>
              <SelectItem value="sunset">Sunset</SelectItem>
            </SelectContent>
          </Select>

          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-1 mt-1">
            Background
          </div>
          <Select value={background} onValueChange={setBackground}>
            <SelectTrigger
              className="h-8 text-xs bg-black/30"
              data-testid="viewport-background-select"
            >
              <div className="flex items-center gap-2">
                <ImageIcon size={12} />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gradient">Gradient</SelectItem>
              <SelectItem value="color">Solid</SelectItem>
              <SelectItem value="transparent">Transparent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bottom capture */}
      <div className="absolute bottom-3 right-3 pointer-events-auto">
        <div className="rounded-xl bg-black/40 backdrop-blur border border-white/10 p-2 flex items-center gap-2">
          <HudButton
            label="Screenshot (S)"
            testId="viewport-screenshot-button"
            onClick={requestScreenshot}
          >
            <Camera size={16} />
          </HudButton>
          <HudButton
            label="Record (coming soon)"
            testId="viewport-record-button"
            onClick={() => toast.info("Recording is coming in a later update")}
          >
            <Video size={16} />
          </HudButton>
        </div>
      </div>
    </div>
  );
};

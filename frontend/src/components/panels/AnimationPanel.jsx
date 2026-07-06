import { useStudioStore } from "@/store/studioStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CLIP_NAMES } from "@/lib/vrmAnimations";

const PRESETS = [
  { id: "idle", label: "Idle", desc: "Breathing + subtle head sway" },
  { id: "wave", label: "Wave", desc: "Right-hand friendly wave" },
  { id: "dance", label: "Dance", desc: "Rhythmic beat sway" },
  { id: "walk", label: "Walk", desc: "Alternating legs, arms swing" },
  { id: "sit", label: "Sit", desc: "Seated pose (approx.)" },
  { id: "none", label: "T-Pose", desc: "Neutral rest position" },
];

export const AnimationPanel = () => {
  const clip = useStudioStore((s) => s.animationClip);
  const setClip = useStudioStore((s) => s.setAnimationClip);
  const speed = useStudioStore((s) => s.animationSpeed);
  const setSpeed = useStudioStore((s) => s.setAnimationSpeed);
  const autoBlink = useStudioStore((s) => s.autoBlink);
  const setAutoBlink = useStudioStore((s) => s.setAutoBlink);
  const lookAtMouse = useStudioStore((s) => s.lookAtMouse);
  const setLookAtMouse = useStudioStore((s) => s.setLookAtMouse);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold tracking-wide">Animation Clip</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                data-testid={`animation-clip-${p.id}`}
                onClick={() => setClip(p.id)}
                className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                  clip === p.id
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/70 hover:bg-white/5"
                }`}
              >
                <div className="text-xs font-semibold">{p.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</div>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Speed</Label>
              <span className="font-mono text-xs">{speed.toFixed(2)}x</span>
            </div>
            <Slider
              data-testid="animation-speed-slider"
              value={[speed]}
              min={0}
              max={2.5}
              step={0.05}
              onValueChange={([v]) => setSpeed(v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold tracking-wide">Runtime Behaviors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Auto-blink</div>
              <div className="text-[10px] text-muted-foreground">Automatic natural blink cycle</div>
            </div>
            <Switch
              data-testid="toggle-auto-blink"
              checked={autoBlink}
              onCheckedChange={setAutoBlink}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Look at mouse</div>
              <div className="text-[10px] text-muted-foreground">Head + eyes track pointer</div>
            </div>
            <Switch
              data-testid="toggle-look-at-mouse"
              checked={lookAtMouse}
              onCheckedChange={setLookAtMouse}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

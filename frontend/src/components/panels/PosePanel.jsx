import { useStudioStore } from "@/store/studioStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { POSE_LIMITS, getLimit, isAtLimit, clampBoneAxis } from "@/lib/poseSafety";
import { ShieldCheck } from "lucide-react";

const BONES = [
  "head", "neck", "chest", "spine",
  "leftUpperArm", "rightUpperArm",
  "leftLowerArm", "rightLowerArm",
  "leftHand", "rightHand",
  "leftUpperLeg", "rightUpperLeg",
  "leftLowerLeg", "rightLowerLeg",
];
const AXES = [
  { id: "x", label: "Pitch" },
  { id: "y", label: "Yaw" },
  { id: "z", label: "Roll" },
];

export const PosePanel = () => {
  const boneOffsets = useStudioStore((s) => s.boneOffsets);
  const setBoneOffset = useStudioStore((s) => s.setBoneOffset);
  const resetBones = useStudioStore((s) => s.resetBoneOffsets);
  const safety = useStudioStore((s) => s.poseSafetyEnabled);
  const setSafety = useStudioStore((s) => s.setPoseSafetyEnabled);

  const setValue = (bone, axis, v) => {
    const clamped = safety ? clampBoneAxis(bone, axis, v) : v;
    setBoneOffset(bone, axis, clamped);
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold tracking-wide">Pose Editor</CardTitle>
          <Button data-testid="pose-reset-button" variant="ghost" size="sm" onClick={resetBones} className="h-7 text-xs">Reset</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border/70 p-2">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className={safety ? "text-primary" : "text-muted-foreground"} />
              <div>
                <div className="text-xs font-medium">Anatomy Safety</div>
                <div className="text-[10px] text-muted-foreground">Clamp rotations to plausible ranges</div>
              </div>
            </div>
            <Switch data-testid="pose-safety-toggle" checked={safety} onCheckedChange={setSafety} />
          </div>

          <div className="text-[11px] text-muted-foreground">
            Additive rotations on top of the clip. {safety ? "Sliders are limited to natural ranges." : "Unlocked — extreme poses are possible."}
          </div>

          {BONES.map((bone) => (
            <div key={bone} className="space-y-1.5" data-testid={`pose-bone-${bone}`}>
              <div className="text-xs font-semibold capitalize">{bone}</div>
              {AXES.map((ax) => {
                const v = boneOffsets[bone]?.[ax.id] ?? 0;
                const lim = getLimit(bone, ax.id);
                const min = safety ? lim.min : -Math.PI;
                const max = safety ? lim.max : Math.PI;
                const limit = safety && isAtLimit(bone, ax.id, v);
                return (
                  <div key={ax.id} className="grid grid-cols-[70px_1fr_50px] items-center gap-2">
                    <div className="text-[10px] text-muted-foreground">{ax.label}</div>
                    <Slider
                      data-testid={`bone-slider-${bone}-${ax.id}`}
                      value={[v]}
                      min={min}
                      max={max}
                      step={0.01}
                      onValueChange={([nv]) => setValue(bone, ax.id, nv)}
                    />
                    <div className={`font-mono text-[10px] text-right ${limit ? "text-primary" : ""}`}>
                      {v.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

import { useState } from "react";
import { useStudioStore } from "@/store/studioStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { POSE_LIMITS, getLimit, isAtLimit, clampBoneAxis } from "@/lib/poseSafety";
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";

// Categories of pose adjustments — groups bones by anatomical region
const CATEGORIES = [
  { id: "head", label: "Head & Neck", bones: ["head", "neck"] },
  { id: "torso", label: "Torso & Hips", bones: ["chest", "spine", "hips"] },
  { id: "leftArm", label: "Left Arm", bones: ["leftUpperArm", "leftLowerArm", "leftHand"] },
  { id: "rightArm", label: "Right Arm", bones: ["rightUpperArm", "rightLowerArm", "rightHand"] },
  { id: "leftLeg", label: "Left Leg", bones: ["leftUpperLeg", "leftLowerLeg"] },
  { id: "rightLeg", label: "Right Leg", bones: ["rightUpperLeg", "rightLowerLeg"] },
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

  const [openCats, setOpenCats] = useState({ head: true, torso: false, leftArm: false, rightArm: false, leftLeg: false, rightLeg: false });

  const setValue = (bone, axis, v) => {
    const clamped = safety ? clampBoneAxis(bone, axis, v) : v;
    setBoneOffset(bone, axis, clamped);
  };

  const toggleCat = (id) => setOpenCats((s) => ({ ...s, [id]: !s[id] }));
  const resetCategory = (bones) => {
    bones.forEach((b) => {
      setBoneOffset(b, "x", 0);
      setBoneOffset(b, "y", 0);
      setBoneOffset(b, "z", 0);
    });
  };

  const catHasEdits = (bones) => bones.some((b) => {
    const o = boneOffsets[b];
    return o && (Math.abs(o.x || 0) > 0.001 || Math.abs(o.y || 0) > 0.001 || Math.abs(o.z || 0) > 0.001);
  });

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold tracking-wide">Pose Editor</CardTitle>
          <Button data-testid="pose-reset-button" variant="ghost" size="sm" onClick={resetBones} className="h-7 text-xs">Reset All</Button>
        </CardHeader>
        <CardContent className="space-y-3">
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

          {CATEGORIES.map((cat) => {
            const isOpen = !!openCats[cat.id];
            const hasEdits = catHasEdits(cat.bones);
            return (
              <div key={cat.id} className="rounded-lg border border-border/60" data-testid={`pose-cat-${cat.id}`}>
                <button
                  data-testid={`pose-cat-toggle-${cat.id}`}
                  onClick={() => toggleCat(cat.id)}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <span className="text-xs font-semibold">{cat.label}</span>
                    {hasEdits && <span className="text-[9px] font-mono text-primary bg-primary/10 border border-primary/40 rounded px-1">edited</span>}
                  </div>
                  {hasEdits && (
                    <button
                      className="text-[10px] text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); resetCategory(cat.bones); }}
                      data-testid={`pose-cat-reset-${cat.id}`}
                    >
                      reset
                    </button>
                  )}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-3 border-t border-border/60">
                    {cat.bones.map((bone) => (
                      <div key={bone} className="space-y-1.5 pt-2" data-testid={`pose-bone-${bone}`}>
                        <div className="text-[11px] font-medium text-muted-foreground capitalize">{bone.replace(/([A-Z])/g, " $1").trim()}</div>
                        {AXES.map((ax) => {
                          const v = boneOffsets[bone]?.[ax.id] ?? 0;
                          const lim = getLimit(bone, ax.id);
                          const min = safety ? lim.min : -Math.PI;
                          const max = safety ? lim.max : Math.PI;
                          const limit = safety && isAtLimit(bone, ax.id, v);
                          return (
                            <div key={ax.id} className="grid grid-cols-[60px_1fr_44px] items-center gap-2">
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
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

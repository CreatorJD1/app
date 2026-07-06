import { useStudioStore } from "@/store/studioStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const BONES = [
  "head",
  "neck",
  "chest",
  "spine",
  "leftUpperArm",
  "rightUpperArm",
  "leftLowerArm",
  "rightLowerArm",
  "leftHand",
  "rightHand",
];

const AXES = [
  { id: "x", label: "Pitch (X)" },
  { id: "y", label: "Yaw (Y)" },
  { id: "z", label: "Roll (Z)" },
];

export const PosePanel = () => {
  const boneOffsets = useStudioStore((s) => s.boneOffsets);
  const setBoneOffset = useStudioStore((s) => s.setBoneOffset);
  const resetBones = useStudioStore((s) => s.resetBoneOffsets);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold tracking-wide">Pose Editor</CardTitle>
          <Button
            data-testid="pose-reset-button"
            variant="ghost"
            size="sm"
            onClick={resetBones}
            className="h-7 text-xs"
          >
            Reset
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-[11px] text-muted-foreground">
            Additive rotations applied on top of the current clip. Values are radians ({"−π..π"}).
          </div>
          {BONES.map((bone) => (
            <div key={bone} className="space-y-1.5">
              <div className="text-xs font-semibold capitalize">{bone}</div>
              {AXES.map((ax) => {
                const v = boneOffsets[bone]?.[ax.id] ?? 0;
                return (
                  <div key={ax.id} className="grid grid-cols-[80px_1fr_44px] items-center gap-2">
                    <div className="text-[10px] text-muted-foreground">{ax.label}</div>
                    <Slider
                      data-testid={`bone-slider-${bone}-${ax.id}`}
                      value={[v]}
                      min={-Math.PI}
                      max={Math.PI}
                      step={0.01}
                      onValueChange={([nv]) => setBoneOffset(bone, ax.id, nv)}
                    />
                    <div className="font-mono text-[10px] text-right">{v.toFixed(2)}</div>
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

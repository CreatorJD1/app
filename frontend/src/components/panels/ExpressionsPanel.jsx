import { useState } from "react";
import { toast } from "sonner";
import { Save, Trash2, Smile } from "lucide-react";
import { useStudioStore } from "@/store/studioStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_EXPRESSIONS = [
  "happy", "angry", "sad", "relaxed", "surprised", "neutral",
  "blink", "blinkLeft", "blinkRight",
  "aa", "ih", "ou", "ee", "oh",
];

// Built-in one-tap face looks — sensible blendshape blends. Apply-only.
const QUICK_LOOKS = [
  { name: "Smile", set: { happy: 0.85 } },
  { name: "Beaming", set: { happy: 1.0, aa: 0.2 } },
  { name: "Wink", set: { happy: 0.6, blinkLeft: 1.0 } },
  { name: "Surprised", set: { surprised: 0.9, oh: 0.45 } },
  { name: "Pout", set: { angry: 0.3, ou: 0.55 } },
  { name: "Sad", set: { sad: 0.8 } },
  { name: "Sleepy", set: { relaxed: 0.7, blink: 0.5 } },
  { name: "Neutral", set: {} },
];

export const ExpressionsPanel = () => {
  const availableExpressions = useStudioStore((s) => s.availableExpressions);
  const expressions = useStudioStore((s) => s.expressions);
  const setExpression = useStudioStore((s) => s.setExpression);
  const resetExpressions = useStudioStore((s) => s.resetExpressions);
  const applyExpressionSet = useStudioStore((s) => s.applyExpressionSet);
  const expressionPresets = useStudioStore((s) => s.expressionPresets);
  const saveExpressionPreset = useStudioStore((s) => s.saveExpressionPreset);
  const applyExpressionPreset = useStudioStore((s) => s.applyExpressionPreset);
  const deleteExpressionPreset = useStudioStore((s) => s.deleteExpressionPreset);

  const [presetName, setPresetName] = useState("");

  const names = availableExpressions?.length ? availableExpressions : DEFAULT_EXPRESSIONS;
  const hasActive = Object.values(expressions).some((v) => v > 0);

  const doSave = () => {
    if (!hasActive) return toast.error("Set some expressions first");
    saveExpressionPreset(presetName);
    toast.success(`Saved look · ${presetName.trim() || "unnamed"}`);
    setPresetName("");
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold tracking-wide">Face Looks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5" data-testid="quick-looks">
            {QUICK_LOOKS.map((q) => (
              <Button
                key={q.name}
                size="sm"
                variant="secondary"
                className="h-7 text-[11px]"
                data-testid={`quick-look-${q.name}`}
                onClick={() => { applyExpressionSet(q.set); toast.success(`${q.name}`); }}
              >
                <Smile size={11} className="mr-1" /> {q.name}
              </Button>
            ))}
          </div>

          <div className="flex gap-1.5">
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Name this look…"
              className="h-8 text-xs"
              data-testid="preset-name-input"
              onKeyDown={(e) => e.key === "Enter" && doSave()}
            />
            <Button size="sm" className="h-8" onClick={doSave} data-testid="preset-save" title="Save the current expression sliders as a named look">
              <Save size={13} className="mr-1" /> Save
            </Button>
          </div>

          {expressionPresets.length > 0 && (
            <div className="flex flex-wrap gap-1.5" data-testid="saved-presets">
              {expressionPresets.map((p) => (
                <div key={p.id} className="inline-flex items-center rounded-md border border-border/70 overflow-hidden">
                  <button
                    className="px-2 py-1 text-[11px] hover:bg-primary/10 text-foreground"
                    onClick={() => { applyExpressionPreset(p.id); toast.success(`Applied · ${p.name}`); }}
                    data-testid={`preset-apply-${p.name}`}
                    title="Apply this saved look"
                  >
                    {p.name}
                  </button>
                  <button
                    className="px-1.5 py-1 text-muted-foreground hover:text-destructive border-l border-border/70"
                    onClick={() => { deleteExpressionPreset(p.id); toast.info(`Deleted · ${p.name}`); }}
                    data-testid={`preset-delete-${p.name}`}
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold tracking-wide">Expressions</CardTitle>
          <Button
            data-testid="expressions-reset-button"
            variant="ghost"
            size="sm"
            onClick={resetExpressions}
            className="h-7 text-xs"
          >
            Reset
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {names.length === 0 && (
            <div className="text-xs text-muted-foreground">Load a VRM to see expressions.</div>
          )}
          {names.map((name) => {
            const v = expressions[name] ?? 0;
            return (
              <div key={name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs capitalize">{name}</Label>
                  <span className="font-mono text-[10px] text-muted-foreground">{v.toFixed(2)}</span>
                </div>
                <Slider
                  data-testid={`expression-slider-${name}`}
                  value={[v]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={([nv]) => setExpression(name, nv)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

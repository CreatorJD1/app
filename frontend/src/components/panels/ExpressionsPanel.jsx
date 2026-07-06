import { useStudioStore } from "@/store/studioStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const DEFAULT_EXPRESSIONS = [
  "happy", "angry", "sad", "relaxed", "surprised", "neutral",
  "blink", "blinkLeft", "blinkRight",
  "aa", "ih", "ou", "ee", "oh",
];

export const ExpressionsPanel = () => {
  const availableExpressions = useStudioStore((s) => s.availableExpressions);
  const expressions = useStudioStore((s) => s.expressions);
  const setExpression = useStudioStore((s) => s.setExpression);
  const resetExpressions = useStudioStore((s) => s.resetExpressions);

  const names = availableExpressions?.length ? availableExpressions : DEFAULT_EXPRESSIONS;

  return (
    <div className="space-y-3">
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

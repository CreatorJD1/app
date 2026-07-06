import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Play, Square, Trash2, Save, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useStudioStore } from "@/store/studioStore";
import { CLIP_META } from "@/lib/vrmAnimations";

const GROUPS = ["Idle", "Gesture", "Emotion", "Dance", "Locomotion", "Pose", "Custom"];

export const AnimationPanel = () => {
  const clip = useStudioStore((s) => s.animationClip);
  const setClip = useStudioStore((s) => s.setAnimationClip);
  const speed = useStudioStore((s) => s.animationSpeed);
  const setSpeed = useStudioStore((s) => s.setAnimationSpeed);
  const loop = useStudioStore((s) => s.animationLoop);
  const setLoop = useStudioStore((s) => s.setAnimationLoop);
  const duration = useStudioStore((s) => s.animationDuration);
  const setDuration = useStudioStore((s) => s.setAnimationDuration);
  const talkEmotion = useStudioStore((s) => s.talkEmotion);
  const setTalkEmotion = useStudioStore((s) => s.setTalkEmotion);
  const autoBlink = useStudioStore((s) => s.autoBlink);
  const setAutoBlink = useStudioStore((s) => s.setAutoBlink);
  const lookAtMouse = useStudioStore((s) => s.lookAtMouse);
  const setLookAtMouse = useStudioStore((s) => s.setLookAtMouse);
  const customFrames = useStudioStore((s) => s.customFrames);
  const addKeyframe = useStudioStore((s) => s.addKeyframe);
  const removeKeyframe = useStudioStore((s) => s.removeKeyframe);
  const clearKeyframes = useStudioStore((s) => s.clearKeyframes);
  const applyKf = useStudioStore((s) => s.applyKeyframeToScene);

  const [nextTime, setNextTime] = useState(1);

  const record = () => {
    addKeyframe(nextTime);
    setNextTime((t) => +(t + 1).toFixed(2));
    toast.success(`Keyframe added at ${nextTime.toFixed(1)}s`);
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold tracking-wide">Animation Prefabs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {GROUPS.map((g) => {
            const items = CLIP_META.filter((c) => c.group === g);
            if (!items.length) return null;
            return (
              <div key={g}>
                <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">{g}</div>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((p) => (
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
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Speed</Label>
              <span className="font-mono text-xs">{speed.toFixed(2)}x</span>
            </div>
            <Slider data-testid="animation-speed-slider" value={[speed]} min={0} max={2.5} step={0.05} onValueChange={([v]) => setSpeed(v)} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Duration override (0 = clip default)</Label>
              <span className="font-mono text-xs">{duration ? duration.toFixed(1) + "s" : "off"}</span>
            </div>
            <Slider data-testid="animation-duration-slider" value={[duration]} min={0} max={20} step={0.1} onValueChange={([v]) => setDuration(v)} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Loop</div>
              <div className="text-[10px] text-muted-foreground">Off = one-shot (great for Die, Jump)</div>
            </div>
            <Switch data-testid="animation-loop-toggle" checked={loop} onCheckedChange={setLoop} />
          </div>

          {clip === "talking" && (
            <div>
              <Label className="text-xs text-muted-foreground">Talking emotion overlay</Label>
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {["neutral", "happy", "sad", "angry", "surprised", "relaxed"].map((em) => (
                  <button
                    key={em}
                    data-testid={`talk-emotion-${em}`}
                    onClick={() => setTalkEmotion(em)}
                    className={`text-[11px] rounded-md border px-2 py-1 transition-colors ${
                      talkEmotion === em ? "border-primary/60 text-primary bg-primary/10" : "border-border/70"
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          )}
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
              <div className="text-[10px] text-muted-foreground">Natural blink cycle</div>
            </div>
            <Switch data-testid="toggle-auto-blink" checked={autoBlink} onCheckedChange={setAutoBlink} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Look at mouse</div>
              <div className="text-[10px] text-muted-foreground">Head + eyes track pointer</div>
            </div>
            <Switch data-testid="toggle-look-at-mouse" checked={lookAtMouse} onCheckedChange={setLookAtMouse} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold tracking-wide">Procedural Timeline</CardTitle>
          <div className="flex gap-1">
            <Button data-testid="timeline-clear" size="sm" variant="ghost" onClick={clearKeyframes} className="h-7 text-xs" disabled={!customFrames.length}>Clear</Button>
            <Button data-testid="timeline-play" size="sm" className="h-7 text-xs" onClick={() => setClip("custom")} disabled={!customFrames.length}>
              <Play size={12} className="mr-1" /> Play
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-[11px] text-muted-foreground">
            Pose the character (Pose tab + Expressions) then record keyframes. Each is auto-interpolated during playback (loops).
          </div>
          <div className="grid grid-cols-[80px_1fr_auto] items-center gap-2">
            <div className="text-xs text-muted-foreground">Time (s)</div>
            <Slider value={[nextTime]} min={0} max={20} step={0.1} onValueChange={([v]) => setNextTime(v)} />
            <div className="font-mono text-xs w-10 text-right">{nextTime.toFixed(1)}</div>
          </div>
          <Button data-testid="timeline-record" onClick={record} className="w-full">
            <Circle size={12} className="mr-1.5 fill-current text-destructive" /> Record Keyframe
          </Button>

          <div className="pt-2 space-y-1">
            {customFrames.length === 0 && (
              <div className="text-[11px] text-muted-foreground text-center py-2">No keyframes yet.</div>
            )}
            {customFrames.map((k) => (
              <div key={k.id} className="grid grid-cols-[50px_1fr_auto_auto] items-center gap-2 rounded-md border border-border/60 p-1.5" data-testid={`keyframe-${k.id}`}>
                <div className="font-mono text-xs text-primary">{k.time.toFixed(2)}s</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {Object.keys(k.boneOffsets || {}).length} bones · {Object.keys(k.expressions || {}).length} exprs
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => applyKf(k.id)} title="Load into pose">
                  <Save size={12} />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeKeyframe(k.id)} title="Delete">
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

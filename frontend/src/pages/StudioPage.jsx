import { useEffect } from "react";
import { toast } from "sonner";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { VRMViewer } from "@/components/VRMViewer";
import { EmptyViewport } from "@/components/EmptyViewport";
import { ViewportHUD } from "@/components/ViewportHUD";
import { ToolRail } from "@/components/ToolRail";
import { PropertiesPanel } from "@/components/PropertiesPanel";
import { TextureLabDialog } from "@/components/dialogs/TextureLabDialog";
import { ReferenceStudioDialog } from "@/components/dialogs/ReferenceStudioDialog";
import { ProjectsDialog } from "@/components/dialogs/ProjectsDialog";
import { SettingsDrawer } from "@/components/dialogs/SettingsDrawer";
import { CharacterAnalyzerDialog } from "@/components/dialogs/CharacterAnalyzerDialog";
import { useStudioStore } from "@/store/studioStore";

export default function StudioPage() {
  const vrmUrl = useStudioStore((s) => s.vrmUrl);
  const setTextureLabOpen = useStudioStore((s) => s.setTextureLabOpen);
  const setReferenceStudioOpen = useStudioStore((s) => s.setReferenceStudioOpen);
  const setProjectsOpen = useStudioStore((s) => s.setProjectsOpen);
  const setAnalyzerOpen = useStudioStore((s) => s.setAnalyzerOpen);
  const requestScreenshot = useStudioStore((s) => s.requestScreenshot);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (["input", "textarea"].includes(tag) || e.target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "g") setTextureLabOpen(true);
      else if (k === "r") setReferenceStudioOpen(true);
      else if (k === "p") setProjectsOpen(true);
      else if (k === "a") setAnalyzerOpen(true);
      else if (k === "s") requestScreenshot();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTextureLabOpen, setReferenceStudioOpen, setProjectsOpen, setAnalyzerOpen, requestScreenshot]);

  useEffect(() => {
    const t = setTimeout(() => {
      toast("Welcome to VRoid Companion Studio", {
        description: "Import a .vrm or open Character Analyzer (A) to convert reference art → VRoid recipe.",
      });
    }, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="h-screen w-screen bg-background text-foreground overflow-hidden font-body">
      <div className="flex h-full">
        <ToolRail />
        <div className="flex-1 min-w-0">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={72} minSize={40} className="relative">
              <div className="absolute inset-0">
                <VRMViewer />
                {!vrmUrl && <EmptyViewport />}
                <ViewportHUD />
                <BgAmbient />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={28} minSize={22} maxSize={40}>
              <PropertiesPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      <TextureLabDialog />
      <ReferenceStudioDialog />
      <ProjectsDialog />
      <CharacterAnalyzerDialog />
      <SettingsDrawer />
    </div>
  );
}

const BgAmbient = () => (
  <div
    className="pointer-events-none absolute inset-0 -z-10"
    style={{
      background:
        "radial-gradient(900px circle at 20% 10%, rgba(47,230,208,0.10), transparent 55%), radial-gradient(700px circle at 85% 20%, rgba(255,138,122,0.06), transparent 60%)",
    }}
  />
);

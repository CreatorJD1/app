import {
  FolderOpen,
  Sparkles,
  Wand2,
  Boxes,
  Settings2,
  Upload,
} from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useStudioStore } from "@/store/studioStore";
import { api } from "@/lib/api";

const RailButton = ({ icon: Icon, label, active, onClick, testId }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          data-testid={testId}
          onClick={onClick}
          className={`group relative h-11 w-11 rounded-lg flex items-center justify-center transition-colors ${
            active
              ? "bg-primary/15 text-primary shadow-[0_0_0_1px_rgba(47,230,208,0.4)]"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          <Icon size={18} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const ToolRail = () => {
  const setTextureLabOpen = useStudioStore((s) => s.setTextureLabOpen);
  const setReferenceStudioOpen = useStudioStore((s) => s.setReferenceStudioOpen);
  const setProjectsOpen = useStudioStore((s) => s.setProjectsOpen);
  const setSettingsOpen = useStudioStore((s) => s.setSettingsOpen);
  const project = useStudioStore((s) => s.project);
  const setProject = useStudioStore((s) => s.setProject);
  const setVrm = useStudioStore((s) => s.setVrm);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".vrm")) {
      toast.error("Please choose a .vrm file");
      return;
    }
    try {
      let proj = project;
      if (!proj) {
        proj = await api.createProject(file.name.replace(/\.vrm$/i, ""));
        setProject(proj);
      }
      toast.info("Uploading VRM...", { description: file.name });
      await api.uploadVrm(proj.id, file);
      const blobUrl = URL.createObjectURL(file);
      setVrm(blobUrl, file.name);
    } catch (e) {
      toast.error("Upload failed", { description: String(e?.message || e) });
    }
  };

  return (
    <aside className="w-14 shrink-0 flex flex-col items-center py-3 gap-2 bg-[color:hsl(214_33%_7%)]/70 border-r border-border/70">
      <div className="h-10 w-10 rounded-xl grid place-items-center bg-gradient-to-br from-primary/40 to-primary/10 border border-primary/40 shadow-[0_0_0_1px_rgba(47,230,208,0.25)]">
        <div className="text-[10px] font-display font-bold tracking-widest text-primary">VCS</div>
      </div>
      <div className="h-px w-8 bg-border/60 my-1" />

      <RailButton
        icon={Upload}
        label="Import VRM (I)"
        testId="rail-import-vrm"
        onClick={() => fileRef.current?.click()}
      />
      <input
        ref={fileRef}
        data-testid="rail-vrm-file-input"
        type="file"
        accept=".vrm,.glb,application/octet-stream,model/gltf-binary"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <RailButton
        icon={Sparkles}
        label="Texture Lab (G)"
        testId="rail-open-texture-lab"
        onClick={() => setTextureLabOpen(true)}
      />
      <RailButton
        icon={Wand2}
        label="Reference Studio"
        testId="rail-open-reference-studio"
        onClick={() => setReferenceStudioOpen(true)}
      />
      <RailButton
        icon={FolderOpen}
        label="Projects"
        testId="rail-open-projects"
        onClick={() => setProjectsOpen(true)}
      />

      <div className="mt-auto" />
      <RailButton
        icon={Settings2}
        label="Settings"
        testId="rail-open-settings"
        onClick={() => setSettingsOpen(true)}
      />
    </aside>
  );
};

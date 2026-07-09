import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/store/studioStore";
import { api } from "@/lib/api";

export const EmptyViewport = () => {
  const inputRef = useRef(null);
  const project = useStudioStore((s) => s.project);
  const setProject = useStudioStore((s) => s.setProject);
  const setVrm = useStudioStore((s) => s.setVrm);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".vrm")) {
      toast.error("Please choose a .vrm file");
      return;
    }
    // Render immediately from a local blob URL so the studio works with or
    // without the backend (Claude Code local port: the viewer/animations/pose/
    // expression editors are all client-side). Backend persistence — creating a
    // project and uploading the VRM — is best-effort and never blocks rendering.
    const blobUrl = URL.createObjectURL(file);
    setVrm(blobUrl, file.name);
    try {
      let proj = project;
      if (!proj) {
        proj = await api.createProject(file.name.replace(/\.vrm$/i, ""));
        setProject(proj);
      }
      await api.uploadVrm(proj.id, file);
    } catch (e) {
      // No backend running (or DB offline): keep the local render, just note it.
      console.warn("VRM persistence skipped (backend unavailable):", e?.message || e);
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto max-w-md w-full mx-6">
        <div
          className="relative rounded-2xl border border-dashed border-white/20 bg-black/40 backdrop-blur p-8 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            handleFile(f);
          }}
          data-testid="studio-empty-dropzone"
        >
          <div className="absolute inset-x-6 top-6 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-pulse" />
          <div className="text-3xl font-display font-semibold tracking-tight">
            Drop a <span className="text-primary">.vrm</span> to begin
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Load your VRoid character to preview animations, tweak expressions, and generate anime textures.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button
              data-testid="studio-import-vrm-button"
              onClick={() => inputRef.current?.click()}
            >
              Import VRM
            </Button>
            <a
              href="https://vroid.com/en/studio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              Get VRoid Studio
            </a>
          </div>
          <input
            ref={inputRef}
            data-testid="studio-vrm-file-input"
            type="file"
            accept=".vrm,.glb,application/octet-stream,model/gltf-binary"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <div className="mt-6 text-xs text-muted-foreground">Tip: you can also drag &amp; drop the file here.</div>
        </div>
      </div>
    </div>
  );
};

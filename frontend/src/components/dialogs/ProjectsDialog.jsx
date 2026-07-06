import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, FolderOpen, Boxes } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStudioStore } from "@/store/studioStore";
import { api } from "@/lib/api";

export const ProjectsDialog = () => {
  const open = useStudioStore((s) => s.isProjectsOpen);
  const setOpen = useStudioStore((s) => s.setProjectsOpen);
  const project = useStudioStore((s) => s.project);
  const setProject = useStudioStore((s) => s.setProject);
  const setVrm = useStudioStore((s) => s.setVrm);
  const clearVrm = useStudioStore((s) => s.clearVrm);

  const [projects, setProjects] = useState([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { projects } = await api.listProjects();
      setProjects(projects || []);
    } catch (e) {
      // ignore
    }
  };
  useEffect(() => { if (open) load(); }, [open]);

  const create = async () => {
    if (!name.trim()) return toast.error("Enter a project name");
    setBusy(true);
    try {
      const p = await api.createProject(name.trim());
      setProjects((ps) => [p, ...ps]);
      setProject(p);
      clearVrm();
      setName("");
      toast.success("Project created");
    } catch (e) {
      toast.error("Failed");
    } finally { setBusy(false); }
  };

  const openProject = async (p) => {
    setProject(p);
    if (p.vrm_path) {
      // Load via backend URL
      setVrm(api.vrmUrl(p.id), p.vrm_filename);
    } else {
      clearVrm();
    }
    setOpen(false);
    toast.success(`Opened \"${p.name}\"`);
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete \"${p.name}\"? This removes its assets too.`)) return;
    try {
      await api.deleteProject(p.id);
      setProjects((ps) => ps.filter((x) => x.id !== p.id));
      if (project?.id === p.id) {
        setProject(null);
        clearVrm();
      }
      toast.success("Deleted");
    } catch { toast.error("Delete failed"); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl h-[75vh] flex flex-col" data-testid="projects-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen size={18} className="text-primary" /> Projects
          </DialogTitle>
          <DialogDescription>Save and load VRoid character projects with their generated assets.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-2">
          <Input
            data-testid="projects-new-name"
            placeholder="New project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <Button data-testid="projects-new-button" onClick={create} disabled={busy}>
            <Plus size={14} className="mr-1.5" /> Create
          </Button>
        </div>

        <div className="flex-1 overflow-auto" data-testid="projects-grid">
          {projects.length === 0 ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">
              No projects yet. Create one to save your VRM + generated assets.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-border/60 overflow-hidden bg-card/60 group"
                  data-testid={`project-card-${p.id}`}
                >
                  <div className="aspect-[16/10] bg-gradient-to-br from-primary/10 via-transparent to-accent/10 grid place-items-center">
                    {p.thumbnail_data_url ? (
                      <img src={p.thumbnail_data_url} className="h-full w-full object-cover" alt="" />
                    ) : (
                      <Boxes className="text-primary/70" size={40} />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-semibold truncate">{p.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate">{p.vrm_filename || "no vrm"}</div>
                    <div className="mt-2 flex gap-1.5">
                      <Button size="sm" className="h-7 flex-1" onClick={() => openProject(p)} data-testid={`project-open-${p.id}`}>Open</Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(p)} data-testid={`project-delete-${p.id}`}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnimationPanel } from "@/components/panels/AnimationPanel";
import { ExpressionsPanel } from "@/components/panels/ExpressionsPanel";
import { PosePanel } from "@/components/panels/PosePanel";
import { MaterialsPanel } from "@/components/panels/MaterialsPanel";

export const PropertiesPanel = () => {
  return (
    <aside
      className="h-full flex flex-col bg-card/70 backdrop-blur border-l border-border/70"
      data-testid="properties-panel"
    >
      <Tabs defaultValue="animation" className="flex flex-col h-full">
        <TabsList className="m-2 grid grid-cols-4 bg-black/30">
          <TabsTrigger value="animation" data-testid="tab-animation">Anim</TabsTrigger>
          <TabsTrigger value="expressions" data-testid="tab-expressions">Face</TabsTrigger>
          <TabsTrigger value="pose" data-testid="tab-pose">Pose</TabsTrigger>
          <TabsTrigger value="materials" data-testid="tab-materials">Mats</TabsTrigger>
        </TabsList>
        <ScrollArea className="flex-1 px-2 pb-4">
          <TabsContent value="animation" className="mt-0">
            <AnimationPanel />
          </TabsContent>
          <TabsContent value="expressions" className="mt-0">
            <ExpressionsPanel />
          </TabsContent>
          <TabsContent value="pose" className="mt-0">
            <PosePanel />
          </TabsContent>
          <TabsContent value="materials" className="mt-0">
            <MaterialsPanel />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </aside>
  );
};

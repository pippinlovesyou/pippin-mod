import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Plus, GripVertical, Trash2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WarningLevelForm } from "./warning-level-form";

interface RuleFormData {
  name: string;
  description: string;
  isVisible?: boolean;
}

function RuleForm({
  initialData,
  onSubmit,
  title,
}: {
  initialData: RuleFormData;
  onSubmit: (data: RuleFormData) => void;
  title: string;
}) {
  const [formData, setFormData] = useState<RuleFormData>({
    ...initialData,
    isVisible: initialData.isVisible ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.description) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="name" className="text-sm">Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          placeholder="Rule name"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="description" className="text-sm">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              description: e.target.value,
            }))
          }
          placeholder="Rule description"
          className="h-8 text-sm"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="visible"
          checked={formData.isVisible}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, isVisible: checked }))
          }
        />
        <Label htmlFor="visible" className="text-sm">Show warning message</Label>
      </div>

      <Button type="submit" className="w-full h-8 text-sm">
        {title}
      </Button>
    </form>
  );
}

function SortableRule({ rule }: { rule: Rule }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  };

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [isVisible, setIsVisible] = useState(rule.isVisible ?? true);

  const updateMutation = useMutation({
    mutationFn: async (data: RuleFormData) => {
      const response = await fetch(`/api/rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, isVisible }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update rule");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warning-levels"] });
      setEditing(false);
      toast({
        title: "Rule Updated",
        description: "The rule has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/rules/${rule.id}/toggle-visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVisible: !isVisible }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to toggle rule visibility");
      }
      return response.json();
    },
    onSuccess: () => {
      setIsVisible(!isVisible);
      queryClient.invalidateQueries({ queryKey: ["/api/warning-levels"] });
      toast({
        title: "Visibility Updated",
        description: `Rule is now ${!isVisible ? "visible" : "hidden"}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/rules/${rule.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete rule");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warning-levels"] });
      toast({
        title: "Rule Deleted",
        description: "The rule has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border rounded-lg p-3 mb-1.5 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 p-1 hover:bg-accent rounded"
        >
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{rule.name}</h4>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7"
                onClick={() => toggleVisibilityMutation.mutate()}
                title={isVisible ? "Hide warning message" : "Show warning message"}
              >
                {isVisible ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <EyeOff className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7"
                onClick={() => deleteMutation.mutate()}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <p className="text-xs mt-0.5">{rule.description}</p>
        </div>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Rule</DialogTitle>
            <DialogDescription>
              Modify the rule settings and visibility.
            </DialogDescription>
          </DialogHeader>
          <RuleForm
            initialData={{ ...rule, isVisible }}
            onSubmit={(data) => updateMutation.mutate(data)}
            title="Update Rule"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function WarningLevelCard({ level }: { level: WarningLevel }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [_, setLocation] = useLocation();
  const [editing, setEditing] = useState(false);
  const [addingRule, setAddingRule] = useState(false);
  const [showDetails, setShowDetails] = useState(true); // Changed to true by default
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const createMutation = useMutation({
    mutationFn: async (data: RuleFormData) => {
      const response = await fetch(`/api/warning-levels/${level.id}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create rule");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warning-levels"] });
      setAddingRule(false);
      toast({
        title: "Rule Created",
        description: "The new rule has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (rules: { id: number; order: number }[]) => {
      const response = await fetch(
        `/api/warning-levels/${level.id}/rules/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rules }),
        }
      );

      if (!response.ok) throw new Error("Failed to reorder rules");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warning-levels"] });
    },
  });

  const deleteLevelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/warning-levels/${level.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warning-levels"] });
      setEditing(false);
      toast({
        title: "Warning Level Deleted",
        description: "The warning level has been deleted successfully.",
      });
      setLocation("/warning-levels");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = level.rules.findIndex((r) => r.id === active.id);
    const newIndex = level.rules.findIndex((r) => r.id === over.id);

    const newRules = arrayMove(level.rules, oldIndex, newIndex);
    const updates = newRules.map((rule, index) => ({
      id: rule.id,
      order: index,
    }));

    reorderMutation.mutate(updates);
  };

  const emptyRule: RuleFormData = {
    name: "",
    description: "",
  };

  return (
    <Card className="relative">
      <CardHeader
        className="pb-2"
        style={{ borderBottom: `2px solid ${level.color}` }}
      >
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2 text-base">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: level.color }}
            />
            {level.name}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7"
              onClick={() => setShowDetails(!showDetails)}
              title={showDetails ? "Hide details" : "Show details"}
            >
              {showDetails ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </CardTitle>
          <Dialog open={addingRule} onOpenChange={setAddingRule}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add Rule</DialogTitle>
                <DialogDescription>
                  Create a new rule for the {level.name} warning level.
                </DialogDescription>
              </DialogHeader>
              <RuleForm
                initialData={emptyRule}
                onSubmit={createMutation.mutate}
                title="Create Rule"
              />
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-xs text-muted-foreground">
          {level.points} point{level.points !== 1 ? "s" : ""}
          {level.deleteMessage && " • Messages will be deleted"}
        </p>
      </CardHeader>
      {showDetails && (
        <CardContent className="pt-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={level.rules}
              strategy={verticalListSortingStrategy}
            >
              {level.rules.map((rule) => (
                <SortableRule key={rule.id} rule={rule} />
              ))}
            </SortableContext>
          </DndContext>
          {level.rules.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              No rules yet. Click "Add Rule" to create one.
            </p>
          )}
        </CardContent>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Warning Level</DialogTitle>
            <DialogDescription>
              Modify the warning level settings or delete this warning level.
            </DialogDescription>
          </DialogHeader>
          <WarningLevelForm
            initialData={level}
            title="Update Warning Level"
            levelId={level.id}
            onSuccess={() => setEditing(false)}
          />
          <DialogFooter className="mt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Warning Level
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Warning Level</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this warning level? This action cannot be undone.
                    All associated rules will also be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteLevelMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface Rule {
  id: number;
  name: string;
  description: string;
  order: number;
  isVisible?: boolean;
}

interface WarningLevel {
  id: number;
  name: string;
  color: string;
  points: number;
  deleteMessage: boolean;
  description: string;
  rules: Rule[];
}
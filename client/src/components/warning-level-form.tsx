import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface WarningLevelFormData {
  name: string;
  color: string;
  points: number;
  deleteMessage: boolean;
  description: string;
  isVisible?: boolean;
}

interface Props {
  initialData: WarningLevelFormData;
  title: string;
  levelId?: number;
  onSuccess?: () => void;
}

export function WarningLevelForm({ initialData, title, levelId, onSuccess }: Props) {
  const [formData, setFormData] = useState<WarningLevelFormData>({
    ...initialData,
    points: initialData.points || 1,
    isVisible: initialData.isVisible ?? true,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (level: WarningLevelFormData) => {
      try {
        const response = await fetch("/api/warning-levels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(level),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to create warning level");
        }

        return response.json();
      } catch (error) {
        throw error;
      }
    },
    onSuccess: () => {
      onSuccess?.();
      queryClient.invalidateQueries({ queryKey: ["/api/warning-levels"] });
      toast({
        title: "Warning Level Created",
        description: "The new warning level has been added successfully.",
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

  const updateMutation = useMutation({
    mutationFn: async (data: WarningLevelFormData) => {
      try {
        const response = await fetch(`/api/warning-levels/${levelId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to update warning level");
        }

        return response.json();
      } catch (error) {
        throw error;
      }
    },
    onSuccess: () => {
      onSuccess?.();
      queryClient.invalidateQueries({ queryKey: ["/api/warning-levels"] });
      toast({
        title: "Warning Level Updated",
        description: "The warning level has been updated successfully.",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.color || !formData.description) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (levelId) {
        await updateMutation.mutateAsync(formData);
      } else {
        await createMutation.mutateAsync(formData);
      }
    } catch (error) {
      // Error is handled in mutation callbacks
    }
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
          placeholder="e.g., yellow, orange, red"
          className="h-8 text-sm"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="color" className="text-sm">Color</Label>
        <div className="flex gap-2">
          <Input
            id="color"
            type="color"
            value={formData.color}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, color: e.target.value }))
            }
            className="w-12 h-8 p-0"
          />
          <Input
            value={formData.color}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, color: e.target.value }))
            }
            placeholder="#FF0000"
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="points" className="text-sm">Points</Label>
        <Select
          value={formData.points.toString()}
          onValueChange={(value) =>
            setFormData((prev) => ({ ...prev, points: parseInt(value) }))
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select points" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
              <SelectItem
                key={value}
                value={value.toString()}
                className="text-sm"
              >
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2 py-1">
        <Switch
          id="delete-message"
          checked={formData.deleteMessage}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, deleteMessage: checked }))
          }
        />
        <Label htmlFor="delete-message" className="text-sm">Delete violating messages</Label>
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
          placeholder="Describe what triggers this warning level"
          className="h-8 text-sm"
        />
      </div>

      <div className="flex items-center space-x-2 py-1">
        <Switch
          id="warning-visible"
          checked={formData.isVisible}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, isVisible: checked }))
          }
        />
        <Label htmlFor="warning-visible" className="text-sm">Show warning messages</Label>
      </div>

      <Button type="submit" className="w-full h-8 text-sm mt-4">
        {title}
      </Button>
    </form>
  );
}

export type { WarningLevelFormData };
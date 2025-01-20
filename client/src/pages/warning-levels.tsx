import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { WarningLevelCard } from "@/components/warning-level-card";
import { WarningLevelForm } from "@/components/warning-level-form";

interface Rule {
  id: number;
  name: string;
  pattern: string;
  description: string;
  order: number;
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

interface WarningLevelFormData {
  name: string;
  color: string;
  points: number;
  deleteMessage: boolean;
  description: string;
}

export default function WarningLevels() {
  const emptyWarningLevel: WarningLevelFormData = {
    name: "",
    color: "#FF0000",
    points: 1,
    deleteMessage: false,
    description: "",
  };

  const { data: warningLevels } = useQuery<WarningLevel[]>({
    queryKey: ["/api/warning-levels"],
  });

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold">Warning Levels</h1>
      <div className="mt-2 mb-6">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Create Warning Level
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Create Warning Level</DialogTitle>
              <DialogDescription>
                Add a new warning level with custom points and rules.
              </DialogDescription>
            </DialogHeader>
            <WarningLevelForm
              initialData={emptyWarningLevel}
              title="Create Warning Level"
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {warningLevels?.map((level) => (
          <WarningLevelCard key={level.id} level={level} />
        ))}
        {!warningLevels?.length && (
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle className="text-base">No Warning Levels</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-muted-foreground">
                Click the "Create Warning Level" button to add your first warning level.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
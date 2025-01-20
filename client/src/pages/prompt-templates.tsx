import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, History, Plus } from "lucide-react";

interface PromptTemplate {
  id: number;
  name: string;
  systemPrompt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PromptHistory {
  id: number;
  templateId: number;
  systemPrompt: string;
  reason: string;
  createdAt: string;
}

export default function PromptTemplates() {
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(
    null
  );
  const [isCreating, setIsCreating] = useState(false);
  const [showHistory, setShowHistory] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery<PromptTemplate[]>({
    queryKey: ["/api/prompt-templates"],
  });

  const { data: history } = useQuery<PromptHistory[]>({
    queryKey: ["/api/prompt-templates", showHistory, "history"],
    enabled: showHistory !== null,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      systemPrompt: string;
      isActive: boolean;
    }) => {
      const response = await fetch("/api/prompt-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates"] });
      toast({
        title: "Template Created",
        description: "The prompt template has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (data: {
      id: number;
      name: string;
      systemPrompt: string;
      isActive: boolean;
      reason: string;
    }) => {
      const response = await fetch(`/api/prompt-templates/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      setSelectedTemplate(null);
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates"] });
      toast({
        title: "Template Updated",
        description: "The prompt template has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activateTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/prompt-templates/${id}/activate`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates"] });
      toast({
        title: "Template Activated",
        description: "The prompt template is now active.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const systemPrompt = formData.get("systemPrompt") as string;
    const isActive = formData.get("isActive") === "true";
    const reason = formData.get("reason") as string;

    if (!name || !systemPrompt) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (selectedTemplate) {
      updateTemplateMutation.mutate({
        id: selectedTemplate.id,
        name,
        systemPrompt,
        isActive,
        reason,
      });
    } else {
      createTemplateMutation.mutate({
        name,
        systemPrompt,
        isActive,
      });
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">AI Prompt Templates</h1>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Template</DialogTitle>
              <DialogDescription>
                Create a new prompt template for AI moderation.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Enter template name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Textarea
                  id="systemPrompt"
                  name="systemPrompt"
                  placeholder="Enter the system prompt"
                  className="h-64 font-mono"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>
                  <input
                    type="checkbox"
                    name="isActive"
                    value="true"
                    className="mr-2"
                  />
                  Set as active template
                </Label>
              </div>
              <Button type="submit" className="w-full">
                Create Template
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {templates?.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>{template.name}</span>
                <div className="space-x-2">
                  {template.isActive && (
                    <Button variant="outline" size="sm" disabled>
                      <Check className="h-4 w-4 mr-2" />
                      Active
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHistory(template.id)}
                  >
                    <History className="h-4 w-4 mr-2" />
                    History
                  </Button>
                  <Dialog
                    open={selectedTemplate?.id === template.id}
                    onOpenChange={(open) =>
                      setSelectedTemplate(open ? template : null)
                    }
                  >
                    <DialogTrigger asChild>
                      <Button size="sm">Edit</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Edit Template</DialogTitle>
                        <DialogDescription>
                          Update the prompt template configuration.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Template Name</Label>
                          <Input
                            id="name"
                            name="name"
                            defaultValue={template.name}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="systemPrompt">System Prompt</Label>
                          <Textarea
                            id="systemPrompt"
                            name="systemPrompt"
                            defaultValue={template.systemPrompt}
                            className="h-64 font-mono"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="reason">Reason for Change</Label>
                          <Input
                            id="reason"
                            name="reason"
                            placeholder="Why are you updating this template?"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>
                            <input
                              type="checkbox"
                              name="isActive"
                              value="true"
                              defaultChecked={template.isActive}
                              className="mr-2"
                            />
                            Set as active template
                          </Label>
                        </div>
                        <Button type="submit" className="w-full">
                          Update Template
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                  {!template.isActive && (
                    <Button
                      size="sm"
                      onClick={() => activateTemplateMutation.mutate(template.id)}
                      disabled={activateTemplateMutation.isPending}
                    >
                      Set Active
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Accordion
                  type="single"
                  collapsible
                  className="w-full"
                  value={showHistory === template.id ? "history" : undefined}
                  onValueChange={(value) =>
                    setShowHistory(value === "history" ? template.id : null)
                  }
                >
                  <AccordionItem value="prompt">
                    <AccordionTrigger>View Prompt</AccordionTrigger>
                    <AccordionContent>
                      <pre className="p-4 bg-muted rounded-lg overflow-auto">
                        <code>{template.systemPrompt}</code>
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="history">
                    <AccordionTrigger>Version History</AccordionTrigger>
                    <AccordionContent>
                      {history ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Reason</TableHead>
                              <TableHead>Prompt</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {history.map((entry) => (
                              <TableRow key={entry.id}>
                                <TableCell>
                                  {new Date(entry.createdAt).toLocaleString()}
                                </TableCell>
                                <TableCell>{entry.reason}</TableCell>
                                <TableCell className="font-mono">
                                  {entry.systemPrompt.length > 100
                                    ? entry.systemPrompt.slice(0, 100) + "..."
                                    : entry.systemPrompt}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div>Loading history...</div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, RefreshCw, Brain, History } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Copy, FileText } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface DiscordConfig {
  botToken?: string;
  guildId?: string;
  status: "disconnected" | "connected" | "error";
  error?: string;
}

interface OpenAIConfig {
  status: "disconnected" | "connected" | "error";
  error?: string;
}

interface AIPromptTemplate {
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

interface PunishmentRule {
  id: number;
  type: "ban" | "mute";
  pointThreshold: number;
  duration?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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

export default function Settings() {
  const [configuringDiscord, setConfiguringDiscord] = useState(false);
  const [configuringOpenAI, setConfiguringOpenAI] = useState(false);
  const [configuringPrompt, setConfiguringPrompt] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<AIPromptTemplate | null>(null);
  const [showHistory, setShowHistory] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addingPunishmentRule, setAddingPunishmentRule] = useState(false);
  const [selectedPunishmentType, setSelectedPunishmentType] = useState<"ban" | "mute">("mute");

  const { data: discordConfig, isLoading: isLoadingDiscord } = useQuery<DiscordConfig>({
    queryKey: ["/api/settings/discord"],
  });

  const { data: openaiConfig, isLoading: isLoadingOpenAI } = useQuery<OpenAIConfig>({
    queryKey: ["/api/settings/openai"],
  });

  const updateDiscordMutation = useMutation({
    mutationFn: async (config: { botToken: string; guildId: string }) => {
      const response = await fetch("/api/settings/discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      setConfiguringDiscord(false);
      queryClient.invalidateQueries({ queryKey: ["/api/settings/discord"] });
      toast({
        title: "Discord Bot Updated",
        description: "The Discord bot settings have been updated successfully.",
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

  const updateOpenAIMutation = useMutation({
    mutationFn: async (config: { apiKey: string }) => {
      const response = await fetch("/api/settings/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      setConfiguringOpenAI(false);
      queryClient.invalidateQueries({ queryKey: ["/api/settings/openai"] });
      toast({
        title: "OpenAI Settings Updated",
        description: "The OpenAI API settings have been updated successfully.",
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

  const checkDiscordStatusMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/settings/discord/status", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/discord"] });
      toast({
        title: "Status Checked",
        description: "Discord bot connection status has been verified.",
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

  const checkOpenAIStatusMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/settings/openai/status", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/openai"] });
      toast({
        title: "Status Checked",
        description: "OpenAI API connection status has been verified.",
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

  const { data: promptTemplate } = useQuery<AIPromptTemplate>({
    queryKey: ["/api/prompt-templates/active"],
  });

  const { data: promptHistory } = useQuery<PromptHistory[]>({
    queryKey: ["/api/prompt-templates", showHistory, "history"],
    enabled: showHistory !== null,
  });

  const updatePromptMutation = useMutation({
    mutationFn: async (data: {
      id: number;
      name: string;
      systemPrompt: string;
      reason: string;
    }) => {
      const response = await fetch(`/api/prompt-templates/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, isActive: true }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      setConfiguringPrompt(false);
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates"] });
      toast({
        title: "Prompt Template Updated",
        description: "The AI prompt template has been updated successfully.",
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

  const { data: punishmentRules, isLoading: isLoadingPunishmentRules } = useQuery<PunishmentRule[]>({
    queryKey: ["/api/punishment-rules"],
  });

  const createPunishmentRuleMutation = useMutation({
    mutationFn: async (data: {
      type: "ban" | "mute";
      pointThreshold: number;
      duration?: number;
    }) => {
      const response = await fetch("/api/punishment-rules", {
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
      setAddingPunishmentRule(false);
      queryClient.invalidateQueries({ queryKey: ["/api/punishment-rules"] });
      toast({
        title: "Punishment Rule Created",
        description: "The punishment rule has been created successfully.",
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

  const deletePunishmentRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/punishment-rules/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/punishment-rules"] });
      toast({
        title: "Punishment Rule Deleted",
        description: "The punishment rule has been deleted successfully.",
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

  const { data: warningLevels } = useQuery<WarningLevel[]>({
    queryKey: ["/api/warning-levels"],
  });

  const handlePromptSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const systemPrompt = formData.get("systemPrompt") as string;
    const reason = formData.get("reason") as string;

    if (!name || !systemPrompt || !reason) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (promptTemplate) {
      updatePromptMutation.mutate({
        id: promptTemplate.id,
        name,
        systemPrompt,
        reason,
      });
    }
  };

  const handleDiscordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const botToken = formData.get("botToken") as string;
    const guildId = formData.get("guildId") as string;

    if (!botToken || !guildId) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    updateDiscordMutation.mutate({ botToken, guildId });
  };

  const handleOpenAISubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const apiKey = formData.get("apiKey") as string;

    if (!apiKey) {
      toast({
        title: "Error",
        description: "Please fill in the API key.",
        variant: "destructive",
      });
      return;
    }

    updateOpenAIMutation.mutate({ apiKey });
  };

  const handlePunishmentRuleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const type = formData.get("type") as "ban" | "mute";
    const pointThreshold = parseInt(formData.get("pointThreshold") as string);
    const duration = type === "mute" ? parseInt(formData.get("duration") as string) : undefined;

    if (!type || isNaN(pointThreshold) || (type === "mute" && isNaN(duration!))) {
      toast({
        title: "Error",
        description: "Please fill in all required fields with valid values.",
        variant: "destructive",
      });
      return;
    }

    createPunishmentRuleMutation.mutate({ type, pointThreshold, duration });
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Discord Integration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingDiscord ? (
              <div>Loading...</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Status</p>
                    <p className="text-sm text-muted-foreground">
                      {discordConfig?.status === "connected"
                        ? "Connected"
                        : discordConfig?.status === "error"
                        ? "Error"
                        : "Not Connected"}
                    </p>
                    {discordConfig?.error && (
                      <p className="text-sm text-red-500 mt-1">
                        {discordConfig.error}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => checkDiscordStatusMutation.mutate()}
                      disabled={checkDiscordStatusMutation.isPending}
                    >
                      <RefreshCw
                        className={`h-4 w-4 mr-2 ${
                          checkDiscordStatusMutation.isPending ? "animate-spin" : ""
                        }`}
                      />
                      Check Status
                    </Button>
                    <Dialog open={configuringDiscord} onOpenChange={setConfiguringDiscord}>
                      <DialogTrigger asChild>
                        <Button size="sm">Configure</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Discord Configuration</DialogTitle>
                          <DialogDescription>
                            Configure Discord bot settings and punishment rules.
                          </DialogDescription>
                        </DialogHeader>

                        <Tabs defaultValue="connection">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="connection">Connection</TabsTrigger>
                            <TabsTrigger value="punishments">Punishment Rules</TabsTrigger>
                          </TabsList>

                          <TabsContent value="connection">
                            <form onSubmit={handleDiscordSubmit} className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="botToken">Bot Token</Label>
                                <Input
                                  id="botToken"
                                  name="botToken"
                                  type="password"
                                  defaultValue={discordConfig?.botToken}
                                  placeholder="Enter your Discord bot token"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="guildId">Server ID</Label>
                                <Input
                                  id="guildId"
                                  name="guildId"
                                  defaultValue={discordConfig?.guildId}
                                  placeholder="Enter your Discord server ID"
                                />
                              </div>
                              <Button
                                type="submit"
                                className="w-full"
                                disabled={updateDiscordMutation.isPending}
                              >
                                Save Configuration
                              </Button>
                            </form>
                          </TabsContent>

                          <TabsContent value="punishments">
                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <h3 className="text-lg font-medium">Punishment Rules</h3>
                                <Dialog
                                  open={addingPunishmentRule}
                                  onOpenChange={setAddingPunishmentRule}
                                >
                                  <DialogTrigger asChild>
                                    <Button size="sm">Add Rule</Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Add Punishment Rule</DialogTitle>
                                      <DialogDescription>
                                        Create a new punishment rule based on warning points.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handlePunishmentRuleSubmit} className="space-y-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="type">Punishment Type</Label>
                                        <Select
                                          name="type"
                                          defaultValue="mute"
                                          onValueChange={(value) =>
                                            setSelectedPunishmentType(value as "ban" | "mute")
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select type" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="mute">Mute</SelectItem>
                                            <SelectItem value="ban">Ban</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="pointThreshold">Point Threshold</Label>
                                        <Input
                                          id="pointThreshold"
                                          name="pointThreshold"
                                          type="number"
                                          min="1"
                                          placeholder="Enter point threshold"
                                          required
                                        />
                                      </div>
                                      {selectedPunishmentType === "mute" && (
                                        <div className="space-y-2">
                                          <Label htmlFor="duration">
                                            Duration (hours)
                                          </Label>
                                          <Input
                                            id="duration"
                                            name="duration"
                                            type="number"
                                            min="1"
                                            placeholder="Enter duration in hours"
                                            required
                                          />
                                        </div>
                                      )}
                                      <Button type="submit" className="w-full">
                                        Create Rule
                                      </Button>
                                    </form>
                                  </DialogContent>
                                </Dialog>
                              </div>

                              {isLoadingPunishmentRules ? (
                                <div>Loading rules...</div>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Type</TableHead>
                                      <TableHead>Points</TableHead>
                                      <TableHead>Duration</TableHead>
                                      <TableHead>Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {punishmentRules?.map((rule) => (
                                      <TableRow key={rule.id}>
                                        <TableCell className="capitalize">{rule.type}</TableCell>
                                        <TableCell>{rule.pointThreshold} points</TableCell>
                                        <TableCell>
                                          {rule.type === "ban"
                                            ? "Permanent"
                                            : `${rule.duration} hours`}
                                        </TableCell>
                                        <TableCell>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              deletePunishmentRuleMutation.mutate(rule.id)
                                            }
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </TabsContent>
                        </Tabs>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-5 w-5" />
              OpenAI Integration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingOpenAI ? (
              <div>Loading...</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Status</p>
                    <p className="text-sm text-muted-foreground">
                      {openaiConfig?.status === "connected"
                        ? "Connected"
                        : openaiConfig?.status === "error"
                        ? "Error"
                        : "Not Connected"}
                    </p>
                    {openaiConfig?.error && (
                      <p className="text-sm text-red-500 mt-1">
                        {openaiConfig.error}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => checkOpenAIStatusMutation.mutate()}
                      disabled={checkOpenAIStatusMutation.isPending}
                    >
                      <RefreshCw
                        className={`h-4 w-4 mr-2 ${
                          checkOpenAIStatusMutation.isPending ? "animate-spin" : ""
                        }`}
                      />
                      Check Status
                    </Button>
                    <Dialog open={configuringOpenAI} onOpenChange={setConfiguringOpenAI}>
                      <DialogTrigger asChild>
                        <Button size="sm">Configure</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>OpenAI Configuration</DialogTitle>
                          <DialogDescription>
                            Enter your OpenAI API key to enable content moderation.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleOpenAISubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="apiKey">API Key</Label>
                            <Input
                              id="apiKey"
                              name="apiKey"
                              type="password"
                              placeholder="Enter your OpenAI API key"
                            />
                          </div>
                          <Button
                            type="submit"
                            className="w-full"
                            disabled={updateOpenAIMutation.isPending}
                          >
                            Save Configuration
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Rules Generator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Generate formatted rules text for your Discord server
              </p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Rules
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Server Rules</DialogTitle>
                    <DialogDescription>
                      Copy and paste these rules into your Discord server's rules channel
                    </DialogDescription>
                  </DialogHeader>

                  {punishmentRules && promptTemplate && warningLevels && (
                    <div className="space-y-4">
                      <div className="relative">
                        <Button
                          variant="outline"
                          size="sm"
                          className="absolute right-2 top-2"
                          onClick={() => {
                            const rulesText = document.getElementById('rules-text');
                            if (rulesText) {
                              navigator.clipboard.writeText(rulesText.innerText);
                              toast({
                                title: "Copied",
                                description: "Rules text copied to clipboard",
                              });
                            }
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </Button>
                        <div
                          id="rules-text"
                          className="p-4 bg-muted rounded-lg prose prose-sm max-h-[60vh] overflow-y-auto"
                        >
                          <div className="whitespace-pre-wrap font-mono text-sm">
                            {`# Server Rules and Moderation

Welcome to our server! We use an AI-powered moderation system (@AI-Mod) to help maintain a positive environment. Here's how it works:

## Moderation System Overview

Our AI moderator analyzes messages in real-time and categorizes potential violations into warning levels. Each warning carries points, and accumulating points triggers automatic punishments.

## Punishment Rules

${punishmentRules
  .map(
    (rule) =>
      `- **${rule.pointThreshold} Points**: ${
        rule.type === "ban"
          ? "Permanent Ban"
          : `${rule.duration}-hour Timeout`
      }`
  )
  .join("\n")}

## Warning Levels and Rules

${(warningLevels || [])
  .map(
    (level) => `### ${level.name} Warning (${level.points} points)
${level.description}

Rules in this category:
${level.rules
  .map((rule, index) => `${index + 1}. ${rule.description}`)
  .join("\n")}`
  )
  .join("\n\n")}

## AI Moderation Details

Our AI moderator uses the following criteria to evaluate messages:

\`\`\`
${promptTemplate.systemPrompt}
\`\`\`

For any questions about moderation actions, please contact the server administrators.`}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Prompt Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!promptTemplate ? (
              <div>Loading...</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{promptTemplate.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Last updated: {new Date(promptTemplate.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHistory(promptTemplate.id)}
                    >
                      <History className="h-4 w-4 mr-2" />
                      History
                    </Button>
                    <Dialog open={configuringPrompt} onOpenChange={setConfiguringPrompt}>
                      <DialogTrigger asChild>
                        <Button size="sm">Configure</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Edit Prompt Template</DialogTitle>
                          <DialogDescription>
                            Update the AI prompt template for content moderation.
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handlePromptSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Template Name</Label>
                            <Input
                              id="name"
                              name="name"
                              defaultValue={promptTemplate.name}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="systemPrompt">System Prompt</Label>
                            <Textarea
                              id="systemPrompt"
                              name="systemPrompt"
                              defaultValue={promptTemplate.systemPrompt}
                              className="h-64 font-mono"
                              required
                            />
                            <p className="text-sm text-muted-foreground">
                              Use {'{{RULES_LIST}}'} as a placeholder for the current rules.
                            </p>
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
                          <Button
                            type="submit"
                            className="w-full"
                            disabled={updatePromptMutation.isPending}
                          >
                            Update Template
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>

                    <Dialog
                      open={showHistory !== null}
                      onOpenChange={(open) => setShowHistory(open ? promptTemplate.id : null)}
                    >
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>Template History</DialogTitle>
                          <DialogDescription>
                            View the history of changes made to this template.
                          </DialogDescription>
                        </DialogHeader>
                        {promptHistory ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {promptHistory.map((entry) => (
                                <TableRow key={entry.id}>
                                  <TableCell>
                                    {new Date(entry.createdAt).toLocaleString()}
                                  </TableCell>
                                  <TableCell>{entry.reason}</TableCell>
                                  <TableCell>
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button variant="outline" size="sm">
                                          View Prompt
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle>Historical Prompt</DialogTitle>
                                          <DialogDescription>
                                            Version from {new Date(entry.createdAt).toLocaleString()}
                                          </DialogDescription>
                                        </DialogHeader>
                                        <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-96">
                                          <code>{entry.systemPrompt}</code>
                                        </pre>
                                      </DialogContent>
                                    </Dialog>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div>Loading history...</div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
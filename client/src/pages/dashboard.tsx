import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { WarningCard, type Warning, type User } from "./history";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Textarea } from "@/components/ui/textarea";

// For testing, we'll use a hardcoded test user
const TEST_USER = {
  id: "test123",
  username: "TestUser",
};

export default function Dashboard() {
  const [message, setMessage] = useState("");
  const [selectedWarning, setSelectedWarning] = useState<Warning | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: warnings } = useQuery<Warning[]>({
    queryKey: [`/api/warnings?userId=${TEST_USER.id}`],
  });

  const { data: user } = useQuery<User>({
    queryKey: [`/api/users/${TEST_USER.id}`],
  });

  const moderateMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch("/api/test/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          userId: TEST_USER.id,
          username: TEST_USER.username,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to moderate message");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/warnings?userId=${TEST_USER.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${TEST_USER.id}`] });

      const color =
        data.warningLevel === "red" ? "destructive" :
          data.warningLevel === "orange" ? "warning" : "default";

      if (data.warningLevel !== "none") {
        toast({
          title: `${data.warningLevel.toUpperCase()} Warning`,
          description: `+${data.points} points (Total: ${data.totalPoints})${data.punishment ? `\nPunishment: ${data.punishment}` : ""}`,
          variant: color,
        });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    moderateMutation.mutate(message);
    setMessage("");
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Moderation Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Test Message Moderation</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message to test moderation..."
                  disabled={user?.isBanned}
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Try including words like "spam", "threat", or "hate" to trigger warnings
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Button
                  type="submit"
                  disabled={!message.trim() || user?.isBanned || moderateMutation.isPending}
                >
                  Send Message
                </Button>
                {user && (
                  <div className="text-right">
                    <p className="font-medium">Points: {user.totalPoints}/10</p>
                    {user.isBanned && (
                      <p className="text-red-600 font-semibold">BANNED</p>
                    )}
                    {user.isMuted && (
                      <p className="text-orange-600 font-semibold">
                        MUTED until {new Date(user.muteExpiresAt!).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:row-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5" />
              Warning History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {warnings?.map((warning) => (
                <div key={warning.id} className="flex-grow basis-[calc(100%-1rem)] sm:basis-[calc(50%-1rem)] min-w-[250px]">
                  <WarningCard
                    warning={warning}
                    onSelect={setSelectedWarning}
                  />
                </div>
              ))}
              {warnings?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center w-full">
                  No warnings yet. Try sending a message that violates the rules.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedWarning} onOpenChange={(open) => !open && setSelectedWarning(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Warning Details</DialogTitle>
            <DialogDescription>
              View detailed information about this warning
            </DialogDescription>
          </DialogHeader>

          {selectedWarning && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">Message</h3>
                  <div className="rounded-md bg-muted p-4">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedWarning.messageContent}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium">Warning Level</h3>
                  <Badge
                    style={{
                      backgroundColor: selectedWarning.level.color,
                      color: "white",
                    }}
                  >
                    {selectedWarning.level.name}
                  </Badge>
                </div>

                <div>
                  <h3 className="font-medium">Points</h3>
                  <p>{selectedWarning.points}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">Rule Triggered</h3>
                  <p className="text-sm">{selectedWarning.ruleTriggered}</p>
                </div>

                <div>
                  <h3 className="font-medium">Context</h3>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="font-medium">Channel:</span>{" "}
                      {selectedWarning.messageContext.channelName}
                    </p>
                    <p>
                      <span className="font-medium">Time:</span>{" "}
                      {format(new Date(selectedWarning.createdAt), "PPpp")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
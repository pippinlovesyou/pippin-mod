import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Ban, Search, AlertTriangle, RotateCw, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Warning {
  id: number;
  userId: string;
  username: string;
  levelId: number;
  points: number;
  ruleTriggered: string;
  messageContent: string;
  messageContext: {
    channelId: string;
    channelName: string;
  };
  createdAt: string;
  messageDeleted: boolean;
  messageIgnored: boolean;
  ignoredAt?: string;
  ignoredBy?: string;
  ignoreReason?: string;
  level: {
    name: string;
    color: string;
  };
}

interface User {
  id: string;
  username: string;
  totalPoints: number;
  isBanned: boolean;
  isMuted: boolean;
  muteExpiresAt: string | null;
  warningCount: number;
  activeWarnings: number;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: userWarnings = [], isLoading: warningsLoading } = useQuery<Warning[]>({
    queryKey: ["/api/warnings", selectedUser?.id],
    enabled: !!selectedUser,
  });

  const filteredUsers = users.filter((user) => {
    if (searchTerm) {
      return (
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return true;
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">User Management</h1>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {usersLoading ? (
          <p>Loading users...</p>
        ) : filteredUsers.length === 0 ? (
          <p>No users found matching your search</p>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.id} className="flex-[1_1_calc(100%-1rem)] sm:flex-[1_1_calc(50%-1rem)] lg:flex-[1_1_calc(33.333%-1rem)] xl:flex-[1_1_calc(25%-1rem)] min-w-[250px]">
              <Card>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">{user.username}</p>
                      <p className="text-sm text-muted-foreground">ID: {user.id}</p>
                    </div>
                    <div className="flex gap-2">
                      {user.isBanned && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          Banned
                        </Badge>
                      )}
                      {user.isMuted && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Muted
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <Badge variant="outline">{user.totalPoints} Points</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedUser(user)}
                    >
                      View History
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>User History - {selectedUser?.username}</DialogTitle>
            <DialogDescription>
              Warning history and user status
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium">User Details</h3>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            fetch(`/api/users/${selectedUser.id}/recalculate`, {
                              method: "POST",
                            })
                              .then((res) => {
                                if (!res.ok) throw new Error("Failed to recalculate points");
                                return res.json();
                              })
                              .then(() => {
                                queryClient.invalidateQueries({
                                  queryKey: ["/api/users"],
                                });
                                queryClient.invalidateQueries({
                                  queryKey: ["/api/warnings", selectedUser.id],
                                });
                                toast({
                                  title: "Points Recalculated",
                                  description: "User points and status have been updated.",
                                });
                              })
                              .catch((error) => {
                                toast({
                                  title: "Error",
                                  description: error.message,
                                  variant: "destructive",
                                });
                              });
                          }}
                        >
                          <RotateCw className="h-4 w-4 mr-2" />
                          Recalculate Points
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            if (!confirm("Are you sure you want to reset all warnings for this user? This action cannot be undone.")) {
                              return;
                            }
                            fetch(`/api/users/${selectedUser.id}/reset-warnings`, {
                              method: "POST",
                            })
                              .then((res) => {
                                if (!res.ok) throw new Error("Failed to reset warnings");
                                return res.json();
                              })
                              .then(() => {
                                queryClient.invalidateQueries({
                                  queryKey: ["/api/users"],
                                });
                                queryClient.invalidateQueries({
                                  queryKey: ["/api/warnings", selectedUser.id],
                                });
                                toast({
                                  title: "Warnings Reset",
                                  description: "All warnings have been cleared for this user.",
                                });
                              })
                              .catch((error) => {
                                toast({
                                  title: "Error",
                                  description: error.message,
                                  variant: "destructive",
                                });
                              });
                          }}
                        >
                          <RefreshCcw className="h-4 w-4 mr-2" />
                          Reset Warnings
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p>
                        <span className="font-medium">Username:</span> {selectedUser.username}
                      </p>
                      <p>
                        <span className="font-medium">ID:</span> {selectedUser.id}
                      </p>
                      <p>
                        <span className="font-medium">Total Points:</span> {selectedUser.totalPoints}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {selectedUser.isBanned && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <Ban className="w-3 h-3" />
                            Banned
                          </Badge>
                        )}
                        {selectedUser.isMuted && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Muted until {format(new Date(selectedUser.muteExpiresAt!), "PPp")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-medium mb-2">Warning Summary</h3>
                    <div className="space-y-2">
                      <p>
                        <span className="font-medium">Total Warnings:</span> {userWarnings.length}
                      </p>
                      <p>
                        <span className="font-medium">Active Warnings:</span>{" "}
                        {userWarnings.filter((w) => !w.messageIgnored).length}
                      </p>
                      <p>
                        <span className="font-medium">Ignored Warnings:</span>{" "}
                        {userWarnings.filter((w) => w.messageIgnored).length}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-lg">Warning History</h3>
                {warningsLoading ? (
                  <p>Loading warnings...</p>
                ) : userWarnings.length === 0 ? (
                  <p>No warnings found for this user</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {userWarnings.map((warning) => (
                      <Card key={warning.id} className={`${warning.messageIgnored ? "bg-muted" : ""}`}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-medium">{warning.ruleTriggered}</p>
                              <p className="text-sm text-muted-foreground">
                                {warning.messageContext.channelName}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {warning.messageIgnored && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Ban className="w-3 h-3" />
                                  Ignored
                                </Badge>
                              )}
                              {warning.level && (
                                <Badge
                                  style={{
                                    backgroundColor: warning.level.color,
                                    color: "white",
                                  }}
                                >
                                  {warning.level.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-sm mb-2">{warning.messageContent}</p>
                          <div className="flex justify-between items-center text-sm text-muted-foreground">
                            <span>{format(new Date(warning.createdAt), "PP")}</span>
                            <span>Points: {warning.points}</span>
                          </div>
                          {warning.messageIgnored && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              <p>
                                Ignored by {warning.ignoredBy} on {format(new Date(warning.ignoredAt!), "PPp")}
                              </p>
                              <p>Reason: {warning.ignoreReason}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
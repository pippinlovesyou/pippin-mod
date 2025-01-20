import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Filter, AlertTriangle, Ban, Search, RotateCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

// Extract interfaces so they can be imported by other components
export interface Warning {
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

export interface User {
  id: string;
  username: string;
  totalPoints: number;
  isBanned: boolean;
  isMuted: boolean;
  muteExpiresAt: string | null;
  warningCount: number;
  activeWarnings: number;
}

export const WARNING_TYPES = [
  { value: "none", label: "No Warning" },
  { value: "yellow", label: "Yellow" },
  { value: "orange", label: "Orange" },
  { value: "red", label: "Red" },
];

// Extract warning card component for reuse
export const WarningCard = ({ warning, onSelect }: { warning: Warning; onSelect?: (warning: Warning) => void }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className={warning.messageIgnored ? 'bg-muted' : ''}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="font-semibold">{warning.username}</p>
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
        <p className={`text-sm mb-2 ${isExpanded ? '' : 'line-clamp-2'}`}>{warning.messageContent}</p>

        {isExpanded && (
          <div className="mt-2 space-y-2 text-sm text-muted-foreground">
            <p><span className="font-medium">Rule Triggered:</span> {warning.ruleTriggered}</p>
            <p><span className="font-medium">Points:</span> {warning.points}</p>
            {warning.messageIgnored && (
              <>
                <p>
                  <span className="font-medium">Ignored by:</span> {warning.ignoredBy}
                </p>
                <p>
                  <span className="font-medium">Ignored at:</span> {format(new Date(warning.ignoredAt!), "PPpp")}
                </p>
                <p>
                  <span className="font-medium">Ignore Reason:</span> {warning.ignoreReason}
                </p>
              </>
            )}
          </div>
        )}

        <div className="flex justify-between items-center text-sm text-muted-foreground mt-2">
          <span>{format(new Date(warning.createdAt), "PP")}</span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7 px-2 text-xs"
            >
              {isExpanded ? "Show Less" : "Show More"}
            </Button>
            {onSelect && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelect(warning)}
                className="h-7 px-2 text-xs"
              >
                Details
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function HistoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("warnings");
  const [selectedWarning, setSelectedWarning] = useState<Warning | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [ignoreReason, setIgnoreReason] = useState("");
  const [selectedWarningTypes, setSelectedWarningTypes] = useState(
    new Set(WARNING_TYPES.map((t) => t.value).filter((t) => t !== "none"))
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState("");

  // Query for all warnings (used in the warnings tab)
  const { data: allWarnings = [], isLoading: allWarningsLoading } = useQuery<Warning[]>({
    queryKey: ["/api/warnings"],
  });

  // Query for selected user's warnings (used in the user modal)
  const { data: userWarnings = [], isLoading: warningsLoading } = useQuery<Warning[]>({
    queryKey: [`/api/warnings?userId=${selectedUser?.id}`],
    enabled: !!selectedUser,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const ignoreWarningMutation = useMutation({
    mutationFn: async ({ warningId, userId, reason }: { warningId: number; userId: string; reason: string }) => {
      const res = await fetch(`/api/warnings/${warningId}/ignore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Warning Ignored",
        description: "The warning has been marked as ignored",
      });
      setSelectedWarning(null);
      setIgnoreReason("");
      queryClient.invalidateQueries({ queryKey: ['/api/warnings'] });
      if (selectedUser) {
        queryClient.invalidateQueries({ queryKey: [`/api/warnings?userId=${selectedUser.id}`] });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredWarnings = allWarnings.filter((warning) => {
    const warningType = warning.level?.name.toLowerCase() || "none";
    if (!selectedWarningTypes.has(warningType)) {
      return false;
    }

    if (searchTerm) {
      return (
        warning.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        warning.messageContent.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return true;
  });

  const filteredUsers = users.filter((user) => {
    if (userSearchTerm) {
      return (
        user.username.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        user.id.toLowerCase().includes(userSearchTerm.toLowerCase())
      );
    }
    return true;
  });

  const toggleWarningType = (type: string) => {
    const newTypes = new Set(selectedWarningTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setSelectedWarningTypes(newTypes);

    toast({
      title: "Filters Updated",
      description: `${type} warnings ${newTypes.has(type) ? "shown" : "hidden"}`,
      duration: 2000,
    });
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Moderation History</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="warnings" className="flex-1">Warnings</TabsTrigger>
          <TabsTrigger value="users" className="flex-1">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="warnings">
          <div className="flex flex-col gap-4 mb-6 sm:flex-row">
            <div className="w-full sm:w-64">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Filter className="w-4 h-4 mr-2" />
                    Warning Types
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {WARNING_TYPES.map((type) => (
                    <DropdownMenuItem key={type.value} onSelect={(e) => e.preventDefault()}>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={type.value}
                          checked={selectedWarningTypes.has(type.value)}
                          onCheckedChange={() => toggleWarningType(type.value)}
                        />
                        <Label htmlFor={type.value}>{type.label}</Label>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Input
              placeholder="Search by username or content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {allWarningsLoading ? (
              <p>Loading warnings...</p>
            ) : filteredWarnings.length === 0 ? (
              <p>No warnings found matching your filters</p>
            ) : (
              filteredWarnings.map((warning) => (
                <div key={warning.id} className="w-full">
                  <WarningCard warning={warning} onSelect={setSelectedWarning} />
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="users">
          <div className="relative flex w-full mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search users..."
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {usersLoading ? (
              <p>Loading users...</p>
            ) : (
              filteredUsers.map((user) => (
                <div key={user.id} className="w-full">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
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
                      <div className="flex justify-between items-center mt-4">
                        <Badge variant="outline" className="text-xs">
                          {user.totalPoints} Points
                        </Badge>
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
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedWarning} onOpenChange={(open) => {
        if (!open) {
          setSelectedWarning(null);
          setIgnoreReason("");
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Warning Details
              {selectedWarning?.messageIgnored && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Ban className="w-3 h-3" />
                  Ignored
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Full details of the warning event
            </DialogDescription>
          </DialogHeader>
          {selectedWarning && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {selectedWarning.messageIgnored && (
                    <div className="rounded-lg bg-muted p-3 border border-border md:col-span-2">
                      <h3 className="font-medium mb-1 flex items-center gap-2">
                        <Ban className="w-4 h-4" />
                        Warning Ignored
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Ignored by {selectedWarning.ignoredBy} on{" "}
                        {format(new Date(selectedWarning.ignoredAt!), "PPpp")}
                      </p>
                      <p className="text-sm mt-1">
                        Reason: {selectedWarning.ignoreReason}
                      </p>
                    </div>
                  )}

                  <div>
                    <h3 className="font-medium">User</h3>
                    <p>{selectedWarning.username}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Channel</h3>
                    <p>{selectedWarning.messageContext.channelName}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Rule Triggered</h3>
                    <p>{selectedWarning.ruleTriggered}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium">Message Content</h3>
                    <p className="whitespace-pre-wrap">
                      {selectedWarning.messageContent}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium">Points</h3>
                    <p>{selectedWarning.points}</p>
                  </div>
                  <div>
                    <h3 className="font-medium">Date/Time</h3>
                    <p>
                      {format(new Date(selectedWarning.createdAt), "PPpp")}
                    </p>
                  </div>
                </div>
              </div>

              {!selectedWarning.messageIgnored && (
                <div>
                  <Label htmlFor="ignore-reason">Ignore Reason</Label>
                  <Textarea
                    id="ignore-reason"
                    placeholder="Enter reason for ignoring this warning..."
                    value={ignoreReason}
                    onChange={(e) => setIgnoreReason(e.target.value)}
                  />
                  <DialogFooter className="mt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!ignoreReason.trim()) {
                          toast({
                            title: "Error",
                            description: "Please provide a reason for ignoring the warning",
                            variant: "destructive",
                          });
                          return;
                        }
                        ignoreWarningMutation.mutate({
                          warningId: selectedWarning.id,
                          userId: selectedWarning.userId,
                          reason: ignoreReason,
                        });
                      }}
                      disabled={ignoreWarningMutation.isPending}
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Ignore Warning
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => {
                          fetch(`/api/users/${selectedUser.id}/recalculate`, {
                            method: 'POST',
                          })
                            .then(res => {
                              if (!res.ok) throw new Error('Failed to recalculate points');
                              return res.json();
                            })
                            .then(() => {
                              queryClient.invalidateQueries({
                                queryKey: ['/api/users']
                              });
                              queryClient.invalidateQueries({
                                queryKey: ['/api/warnings', selectedUser.id]
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
                    </div>
                    <div className="space-y-2">
                      <p><span className="font-medium">Username:</span> {selectedUser.username}</p>
                      <p><span className="font-medium">ID:</span> {selectedUser.id}</p>
                      <p><span className="font-medium">Total Points:</span> {selectedUser.totalPoints}</p>
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
                      <p><span className="font-medium">Total Warnings:</span> {userWarnings.length}</p>
                      <p>
                        <span className="font-medium">Active Warnings:</span>{" "}
                        {userWarnings.filter(w => !w.messageIgnored).length}
                      </p>
                      <p>
                        <span className="font-medium">Ignored Warnings:</span>{" "}
                        {userWarnings.filter(w => w.messageIgnored).length}
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
                      <WarningCard
                        key={warning.id}
                        warning={warning}
                        onSelect={setSelectedWarning}
                      />
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
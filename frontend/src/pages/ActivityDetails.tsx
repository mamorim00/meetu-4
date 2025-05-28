import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "components/Layout";
import { useActivityStore, Activity } from "../utils/activityStore";
import { useUserGuardContext } from "app";
import { useFriendsStore } from "../utils/friendsStore";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { CalendarIcon, MapPinIcon, UsersIcon, Clock, ArrowLeft, UserPlus, Lock, Globe, MessageSquare, Loader2 } from "lucide-react";
import { useChatStore } from "../utils/chatStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatActivityDateTime } from "../utils/formatTime";
import { Timestamp } from "firebase/firestore";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../utils/firebase"; 

const ActivityDetailsContent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activityId = searchParams.get("id");
  const { user } = useUserGuardContext();
  const { activities, isLoading, joinActivity, leaveActivity, deleteActivity } = useActivityStore();
  const { isFriend, sendFriendRequest } = useFriendsStore();
  
  // Local state for the activity and participants
  const [activity, setActivity] = useState<Activity | null>(null);
  const [participants, setParticipants] = useState<Array<{id: string, name: string, photoURL: string | null}>>([]);
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [chatJoinAttempted, setChatJoinAttempted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  

  
  const formattedDateTime = useMemo(() => {
    if (!activity) return { date: "", time: "" };
  
    // extract the raw value
    const raw = activity.dateTime;
  
    // if it's a Firestore Timestamp, call .toDate(), otherwise leave it as-is
    const when: string | Date = raw instanceof Timestamp
      ? raw.toDate()
      : raw;
  
    // now "when" is only string | Date, which matches your helper
    return formatActivityDateTime(when);
  }, [activity]);
  // Instead of calling store.isParticipant(), we check the local state.
  const userIsParticipant = useMemo(() => {
    if (!activity || !user) return false;
    return activity.participantIds.includes(user.uid);
  }, [activity, user]);

  const userIsCreator = useMemo(() => {
    if (!activity || !user) return false;
    return activity.createdBy.userId === user.uid;
  }, [activity, user]);

  const creatorIsFriend = useMemo(() => {
    if (!activity) return false;
    return isFriend(activity.createdBy.userId);
  }, [activity, isFriend]);

  const canJoinActivity = useMemo(() => {
    if (!activity) return false;
    return activity.isPublic !== false || userIsCreator || creatorIsFriend;
  }, [activity, userIsCreator, creatorIsFriend]);

  // Load the activity from the global store only if we haven't already set it optimistically
  const [triedLookup, setTriedLookup] = useState(false);


useEffect(() => {
  const fetchActivity = async () => {
    if (!activity && activityId && !triedLookup) {
      const foundActivity = activities.find(a => a.id === activityId);
      if (foundActivity) {
        setActivity(foundActivity);
        setTriedLookup(true);
        return;
      }

      try {
        const docRef = doc(firestore, "activities", activityId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setActivity({ id: activityId, ...data } as Activity); // cast if needed
        } else {
          toast.error("Activity not found");
          navigate("/feed");
        }
      } catch (error) {
        console.error("Error fetching activity:", error);
        toast.error("Error loading activity");
        navigate("/feed");
      } finally {
        setTriedLookup(true);
      }
    }
  };

  fetchActivity();
}, [activity, activityId, activities, isLoading, navigate, triedLookup]);


useEffect(() => {
  const fetchParticipants = async () => {
    if (!activity || !activity.participantIds?.length) {
      setParticipants([]);
      return;
    }

    const creatorId = activity.createdBy.userId;
    const creatorDoc = await getDoc(doc(firestore, "userProfiles", creatorId));
    const creatorInfo = {
      id: creatorId,
      name: creatorDoc.exists() ? creatorDoc.data().displayName : `User-${creatorId.substring(0, 5)}`,
      photoURL: creatorDoc.exists() ? creatorDoc.data().photoURL : null
    };

    const otherIds = activity.participantIds.filter(id => id !== creatorId);
    const otherPromises = otherIds.map(async (id) => {
      const userDoc = await getDoc(doc(firestore, "userProfiles", id));
      return {
        id,
        name: userDoc.exists() ? userDoc.data().displayName : `User-${id.substring(0, 5)}`,
        photoURL: userDoc.exists() ? userDoc.data().photoURL : null
      };
    });

    const others = await Promise.all(otherPromises);
    setParticipants([creatorInfo, ...others]);
  };

  fetchParticipants();
}, [activity]);


  // Handle joining the activity
  const handleJoin = useCallback(async () => {
    if (!activity || !user || joining) return;
    try {
      setJoining(true);
      await joinActivity(activity.id, user.uid);
      toast.success("You've joined the activity!");
      // Optionally, you could update local state here if desired
      setActivity(prev =>
        prev
          ? { ...prev, participantIds: [...prev.participantIds, user.uid] }
          : prev
      );
    } catch (error) {
      console.error("Error joining activity:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to join activity";
      toast.error(errorMessage);
    } finally {
      setJoining(false);
    }
  }, [activity, user, joining, joinActivity]);

  // Handle leaving the activity with an optimistic update
  const handleLeave = useCallback(async () => {
    if (!activity || !user || leaving) return;
    try {
      setLeaving(true);
      await leaveActivity(activity.id, user.uid);
      // Update the local activity state by removing the current user
      setActivity(prevActivity => {
        if (prevActivity) {
          return {
            ...prevActivity,
            participantIds: prevActivity.participantIds.filter(id => id !== user.uid)
          };
        }
        return prevActivity;
      });
      // Also update the participants list for the dialog
      setParticipants(prevParticipants =>
        prevParticipants.filter(participant => participant.id !== user.uid)
      );
      toast.success("You have left the activity");
    } catch (error) {
      console.error("Error leaving activity:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to leave activity";
      toast.error(errorMessage);
    } finally {
      setLeaving(false);
    }
  }, [activity, user, leaving, leaveActivity]);

  // Handle deleting the activity
  const handleDeleteActivity = useCallback(async () => {
    if (!activity || !user || isDeleting) return;
    try {
      setIsDeleting(true);
      await deleteActivity(activity.id, user.uid);
      toast.success("Activity deleted successfully");
      navigate("/feed");
    } catch (error) {
      console.error("Error deleting activity:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete activity";
      toast.error(errorMessage);
      setShowDeleteDialog(false);
    } finally {
      setIsDeleting(false);
    }
  }, [activity, user, isDeleting, deleteActivity, navigate]);

  // Handle sending a friend request
  const handleSendFriendRequest = useCallback(async () => {
    if (!activity || !user || sendingRequest) return;
    try {
      setSendingRequest(true);
      await sendFriendRequest(user, activity.createdBy.userId);
      toast.success(`Friend request sent to ${activity.createdBy.displayName}!`);
    } catch (error) {
      console.error("Error sending friend request:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to send friend request";
      toast.error(errorMessage);
    } finally {
      setSendingRequest(false);
    }
  }, [activity, user, sendingRequest, sendFriendRequest]);

  // Join the chat associated with the activity
  const joinActivityChat = useCallback(async () => {
    if (!activity || !user) {
      console.log("Cannot join chat - missing activity or user data");
      return;
    }
    try {
      await useChatStore.getState().unsubscribeFromChat();
      await useChatStore.getState().createOrJoinActivityChat(activity.id, user);
    } catch (error) {
      console.error("Error joining chat:", error);
      toast.error("Failed to connect to activity chat. You can try again in the chat tab.");
    }
  }, [activity, user]);

  // Auto-join chat if user is a participant (based on our local state)
  useEffect(() => {
    if (!chatJoinAttempted && activity && user && userIsParticipant) {
      joinActivityChat();
      setChatJoinAttempted(true);
    }
  }, [activity, user, userIsParticipant, joinActivityChat, chatJoinAttempted]);

  // Utility: Get initials from a name
  const getInitials = useCallback((name: string | null) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  }, []);

  // Utility: Get category color based on category name
  const getCategoryColorClass = useCallback((category: string) => {
    switch (category) {
      case "Sports":
        return "bg-primary/10 text-primary hover:bg-primary/20";
      case "Dining":
        return "bg-secondary/20 text-secondary-foreground hover:bg-secondary/30";
      case "Hiking":
        return "bg-accent/10 text-accent hover:bg-accent/20";
      case "Gaming":
        return "bg-muted/10 text-muted hover:bg-muted/20";
      case "Movies":
        return "bg-secondary/20 text-secondary-foreground hover:bg-secondary/30";
      case "Travel":
        return "bg-primary/10 text-primary hover:bg-primary/20";
      case "Music":
        return "bg-muted/10 text-muted hover:bg-muted/20";
      case "Cooking":
        return "bg-accent/10 text-accent hover:bg-accent/20";
      default:
        return "bg-primary/10 text-primary hover:bg-primary/20";
    }
  }, []);

// 1️⃣ While the store is loading OR before we've even tried our lookup, stay in "loading"
if (isLoading || (!activity && !triedLookup)) {
  return (
    <div className="container mx-auto px-4 py-8 flex justify-center items-center">
      <p>Loading activity details…</p>
    </div>
  );
}

// 2️⃣ Only after triedLookup is true and activity is still null do we show "not found"
if (!activity) {
  return (
    <div className="container mx-auto px-4 py-8 flex justify-center items-center">
      <p>Activity not found.</p>
    </div>
  );
}


  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back Button */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/feed")} className="group">
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Feed
        </Button>
      </div>

      {/* Activity Header Card */}
      <Card className="mb-8 overflow-hidden rounded-3xl border-border/40">
        <div className={`h-28 w-full flex items-center justify-center ${
          activity.category === "Sports" ? "bg-primary/10" : 
          activity.category === "Dining" ? "bg-secondary/20" :
          activity.category === "Hiking" ? "bg-accent/10" :
          activity.category === "Gaming" ? "bg-muted/10" :
          activity.category === "Movies" ? "bg-secondary/20" :
          activity.category === "Travel" ? "bg-primary/10" :
          activity.category === "Music" ? "bg-muted/10" :
          activity.category === "Cooking" ? "bg-accent/10" : "bg-primary/10"
        }`}>
          <Badge className={`${getCategoryColorClass(activity.category)} text-lg px-4 py-2`}>
            {activity.category}
          </Badge>
        </div>
        
        <CardHeader className="pb-0">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div className="flex gap-3">
              <h1 className="text-2xl font-semibold">{activity.title}</h1>
              <div className="flex items-center mt-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="flex gap-1 items-center">
                        {activity.isPublic !== false ? (
                          <>
                            <Globe className="h-3 w-3" />
                            <span>Public</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3" />
                            <span>Friends Only</span>
                          </>
                        )}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      {activity.isPublic !== false 
                        ? "Anyone can see and join this activity" 
                        : "Only the creator and their friends can see and join this activity"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end">
                <span className="text-sm">Organized by</span>
                <span className="font-medium">
                  {activity.createdBy.displayName || `User-${activity.createdBy.userId.substring(0, 5)}`}
                </span>
              </div>
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {getInitials(activity.createdBy.displayName)}
                </AvatarFallback>
              </Avatar>
              {!userIsCreator && !creatorIsFriend && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSendFriendRequest}
                  disabled={sendingRequest}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  {sendingRequest ? "Sending..." : "Add Friend"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-2">
              <p className="text-muted-foreground whitespace-pre-wrap">{activity.description}</p>
            </div>
            
            <div className="space-y-3 bg-muted/5 p-3 rounded-lg">
              <div>
                <div className="flex items-center text-sm">
                  <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{formattedDateTime.date}</span>
                </div>
                <div className="flex items-center text-sm mt-1">
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{formattedDateTime.time}</span>
                </div>
              </div>
              
              <div>
                <div className="flex items-center text-sm">
                  <MapPinIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{activity.location}</span>
                </div>
              </div>
              
              <div>
                <div className="flex items-center">
                  <UsersIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {activity.participantIds.length} participating
                    {activity.maxParticipants && (
                      <> (max {activity.maxParticipants})</>  
                    )}
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2 w-full"
                  onClick={() => setParticipantsDialogOpen(true)}
                >
                  View Participants
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="pt-0 flex justify-between">
  <div className="flex gap-2">
    {userIsParticipant && (
      <Button
        className="rounded-full"
        variant="secondary"
        onClick={() =>
          navigate(
            `/chat-detail?activityId=${activity.id}&activityName=${encodeURIComponent(
              activity.title
            )}`
          )
        }
      >
        <MessageSquare className="mr-2 h-4 w-4" />
        Chat
      </Button>
    )}

    {!userIsCreator && (
      userIsParticipant ? (
        <Button
          variant="outline"
          className="rounded-full bg-red-100 hover:bg-red-200 text-red-600 border-red-200"
          onClick={handleLeave}
          disabled={leaving}
        >
          {leaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Leaving...
            </>
          ) : (
            "Leave Activity"
          )}
        </Button>
      ) : canJoinActivity ? (
        <Button
          className="rounded-full"
          onClick={handleJoin}
          disabled={
            joining ||
            (activity.maxParticipants &&
              activity.participantIds.length >= activity.maxParticipants)
          }
        >
          {joining ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Joining...
            </>
          ) : activity.maxParticipants &&
            activity.participantIds.length >= activity.maxParticipants ? (
            "Activity Full"
          ) : (
            "Join Activity"
          )}
        </Button>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="rounded-full"
                variant="secondary"
                disabled
              >
                Private Activity
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              This activity is only visible to friends of the creator
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    )}
  </div>

  {userIsCreator && (
    <div className="flex gap-2">
    <Button
      variant="outline"
      className="bg-blue-100 hover:bg-blue-200 text-blue-600 border-blue-200"
      onClick={() => navigate(`/edit-activity?id=${activity.id}`)}
    >
      Edit Activity
    </Button>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="bg-red-100 hover:bg-red-200 text-red-600 border-red-200"
          >
            Delete Activity
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the activity and remove it from the feed.
              All participants will be notified and the activity chat will be deleted.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteActivity}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Activity"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )}
</CardFooter>

      </Card>
      
      {/* Participants Dialog */}
      <Dialog open={participantsDialogOpen} onOpenChange={setParticipantsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Participants</DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {participants.length > 0 ? (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {participants.map((participant) => (
                    <div 
                      key={participant.id} 
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20"
                    >
                      <Avatar>
                        {participant.photoURL ? (
                          <AvatarImage src={participant.photoURL} alt={participant.name} />
                        ) : null}
                        <AvatarFallback>{getInitials(participant.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {participant.name || `User-${participant.id.substring(0, 5)}`}
                        </p>
                        {participant.id === activity.createdBy.userId && (
                          <p className="text-xs text-muted-foreground">Organizer</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No participants yet</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function ActivityDetails() {
  return (
    <Layout title="Activity Details">
      <ActivityDetailsContent />
    </Layout>
  );
}

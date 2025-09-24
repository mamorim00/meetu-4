// src/components/ActivityCard.tsx

import React, { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  Lock,
  Globe,
  UserPlus,
  Clock, // <-- Import Clock icon for the pending state
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Activity, useActivityStore } from "../utils/activityStore";
import { useUserGuardContext } from "app";
import { toast } from "sonner";
import { useFriendsStore } from "../utils/friendsStore";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import { Edit as EditIcon } from "lucide-react";


interface Props {
  activity: Activity;
}

export const ActivityCard: React.FC<Props> = ({ activity }) => {
  const navigate = useNavigate();
  const { user } = useUserGuardContext();
  
  // Get all necessary functions from the store, including isPending
  const { requestToJoinActivity, leaveActivity, isParticipant, isPending } = useActivityStore();
  const { isFriend, sendFriendRequest } = useFriendsStore();
  
  // A single state for join/leave/request actions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendingFriendRequest, setSendingFriendRequest] = useState(false);

  // The component now fully relies on the 'activity' prop from the store.
  // No more local state or onSnapshot listeners needed here.
  const userIsParticipant = isParticipant(activity.id, user.uid);
  const userIsPending = isPending(activity.id, user.uid); // <-- Check if the user's request is pending
  const userIsCreator = activity.createdBy.userId === user.uid;
  const creatorIsFriend = isFriend(activity.createdBy.userId);
  const canViewActivity = activity.isPublic || userIsCreator || creatorIsFriend;

  const handleSendFriendRequest = async () => {
    if (sendingFriendRequest) return;
    try {
      setSendingFriendRequest(true);
      await sendFriendRequest(user, activity.createdBy.userId);
      toast.success(`Friend request sent to ${activity.createdBy.displayName}!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send friend request");
    } finally {
      setSendingFriendRequest(false);
    }
  };

  // This function now handles both direct joins and requests
  const handleRequestToJoin = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      await requestToJoinActivity(activity.id, user.uid);
      // Show a different message depending on the activity type
      const successMessage = activity.requiresApproval
        ? "Request to join sent!"
        : "You have joined the activity!";
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join activity");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeave = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      await leaveActivity(activity.id, user.uid);
      toast.success("You have left the activity");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to leave activity");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Date and time formatting
  const dateObject = activity.dateTime.toDate();
  const formattedDate = dateObject.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const formattedTime = dateObject.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const timeUntil = formatDistanceToNow(dateObject, { addSuffix: true });

  const getCategoryColorClass = (category: string) => {
    // Your color logic here...
    return "bg-primary/10 text-primary hover:bg-primary/20";
  };
  const categoryBorder = "border-primary/30"; // Your border logic here...

  const viewActivityDetails = () => navigate(`/activity-details?id=${activity.id}`);
  const participantCount = activity.participantIds.length;
  const pendingCount = activity.pendingParticipantIds?.length ?? 0;

  // --- UPDATED ACTION BUTTON LOGIC ---
  const renderActionButton = () => {
    // 1. Creator's view
    if (userIsCreator) {
      return (
        <Button variant="outline" size="sm" className="flex items-center gap-1" onClick={(e) => { e.stopPropagation(); navigate(`/edit-activity?id=${activity.id}`); }}>
          <EditIcon className="h-4 w-4" /> Edit
          {activity.requiresApproval && pendingCount > 0 && (
             <Badge className="ml-2 bg-primary text-primary-foreground">{pendingCount}</Badge>
          )}
        </Button>
      );
    }
    // 2. Participant's view
    if (userIsParticipant) {
      return (
        <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); handleLeave(); }} disabled={isSubmitting}>
          {isSubmitting ? "Leaving..." : "Leave"}
        </Button>
      );
    }
    // 3. Pending user's view <-- THIS IS THE NEW STATE
    if (userIsPending) {
      return (
        <Button variant="outline" size="sm" disabled>
          <Clock className="h-4 w-4 mr-2" />
          Request Sent
        </Button>
      );
    }
    // 4. Non-participant's view
    if (canViewActivity) {
      const isFull = !!activity.maxParticipants && participantCount >= activity.maxParticipants;
      return (
        <Button 
          size="sm" 
          onClick={(e) => { e.stopPropagation(); handleRequestToJoin(); }} 
          disabled={isSubmitting || isFull}
        >
          {isSubmitting 
            ? "Submitting..." 
            : isFull 
            ? "Activity Full" 
            : activity.requiresApproval // <-- THIS IS THE KEY
            ? "Ask to Join"            // <-- If true, show this text
            : "Join Activity"          // <-- If false, show this text
          }
        </Button>
      );
    }
    // 5. User cannot join (private activity)
    return (
      <TooltipProvider>
        <Tooltip><TooltipTrigger asChild><Button size="sm" variant="secondary" disabled>Private</Button></TooltipTrigger><TooltipContent>This activity is private</TooltipContent></Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <Card className={`w-full min-w-0 flex flex-col h-full rounded-3xl overflow-hidden hover:shadow-md transition-all duration-300 cursor-pointer border-2 ${categoryBorder}`} onClick={viewActivityDetails}>
      <div className="flex justify-end pt-4 px-4">
        <Badge className={getCategoryColorClass(activity.category)}>{activity.category}</Badge>
      </div>

      <CardHeader className="p-4 pb-0">
        <div className="flex items-center justify-between w-full min-w-0">
          <CardTitle className="text-xl truncate flex-1">{activity.title}</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><Badge variant="outline" className="ml-2 flex gap-1 items-center flex-shrink-0">{activity.isPublic ? <><Globe className="h-3 w-3" /><span>Public</span></> : <><Lock className="h-3 w-3" /><span>Friends Only</span></>}</Badge></TooltipTrigger>
              <TooltipContent>{activity.isPublic ? "Anyone can see this activity" : "Only friends can see this activity"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription className="mt-1 flex items-center justify-between text-sm w-full min-w-0">
          <span className="truncate">Created by {activity.createdBy.displayName ?? "Unknown"}</span>
          {!userIsCreator && !creatorIsFriend && (
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2 flex-shrink-0" onClick={(e) => { e.stopPropagation(); handleSendFriendRequest(); }} disabled={sendingFriendRequest}>
              <UserPlus className="h-3 w-3 mr-1" />{sendingFriendRequest ? "Sending..." : "Add Friend"}
            </Button>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 flex-grow flex flex-col">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{activity.description}</p>
        <div className="space-y-2 mt-auto">
          <div className="flex items-center text-sm gap-2"><CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span className="truncate">{`${formattedDate} at ${formattedTime}`}</span></div>
          <div className="flex items-center text-sm gap-2"><MapPinIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span className="truncate">{activity.location}</span></div>
          <div className="flex items-center text-sm gap-2"><UsersIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span>{participantCount} participant{participantCount !== 1 && "s"}</span>{activity.maxParticipants && (<span className="text-muted-foreground">(max {activity.maxParticipants})</span>)}</div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex justify-between items-center gap-2">
        <span className="text-xs text-muted-foreground">{timeUntil}</span>
        {renderActionButton()}
      </CardFooter>
    </Card>
  );
};
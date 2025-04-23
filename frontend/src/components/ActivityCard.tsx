// src/components/ActivityCard.tsx

import React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  Lock,
  Globe,
  UserPlus,
  ExternalLink,
  MessageSquare,
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

interface Props {
  activity: Activity;
}

export const ActivityCard: React.FC<Props> = ({ activity }) => {
  const navigate = useNavigate();
  const { user } = useUserGuardContext();
  const { joinActivity, leaveActivity, isParticipant } = useActivityStore();
  const { isFriend, sendFriendRequest } = useFriendsStore();
  const [joining, setJoining] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const [sendingRequest, setSendingRequest] = React.useState(false);

  const userIsParticipant = isParticipant(activity.id, user.uid);
  const userIsCreator = activity.createdBy.userId === user.uid;
  const creatorIsFriend = isFriend(activity.createdBy.userId);
  const canJoinActivity =
    activity.isPublic !== false || userIsCreator || creatorIsFriend;

  const handleSendFriendRequest = async () => {
    if (sendingRequest) return;
    try {
      setSendingRequest(true);
      await sendFriendRequest(user, activity.createdBy.userId);
      toast.success(`Friend request sent to ${activity.createdBy.displayName}!`);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send friend request"
      );
    } finally {
      setSendingRequest(false);
    }
  };

  const handleJoin = async () => {
    if (joining) return;
    try {
      setJoining(true);
      await joinActivity(activity.id, user.uid);
      toast.success("You have joined the activity!");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to join activity"
      );
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (leaving) return;
    try {
      setLeaving(true);
      await leaveActivity(activity.id, user.uid);
      toast.success("You have left the activity");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to leave activity"
      );
    } finally {
      setLeaving(false);
    }
  };

  // Convert dateTime
  const dateObject =
    activity.dateTime instanceof Timestamp
      ? activity.dateTime.toDate()
      : new Date(activity.dateTime);
  const formattedDate = dateObject.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = dateObject.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const timeUntil = formatDistanceToNow(dateObject, { addSuffix: true });

  const getCategoryColorClass = (category: string) => {
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
  };

  const categoryBorder = (() => {
    switch (activity.category) {
      case "Sports":
        return "border-primary/30";
      case "Dining":
        return "border-secondary/30";
      case "Hiking":
        return "border-accent/30";
      case "Gaming":
        return "border-muted/30";
      case "Movies":
        return "border-secondary/30";
      case "Travel":
        return "border-primary/30";
      case "Music":
        return "border-muted/30";
      case "Cooking":
        return "border-accent/30";
      default:
        return "border-primary/30";
    }
  })();

  const viewActivityDetails = () =>
    navigate(`/activity-details?id=${activity.id}`);

  return (
    <Card
      className={`
        w-full min-w-0 flex flex-col h-full rounded-3xl
        overflow-hidden hover:shadow-md transition-all duration-300
        cursor-pointer border-2 ${categoryBorder}
      `}
      onClick={viewActivityDetails}
    >
      {/* Category Badge */}
      <div className="flex justify-end pt-4 px-4">
        <Badge className={getCategoryColorClass(activity.category)}>
          {activity.category}
        </Badge>
      </div>

      {/* Title & Public/Private */}
      <CardHeader className="p-4 pb-0">
        <div className="flex items-center justify-between w-full min-w-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <CardTitle className="text-xl truncate flex-1">
              {activity.title}
            </CardTitle>
            <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="ml-2 flex gap-1 items-center flex-shrink-0"
                >
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
                  ? "Anyone can see this activity"
                  : "Only the creator and their friends can see this activity"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <CardDescription className="mt-1 flex items-center justify-between text-sm w-full min-w-0">
          <span className="truncate">
            Created by {activity.createdBy.displayName ?? "Unknown User"}
          </span>
          {!userIsCreator && !creatorIsFriend && activity.isPublic === false && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                handleSendFriendRequest();
              }}
              disabled={sendingRequest}
            >
              <UserPlus className="h-3 w-3 mr-1" />
              {sendingRequest ? "Sending..." : "Add Friend"}
            </Button>
          )}
        </CardDescription>
      </CardHeader>

      {/* Description & Meta */}
      <CardContent className="p-4 flex-grow flex flex-col">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
          {activity.description}
        </p>
        <div className="space-y-2">
          <div className="flex items-center text-sm gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{`${formattedDate} at ${formattedTime}`}</span>
          </div>
          <div className="flex items-center text-sm gap-2">
            <MapPinIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{activity.location}</span>
          </div>
          <div className="flex items-center text-sm gap-2">
            <UsersIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span>
              {activity.participantIds.length} participant
              {activity.participantIds.length !== 1 && "s"}
            </span>
            {activity.maxParticipants && (
              <span className="text-muted-foreground">
                (max {activity.maxParticipants})
              </span>
            )}
          </div>
        </div>
      </CardContent>

      {/* Footer: Time until + Join/Leave */}
      <CardFooter className="p-4 pt-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{timeUntil}</span>
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-auto text-xs text-primary flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              viewActivityDetails();
            }}
          >
            View details
          </Button>
        </div>
        {userIsParticipant ? (
          <Button
            variant="outline"
            className="rounded-full bg-red-100 hover:bg-red-200 text-red-600 border-red-200"
            onClick={(e) => {
              e.stopPropagation();
              handleLeave();
            }}
            disabled={leaving}
          >
            {leaving ? "Leaving..." : "Leave Activity"}
          </Button>
        ) : canJoinActivity ? (
          <Button
            className="rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              handleJoin();
            }}
            disabled={
              joining ||
              (!!activity.maxParticipants &&
                activity.participantIds.length >= activity.maxParticipants)
            }
          >
            {joining
              ? "Joining..."
              : activity.maxParticipants &&
                activity.participantIds.length >= activity.maxParticipants
              ? "Activity Full"
              : "Join Activity"}
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
        )}
      </CardFooter>
    </Card>
  );
};

import React from "react";
import { formatDistanceToNow } from "date-fns";
import { CalendarIcon, MapPinIcon, UsersIcon, Lock, Globe, UserPlus, ExternalLink, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, useActivityStore } from "../utils/activityStore";
import { useUserGuardContext } from "app";
import { toast } from "sonner";
import { useFriendsStore } from "../utils/friendsStore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { Timestamp } from 'firebase/firestore';


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
  
  // Check if current user is a participant
  const userIsParticipant = isParticipant(activity.id, user.uid);
  const userIsCreator = activity.createdBy.userId === user.uid;
  
  // Check if creator is a friend of the current user
  const creatorIsFriend = isFriend(activity.createdBy.userId);
  
  // Determine if the user can join the activity
  const canJoinActivity = activity.isPublic !== false || userIsCreator || creatorIsFriend;
  
  // Handle sending friend request
  const handleSendFriendRequest = async () => {
    if (sendingRequest) return;
    
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
  };
  
  
  // Handle joining activity
  const handleJoin = async () => {
    if (joining) return;
    
    try {
      setJoining(true);
      await joinActivity(activity.id, user.uid);
      toast.success("You have joined the activity!");
    } catch (error) {
      console.error("Error joining activity:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to join activity";
      toast.error(errorMessage);
    } finally {
      setJoining(false);
    }
  };
  
  // Handle leaving activity
  const handleLeave = async () => {
    if (leaving) return;
    
    try {
      setLeaving(true);
      await leaveActivity(activity.id, user.uid);
      toast.success("You have left the activity");
    } catch (error) {
      console.error("Error leaving activity:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to leave activity";
      toast.error(errorMessage);
    } finally {
      setLeaving(false);
    }
  };

  let dateObject: Date;

  if (activity.dateTime instanceof Timestamp) {
    // If it's a Firebase Timestamp, convert it to a JS Date object
    dateObject = activity.dateTime.toDate();
  } else {
    // If it's a string or number, pass it to the Date constructor
    // new Date() can parse standard date strings and numeric timestamps
    dateObject = new Date(activity.dateTime);
  }
  
  // Now use the native Date object (dateObject) to format the date
  const formattedDate = dateObject.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  
  // Use the native Date object (dateObject) to format the time
  const formattedTime = dateObject.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  
  // Use the native Date object (dateObject) to calculate how long until the event
  const timeUntil = formatDistanceToNow(dateObject, { addSuffix: true });
  

  // Get category color class based on category
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

  // Navigate to activity details page
  const viewActivityDetails = () => {
    navigate(`/activity-details?id=${activity.id}`);
  };
  
  return (
    <Card 
      className={`overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col h-full rounded-3xl cursor-pointer ${activity.category === "Sports" ? "border-primary/30" : 
                activity.category === "Dining" ? "border-secondary/30" :
                activity.category === "Hiking" ? "border-accent/30" :
                activity.category === "Gaming" ? "border-muted/30" :
                activity.category === "Movies" ? "border-secondary/30" :
                activity.category === "Travel" ? "border-primary/30" :
                activity.category === "Music" ? "border-muted/30" :
                activity.category === "Cooking" ? "border-accent/30" : "border-primary/30"}`} 
      style={{ borderWidth: '2px' }}
      onClick={viewActivityDetails}
    >
      <div className="flex justify-end pt-4 px-4">
        <Badge className={`${getCategoryColorClass(activity.category)}`}>
          {activity.category}
        </Badge>
      </div>
      
      <CardHeader className="p-4 pb-0">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl">{activity.title}</CardTitle>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="ml-2 flex gap-1 items-center">
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
        <CardDescription className="text-sm mt-1 flex items-center justify-between">
          <span>Created by {activity.createdBy.displayName || activity.createdBy.userId.substring(0, 5) || 'Unknown User'}</span>
          {!userIsCreator && !creatorIsFriend && activity.isPublic === false && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-7 px-2"
              onClick={handleSendFriendRequest}
              disabled={sendingRequest}
            >
              <UserPlus className="h-3 w-3 mr-1" />
              {sendingRequest ? "Sending..." : "Add Friend"}
            </Button>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4 flex-grow">
        <p className="text-sm text-muted-foreground mb-4">{activity.description}</p>
        
        <div className="space-y-2">
          <div className="flex items-center text-sm">
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>{formattedDate} at {formattedTime}</span>
          </div>
          
          <div className="flex items-center text-sm">
            <MapPinIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>{activity.location}</span>
          </div>
          
          <div className="flex items-center text-sm">
            <UsersIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>{activity.participantIds.length} participants</span>
            {activity.maxParticipants && (
              <span className="text-muted-foreground"> (max {activity.maxParticipants})</span>
            )}
          </div>
          
         
        </div>
      </CardContent>
      
      <CardFooter className="p-4 pt-0 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">{timeUntil}</p>
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-0 h-auto text-xs text-primary"
            onClick={(e) => {
              e.stopPropagation(); // Prevent card click propagation
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
            onClick={handleLeave}
            disabled={leaving}
          >
            {leaving ? "Leaving..." : "Leave Activity"}
          </Button>
        ) : canJoinActivity ? (
          <Button 
            className="rounded-full"
            onClick={handleJoin}
            disabled={joining || (activity.maxParticipants && activity.participantIds.length >= activity.maxParticipants)}
          >
            {joining ? "Joining..." : (activity.maxParticipants && activity.participantIds.length >= activity.maxParticipants) 
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







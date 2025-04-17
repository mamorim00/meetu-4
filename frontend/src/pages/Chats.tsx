import React, { useEffect, useState } from "react";
import { Layout } from "components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserGuardContext } from "app";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { firestore } from "../utils/firebase";
import { Activity } from "../types";
import { MessageSquare, Users, MapPin, Calendar, ChevronRight, Loader2 } from "lucide-react";
import { formatDate } from "../utils/formatDate";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useChatStore } from "../utils/chatStore";

export default function Chats() {
  const { user } = useUserGuardContext();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { unreadCounts, markChatAsRead } = useChatStore();

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        if (!user) return;
  
        setLoading(true);
        setError(null);
  
        const activitiesRef = collection(firestore, "activities");
        // If you already use a "lastMessageTimestamp" field, you can order in the query:
        // const activitiesQuery = query(activitiesRef, where("participantIds", "array-contains", user.uid), orderBy("lastMessageTimestamp", "desc"));
        // For demonstration, we fetch without ordering and sort locally:
        const activitiesQuery = query(activitiesRef, where("participantIds", "array-contains", user.uid));
        const querySnapshot = await getDocs(activitiesQuery);
  
        const fetchedActivities = [];
        querySnapshot.forEach((doc) => {
          fetchedActivities.push({ id: doc.id, ...doc.data() });
        });
  
        // Sort activities by lastMessageTimestamp (if available), falling back to dateTime
        fetchedActivities.sort((a, b) => {
          const timeA = a.lastMessageTimestamp || a.dateTime || 0;
          const timeB = b.lastMessageTimestamp || b.dateTime || 0;
          return timeB - timeA;
        });
        setActivities(fetchedActivities);
      } catch (err) {
        console.error("Error fetching activities:", err);
        setError(err instanceof Error ? err : new Error("Error fetching activities"));
      } finally {
        setLoading(false);
      }
    };
  
    fetchActivities();
  }, [user]);
  

  const handleOpenChat = (activity: Activity) => {
    markChatAsRead(activity.id);
    navigate(`/chat-detail?activityId=${activity.id}&activityName=${encodeURIComponent(activity.title)}`);
  };

  return (
    <Layout>
      <div className="container max-w-4xl py-6">
        <div className="space-y-2 mb-6">
          <h1 className="text-3xl font-bold">Chats</h1>
          <p className="text-muted-foreground">Chat with participants in your activities</p>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary/70" />
          </div>
        ) : error ? (
          <Card className="border shadow-sm">
            <CardContent className="py-10 text-center">
              <div className="mx-auto bg-destructive/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="font-medium mb-2">Error Loading Chats</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {error.message || "We couldn't load your activity chats. Please try again."}
              </p>
              <Button onClick={() => window.location.reload()}>Retry</Button>
            </CardContent>
          </Card>
        ) : activities.length === 0 ? (
          <Card className="border shadow-sm">
            <CardContent className="py-10 text-center">
              <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-primary/70" />
              </div>
              <h3 className="font-medium mb-2">No Chat Activities</h3>
              <p className="text-muted-foreground text-sm mb-4">
                You haven't joined any activities yet. Join an activity to start chatting with other participants.
              </p>
              <Button onClick={() => navigate("/")}>Browse Activities</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Your Activity Chats</h2>
            
            <div className="grid gap-4">
              {activities.map((activity) => (
                <Card 
                  key={activity.id} 
                  className="overflow-hidden border shadow-sm hover:shadow transition-all duration-200 cursor-pointer"
                  onClick={() => handleOpenChat(activity)}
                >
                  <CardContent className="p-0">
                    <div className="p-4 flex items-center gap-4">
                      <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center">
                        <MessageSquare className="h-6 w-6 text-primary/70" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{activity.title}</h3>
                          {unreadCounts[activity.id] > 0 && (
                              <Badge variant="default">
                                {unreadCounts[activity.id] === 1
                                  ? "1 new message"
                                  : `${unreadCounts[activity.id]} new messages`}
                              </Badge>
                            )}
                        </div>
                        
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Users className="h-3 w-3 mr-1" />
                            {activity.participantIds?.length || 1} participant{(activity.participantIds?.length || 1) !== 1 ? 's' : ''}
                          </div>
                          
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(activity.dateTime)}
                          </div>
                          
                          <div className="flex items-center text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 mr-1" />
                            {activity.location || "No location"}
                          </div>
                        </div>
                      </div>
                      
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
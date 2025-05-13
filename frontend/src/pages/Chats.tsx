import React, { useEffect, useState, useMemo } from "react"; // Added useMemo
import { Layout } from "components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Removed unused imports
import { useUserGuardContext } from "app";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, orderBy, Timestamp as FirestoreTimestamp } from "firebase/firestore"; // Import orderBy and Timestamp
import { firestore } from "../utils/firebase";
// Removed Activity type import from types, defined inline or ensure it matches Firestore data
import { MessageSquare, Users, MapPin, Calendar, ChevronRight, Loader2 } from "lucide-react";
import { formatDate } from "../utils/formatDate"; // Ensure this utility exists and works
import { Badge } from "@/components/ui/badge";
// Removed Separator import as it wasn't used
import { useChatStore } from "../utils/chatStore";

// Define Activity type based on expected Firestore structure
interface Activity {
  id: string;
  title: string;
  participantIds: string[];
  // Assuming dateTime is stored as Firestore Timestamp, adjust if it's number (milliseconds)
  dateTime?: FirestoreTimestamp;
  location?: string;
  // This is the crucial field for ordering
  lastMessageTimestamp?: FirestoreTimestamp;
  // Add any other fields present in your Firestore 'activities' documents
  // e.g., description, creatorId, etc.
}

export default function Chats() {
  const { user } = useUserGuardContext();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { unreadCounts, markChatAsRead } = useChatStore(state => ({
    unreadCounts: state.unreadCounts,
    markChatAsRead: state.markChatAsRead,
  }));

  useEffect(() => {
    if (user === undefined) {
      console.log('%cDEBUG: Chats.tsx useEffect - Auth not yet initialized. Skipping fetch.', 'color: gray;');
      return;
    }
    if (user === null) {
      console.log('%cDEBUG: Chats.tsx useEffect - User is signed out. Clearing list.', 'color: orange;');
      setActivities([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    const fetchActivities = async () => {
      console.log('%cDEBUG: Chats.tsx useEffect - Fetching activities for', user.uid, 'START', 'color: magenta; font-weight: bold;');
      setLoading(true);
      setError(null);

      try {
        const activitiesRef = collection(firestore, "activities");
        const activitiesQuery = query(
          activitiesRef,
          where("participantIds", "array-contains", user.uid),
          orderBy("lastMessageTimestamp", "desc")
        );

        const querySnapshot = await getDocs(activitiesQuery);

        if (signal.aborted) {
          console.log('%cDEBUG: Chats.tsx useEffect - Fetch aborted mid-flight.', 'color: orange;');
          return;
        }

        console.log(`%cDEBUG: Chats.tsx useEffect - Query returned ${querySnapshot.size} docs.`, 'color: magenta;');

        const fetched: Activity[] = [];
        querySnapshot.forEach(doc => {
          const d = doc.data();
          fetched.push({
            id: doc.id,
            title: d.title || "Untitled Activity",
            participantIds: d.participantIds || [],
            dateTime: d.dateTime,
            location: d.location,
            lastMessageTimestamp: d.lastMessageTimestamp,
          });
        });

        setActivities(fetched);
      } catch (err: any) {
        if (err.code === 'permission-denied') {
          console.warn('%cDEBUG: Chats.tsx useEffect - Permission denied while fetching; will retry on next auth change.', 'color: orange;');
        } else if (signal.aborted) {
          console.log('%cDEBUG: Chats.tsx useEffect - Aborted with error.', 'color: orange;');
        } else {
          console.error('%cDEBUG: Chats.tsx useEffect - Unexpected error:', 'color: red;', err);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!signal.aborted) {
          console.log('%cDEBUG: Chats.tsx useEffect - Fetch END. loading=false', 'color: magenta;');
          setLoading(false);
        }
      }
    };

    fetchActivities();

    return () => {
      console.log('%cDEBUG: Chats.tsx useEffect - Cleanup, aborting fetch.', 'color: orange;');
      controller.abort();
    };
  }, [user]);

  const handleOpenChat = (activity: Activity) => {
    console.log(`%cDEBUG: handleOpenChat - Opening chat for Activity ID: ${activity.id}, Title: ${activity.title}`, 'color: teal;');
    markChatAsRead(activity.id);
    navigate(`/chat-detail?activityId=${activity.id}&activityName=${encodeURIComponent(activity.title)}`);
  };

  const renderFormattedDate = (timestamp: FirestoreTimestamp | string | undefined): string => {
    try {
      if (!timestamp) return "No Date";
  
      const date =
        typeof timestamp === "string"
          ? new Date(timestamp)
          : typeof timestamp.toDate === "function"
          ? timestamp.toDate()
          : new Date(); // fallback
  
      return formatDate(date);
    } catch (e) {
      console.error("Error formatting date:", e, timestamp);
      return "Invalid Date";
    }
  };
  

  const memoizedActivities = useMemo(() => activities, [activities]);

  console.log('%cDEBUG: Chats.tsx RENDER - Component rendering.', 'color: purple;', { loading, error: error?.message, activityCount: activities.length, memoizedCount: memoizedActivities.length, unreadCounts });

  return (
    <Layout>
      <div className="container max-w-4xl py-6 mx-auto px-4">
        <div className="space-y-2 mb-6">
          <h1 className="text-3xl font-bold">Chats</h1>
          <p className="text-muted-foreground">Chat with participants in your activities</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary/70" />
            <p className="ml-4 text-muted-foreground">Loading chats...</p>
          </div>
        ) : error ? (
          <Card className="border shadow-sm border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" /> Error Loading Chats
              </CardTitle>
            </CardHeader>
            <CardContent className="py-6 text-center">
              <p className="text-muted-foreground text-sm mb-4">
                {error.message || "We couldn't load your activity chats. Please try refreshing the page."}
              </p>
              <Button variant="destructive" onClick={() => window.location.reload()}>Retry</Button>
            </CardContent>
          </Card>
        ) : memoizedActivities.length === 0 ? (
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2 text-primary/70" /> No Chat Activities
              </CardTitle>
            </CardHeader>
            <CardContent className="py-10 text-center">
              <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-primary/70" />
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                You haven't joined or created any activities with chats yet.
              </p>
              <Button onClick={() => navigate("/")}>Browse Activities</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4">
              {memoizedActivities.map((activity) => {
                const unreadCount = unreadCounts[activity.id] || 0;
                return (
                  <Card
                    key={activity.id}
                    className={`overflow-hidden border shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${unreadCount > 0 ? 'border-primary' : ''}`}
                    onClick={() => handleOpenChat(activity)}
                  >
                    <CardContent className="p-0">
                      <div className="p-4 flex items-start sm:items-center gap-4">
                        <div className="bg-primary/10 w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center mt-1 sm:mt-0">
                          <MessageSquare className="h-6 w-6 text-primary/70" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-medium truncate text-lg">{activity.title}</h3>
                            {unreadCount > 0 && (
                              <Badge variant="default" className="flex-shrink-0">
                                {unreadCount} new
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <div className="flex items-center">
                              <Users className="h-3 w-3 mr-1 flex-shrink-0" />
                              {activity.participantIds?.length || 0} participant{(activity.participantIds?.length || 0) !== 1 ? 's' : ''}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                              Activity Date: {renderFormattedDate(activity.dateTime)}
                            </div>
                            {activity.location && (
                              <div className="flex items-center">
                                <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                                {activity.location}
                              </div>
                            )}
                            <div className="flex items-center text-blue-600 dark:text-blue-400">
                              <ChevronRight className="h-3 w-3 mr-1 flex-shrink-0" />
                              Last Message: {renderFormattedDate(activity.lastMessageTimestamp) || "Not yet"}
                            </div>
                          </div>
                        </div>
                        <div className="ml-auto flex-shrink-0 self-center">
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityCard } from "components/ActivityCard";
import { Layout } from "components/Layout";
import { useActivityStore } from "../utils/activityStore";
import { useUserGuardContext } from "app";
import { useFriendsStore } from "../utils/friendsStore";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type ActivityCategory = 
  | "All"
  | "Sports"
  | "Dining"
  | "Hiking"
  | "Gaming"
  | "Movies"
  | "Travel"
  | "Music"
  | "Cooking";


// Activity feed page component
export default function Feed() {
  const [activeCategory, setActiveCategory] = useState<ActivityCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFriendsOnly, setShowFriendsOnly] = useState(false);
  const [showPrivateActivities, setShowPrivateActivities] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"upcoming" | "archive">("upcoming");
  const { user } = useUserGuardContext();
  const { activities, isLoading, error, initializeListener } = useActivityStore();
  const { friends, isFriend } = useFriendsStore();
  
  // Initialize the activities listener when component mounts or filter changes
  useEffect(() => {
    // Initialize activities listener - we'll filter in the component
    const unsubscribe = initializeListener(user.uid);
    return () => unsubscribe(); // Clean up listener when component unmounts
  }, [initializeListener, user.uid]);

  // Filter activities based on time (upcoming vs archive)
  const timeFilteredActivities = useMemo(() => {
    const now = new Date();
    
    return activities.filter(activity => {
      // Parse the activity date
      const activityDate = new Date(activity.dateTime);
      
      // Check if the activity is in the future or past
      if (timeFilter === "upcoming") {
        return activityDate >= now;
      } else { // "archive"
        return activityDate < now;
      }
    });
  }, [activities, timeFilter]);
  
  // Filter activities based on active category, search query, privacy settings, and friends filter
  const filteredActivities = timeFilteredActivities.filter((activity) => {
    // Filter by category
    const matchesCategory = activeCategory === "All" || activity.category === activeCategory;
    
    // Filter by search query
    const matchesSearch = 
      searchQuery === "" || 
      activity.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      activity.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
      activity.location.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Privacy checks - activity is shown if:
    // 1. It's the user's own activity
    const isOwnActivity = activity.createdBy.userId === user.uid;
    
    // 2. It's a public activity
    const isPublic = activity.isPublic !== false; // Default to true for backward compatibility
    
    // 3. It's a private activity, but creator is a friend
    const creatorIsFriend = isFriend(activity.createdBy.userId);
    const isPrivateFriendsActivity = !isPublic && creatorIsFriend;
    
    // Determine if the activity should be shown based on privacy settings
    // Show all if private activities are included, otherwise only show public ones unless they're own or from friends
    const isVisibleBasedOnPrivacy = 
      isOwnActivity || // Always show user's own activities
      isPublic || // Show public activities
      (showPrivateActivities && isPrivateFriendsActivity); // Show private activities from friends if toggle is on
    
    // Apply friends-only filter if enabled - show only activities from friends and own activities
    const matchesFriendshipFilter = 
      !showFriendsOnly || // If filter not enabled, show all
      isOwnActivity || // Always include user's own activities
      (creatorIsFriend); // Only include friends' activities if filter enabled
    
    return matchesCategory && matchesSearch && isVisibleBasedOnPrivacy && matchesFriendshipFilter;
  });

  return (
    <Layout title="Activity Feed">
      <div className="container mx-auto max-w-7xl px-6 pt-2">
          {/* Timeline filter tabs */}
          <div className="mb-6">
            <Tabs defaultValue="upcoming" className="w-full" onValueChange={(value) => setTimeFilter(value as "upcoming" | "archive")}>
              <TabsList className="w-[400px] grid grid-cols-2 h-auto">
                <TabsTrigger value="upcoming" className="rounded-full m-1">Upcoming Activities</TabsTrigger>
                <TabsTrigger value="archive" className="rounded-full m-1">Archive</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          {/* Search and filter section */}
            <div className="mb-8 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                type="text"
                placeholder="Search activities..."
                className="rounded-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Switch
                  id="show-friends"
                  checked={showFriendsOnly}
                  onCheckedChange={setShowFriendsOnly}
                />
                <Label htmlFor="show-friends" className="text-sm cursor-pointer">
                  Friends only
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-private"
                  checked={showPrivateActivities}
                  onCheckedChange={setShowPrivateActivities}
                />
                <Label htmlFor="show-private" className="text-sm cursor-pointer">
                  Include private activities
                </Label>
              </div>
              <Button
                variant="outline"
                className="rounded-full sm:w-auto w-full"
                onClick={() => setSearchQuery("")}
              >
                Clear
              </Button>
            </div>
            
            {/* Activity category tabs */}
            <Tabs defaultValue="All" className="w-full" onValueChange={(value) => setActiveCategory(value as ActivityCategory)}>
              <TabsList className="grid grid-cols-3 md:grid-cols-9 h-auto bg-muted/20">
                <TabsTrigger value="All" className="rounded-full m-1">All</TabsTrigger>
                <TabsTrigger value="Sports" className="rounded-full m-1">Sports</TabsTrigger>
                <TabsTrigger value="Dining" className="rounded-full m-1">Dining</TabsTrigger>
                <TabsTrigger value="Hiking" className="rounded-full m-1">Hiking</TabsTrigger>
                <TabsTrigger value="Gaming" className="rounded-full m-1">Gaming</TabsTrigger>
                <TabsTrigger value="Movies" className="rounded-full m-1">Movies</TabsTrigger>
                <TabsTrigger value="Travel" className="rounded-full m-1">Travel</TabsTrigger>
                <TabsTrigger value="Music" className="rounded-full m-1">Music</TabsTrigger>
                <TabsTrigger value="Cooking" className="rounded-full m-1">Cooking</TabsTrigger>
              </TabsList>

              {/* Content for all tabs */}
              <TabsContent value="All" className="mt-6">
                {isLoading ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Loading activities...</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredActivities.map((activity) => (
                        <ActivityCard key={activity.id} activity={activity} />
                      ))}
                    </div>
                    {filteredActivities.length === 0 && (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">No activities found. Try adjusting your filters.</p>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
              
              {/* Duplicate content for other tabs - they'll show the same filtered content */}
              {["Sports", "Dining", "Hiking", "Gaming", "Movies", "Travel", "Music", "Cooking"].map((category) => (
                <TabsContent key={category} value={category} className="mt-6">
                  {isLoading ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Loading activities...</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredActivities.map((activity) => (
                          <ActivityCard key={activity.id} activity={activity} />
                        ))}
                      </div>
                      {filteredActivities.length === 0 && (
                        <div className="text-center py-12">
                          <p className="text-muted-foreground">No activities found. Try adjusting your filters.</p>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
      </div>
    </Layout>
  );
}
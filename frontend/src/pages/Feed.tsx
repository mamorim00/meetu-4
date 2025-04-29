

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ActivityCard } from "components/ActivityCard";
import { Layout } from "components/Layout";
import { useActivityStore } from "../utils/activityStore";
import { useUserGuardContext } from "app";
import { useFriendsStore } from "../utils/friendsStore";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import LocationAutocomplete from "components/LocationAutocomplete";
import { Timestamp } from "firebase/firestore";



// Haversine formula to compute distance between two lat/lng points in km
function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

export default function Feed() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFriendsOnly, setShowFriendsOnly] = useState(false);

  const [cityQuery, setCityQuery] = useState("");
  const [center, setCenter] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(10);

  const [timeFilter, setTimeFilter] = useState<"upcoming" | "archive">("upcoming");
  const [activeCategory, setActiveCategory] = useState<ActivityCategory>("All");

  const { user } = useUserGuardContext();
  const { activities, isLoading, initializeListener } = useActivityStore();
  const { isFriend } = useFriendsStore();

  useEffect(() => {
    const unsub = initializeListener(user.uid);
    return () => unsub();
  }, [initializeListener, user.uid]);


  const timeFiltered = useMemo(() => {
    const now = new Date();
    return activities.filter(act => {
      // pick the right Date
      const when =
        act.dateTime instanceof Timestamp
          ? act.dateTime.toDate()
          : new Date(act.dateTime);
  
      return timeFilter === "upcoming"
        ? when >= now
        : when < now;
    });
  }, [activities, timeFilter]);

  const filteredActivities = timeFiltered.filter(activity => {
    const q = searchQuery.toLowerCase();
    if (
      q &&
      !activity.title.toLowerCase().includes(q) &&
      !activity.description.toLowerCase().includes(q) &&
      !activity.location.toLowerCase().includes(q)
    ) return false;

    const isOwn = activity.createdBy.userId === user.uid;
    const isPublic = activity.isPublic !== false;
    const creatorIsFriend = isFriend(activity.createdBy.userId);
    if (!(isOwn || isPublic || creatorIsFriend)) return false;
    if (showFriendsOnly && !(isOwn || creatorIsFriend)) return false;

    if (center) {
      const dist = getDistance(center.lat, center.lng, activity.latitude, activity.longitude);
      if (dist > radiusKm) return false;
    }

    if (activeCategory !== "All" && activity.category !== activeCategory) return false;

    return true;
  });

  return (
    <Layout title="Activity Feed">
      <div className="container mx-auto max-w-7xl px-6 pt-4 space-y-6">

        {/* Near‑Me Filter (always visible) */}
        <div className="flex flex-col sm:flex-row gap-4">
          <LocationAutocomplete
            value={cityQuery}
            onChange={setCityQuery}
            onSelect={({ formatted, lat, lng }) => {
              setCityQuery(formatted);
              setCenter({ name: formatted, lat, lng });
            }}
            placeholder="Filter by city..."
          />
          <Input
            type="number"
            placeholder="Radius (km)"
            className="w-32"
            value={radiusKm}
            min={1}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
          />
          <Button
            variant="outline"
            onClick={() => {
              setCityQuery("");
              setCenter(null);
            }}
          >
            Clear location
          </Button>
        </div>

        {/* More Filters Accordion */}
        <Accordion type="single" collapsible>
          <AccordionItem value="moreFilters">
            <AccordionTrigger className="bg-muted/20 rounded-t-md px-4 py-2">
              More Filters
            </AccordionTrigger>
            <AccordionContent className="space-y-6 p-4 bg-muted/10 rounded-b-md">
              
              {/* Search & Friends Toggle */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Input
                  placeholder="Search activities..."
                  className="flex-1 rounded-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Switch checked={showFriendsOnly} onCheckedChange={setShowFriendsOnly} id="friends-only" />
                  <Label htmlFor="friends-only" className="cursor-pointer">Friends only</Label>
                </div>
                <Button variant="outline" onClick={() => setSearchQuery("")}>
                  Clear search
                </Button>
              </div>

              {/* Time Tabs */}
              <Tabs
                value={timeFilter}
                onValueChange={(v) => setTimeFilter(v as "upcoming" | "archive")}
                className="w-full"
              >
                <TabsList className="w-[360px] grid grid-cols-2">
                  <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                  <TabsTrigger value="archive">Archive</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Category Tabs */}
              <Tabs
                value={activeCategory}
                onValueChange={(v) => setActiveCategory(v as ActivityCategory)}
                className="w-full"
              >
                <TabsList className="grid grid-cols-3 md:grid-cols-9 bg-muted/20 rounded-md p-1">
                  {["All", "Sports", "Dining", "Hiking", "Gaming", "Movies", "Travel", "Music", "Cooking"].map(cat => (
                    <TabsTrigger key={cat} value={cat} className="m-1 rounded-full">
                      {cat}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Activity Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading activities...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredActivities.map(act => (
              <ActivityCard key={act.id} activity={act} />
            ))}
            {filteredActivities.length === 0 && (
              <div className="text-center py-12 col-span-full">
                <p className="text-muted-foreground">
                  No activities found. Try adjusting your filters.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
import React, { useEffect, useMemo, useState } from "react";
import { Layout } from "components/Layout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityCard } from "components/ActivityCard";
import { useActivityStore } from "../utils/activityStore";
import { useUserGuardContext } from "app";
import { Timestamp } from "firebase/firestore";

export default function MyActivities() {
  const { user } = useUserGuardContext();
  const { activities, isLoading, initializeListener } = useActivityStore();

  // Time‑filter state (just like Feed)
  const [timeFilter, setTimeFilter] = useState<"upcoming" | "archive">("upcoming");

  // Subscribe once on mount
  useEffect(() => {
    if (!user.uid) return;
    const unsub = initializeListener(user.uid, /* friends: */ [], /* friendsOnly: */ false);
    return () => unsub();
  }, [user.uid, initializeListener]);

  // First: split upcoming vs archive
  const timeFiltered = useMemo(() => {
    const now = new Date();
    return activities.filter(act => {
      const when = act.dateTime instanceof Timestamp
        ? act.dateTime.toDate()
        : new Date(act.dateTime);
      return timeFilter === "upcoming" ? when >= now : when < now;
    });
  }, [activities, timeFilter]);

  // Then: only keep the ones **I** created
  const myActivities = useMemo(
    () => timeFiltered.filter(act => act.createdBy.userId === user.uid),
    [timeFiltered, user.uid]
  );

  return (
    <Layout>
      <div className="container mx-auto max-w-7xl px-6 pt-4 space-y-6">
        <h1 className="text-2xl font-bold">My Activities</h1>

        {/* Time Tabs */}
        <Tabs
          value={timeFilter}
          onValueChange={(v) => setTimeFilter(v as "upcoming" | "archive")}
          className="w-full"
        >
          <TabsList className="w-[360px] grid grid-cols-2 mb-4">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="archive">Archive</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Activity Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading your activities…</p>
          </div>
        ) : myActivities.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              You haven’t {timeFilter === "upcoming" ? "scheduled" : "archived"} any activities.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {myActivities.map((act) => (
              <ActivityCard key={act.id} activity={act} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

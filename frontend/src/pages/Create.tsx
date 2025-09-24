// src/pages/Create.tsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "components/Layout";
import { useUserGuardContext } from "app";
import { useActivityStore, NewActivity } from "../utils/activityStore"; // Import NewActivity type
import { toast } from "sonner";
import LocationAutocomplete from "components/LocationAutocomplete";
import { Timestamp } from "firebase/firestore"; // <-- 1. Import Timestamp

// UI components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ActivityCategory } from "./Feed";

export const activityCategories: ActivityCategory[] = [
  "Sports",
  "Dining",
  "Hiking",
  "Gaming",
  "Movies",
  "Travel",
  "Music",
  "Cooking",
  "Hangout",
];

export default function Create() {
  const navigate = useNavigate();
  const { user } = useUserGuardContext();
  const { createActivity } = useActivityStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    latitude: null as number | null,
    longitude: null as number | null,
    dateTime: "",
    category: "" as ActivityCategory,
    maxParticipants: "" as string | number,
    isPublic: true,
    requiresApproval: false, // Added requiresApproval to form state
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    // Handle checkbox for requiresApproval
    const isCheckbox = type === 'checkbox';
    // @ts-ignore
    const val = isCheckbox ? e.target.checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const handleSelectChange = (name: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const {
      title,
      description,
      location,
      latitude,
      longitude,
      dateTime,
      category,
    } = formData;
    if (
      !title || !description || !location || latitude == null || longitude == null || !dateTime || !category
    ) {
      toast.error(
        latitude == null || longitude == null
          ? "Please select a location from the suggestions"
          : "Please fill in all required fields"
      );
      return;
    }

    try {
      setIsSubmitting(true);

      // --- FIX IS HERE ---
      // 2. Convert the dateTime string to a Firestore Timestamp object
      const firestoreTimestamp = Timestamp.fromDate(new Date(dateTime));

      const newActivity: NewActivity = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        latitude,
        longitude,
        dateTime: firestoreTimestamp, // <-- 3. Use the Timestamp object
        category,
        createdBy: {
          userId: user.uid,
          displayName: user.displayName || "Anonymous",
        },
        maxParticipants: formData.maxParticipants ? Number(formData.maxParticipants) : undefined,
        isPublic: formData.isPublic,
        requiresApproval: formData.requiresApproval,
      };

      await createActivity(newActivity);

      toast.success("Activity created successfully!");
      navigate("/feed");
    } catch (error) {
      console.error("Error creating activity:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create activity");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <Card className="bg-card shadow-sm border-border/40">
          <CardHeader>
            <CardTitle className="text-2xl">Create New Activity</CardTitle>
            <CardDescription>
              Fill in the details to create a new activity for others to join
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {/* Title, Description, Category, Location... */}
              <div className="space-y-2">
                <Label htmlFor="title">Activity Title *</Label>
                <Input id="title" name="title" placeholder="What's the activity called?" value={formData.title} onChange={handleChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea id="description" name="description" placeholder="Tell people more about this activity..." rows={3} value={formData.description} onChange={handleChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={formData.category} onValueChange={(val) => handleSelectChange("category", val)} required>
                  <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>{activityCategories.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <LocationAutocomplete value={formData.location} onChange={(loc) => setFormData((prev) => ({ ...prev, location: loc }))} onSelect={({ formatted, lat, lng }) => setFormData((prev) => ({ ...prev, location: formatted, latitude: lat, longitude: lng }))} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateTime">Date and Time *</Label>
                <Input id="dateTime" name="dateTime" type="datetime-local" min={new Date().toISOString().slice(0, 16)} value={formData.dateTime} onChange={handleChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxParticipants">Maximum Participants (Optional)</Label>
                <Input id="maxParticipants" name="maxParticipants" type="number" placeholder="Leave empty for unlimited" value={formData.maxParticipants} onChange={handleChange} min={1} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="privacy">Privacy Setting</Label>
                <Select value={formData.isPublic ? "public" : "private"} onValueChange={(val) => handleSelectChange("isPublic", val === "public")}>
                  <SelectTrigger><SelectValue placeholder="Select privacy setting" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public (Everyone can see)</SelectItem>
                    <SelectItem value="private">Private (Only friends can see)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Approval Requirement */}
              <div className="flex items-center space-x-2">
                <Input
                  type="checkbox"
                  id="requiresApproval"
                  name="requiresApproval"
                  checked={formData.requiresApproval}
                  onChange={handleChange}
                  className="h-4 w-4"
                />
                <Label htmlFor="requiresApproval" className="font-normal">
                  Require approval for users to join
                </Label>
              </div>
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => navigate("/feed")}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Activity"}</Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </Layout>
  );
}
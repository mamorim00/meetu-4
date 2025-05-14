// src/pages/Create.tsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "components/Layout";
import { useUserGuardContext } from "app";
import { useActivityStore } from "../utils/activityStore";
import { toast } from "sonner";
import LocationAutocomplete from "components/LocationAutocomplete";

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
];

export default function Create() {
  const navigate = useNavigate();
  const { user } = useUserGuardContext();
  const { createActivity } = useActivityStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── include latitude & longitude in your form state ────────────────
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
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // ── basic required‐fields check ──────────────────────────────────────
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
      !title ||
      !description ||
      !location ||
      latitude == null ||
      longitude == null ||
      !dateTime ||
      !category
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

      // ensure date is ISO
      let dateTimeStr: string;
      try {
        dateTimeStr = new Date(dateTime).toISOString();
      } catch {
        toast.error("Invalid date format");
        return;
      }

      // build the new activity payload
      const newActivity = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        latitude,
        longitude,
        dateTime: dateTimeStr,
        category,
        createdBy: {
          userId: user.uid,
          displayName: user.displayName || "Anonymous",
        },
        maxParticipants: formData.maxParticipants
          ? parseInt(formData.maxParticipants as string)
          : undefined,
        isPublic: formData.isPublic,
      };

      console.log("Submitting activity:", newActivity);
      const activityId = await createActivity(newActivity);
      console.log("Activity created with ID:", activityId);

      toast.success("Activity created successfully!");
      navigate("/feed");
    } catch (error) {
      console.error("Error creating activity:", error);
      toast.error("Failed to create activity");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-3xl px-4">
        <Card className="bg-card shadow-sm border-border/40">
          <CardHeader>
            <CardTitle className="text-2xl">Create New Activity</CardTitle>
            <CardDescription>
              Fill in the details to create a new activity for others to join
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Activity Title *</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="What's the activity called?"
                  value={formData.title}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Tell people more about this activity..."
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) =>
                    handleSelectChange("category", val)
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {activityCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Location with coords */}
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <LocationAutocomplete
                  value={formData.location}
                  onChange={(loc) =>
                    setFormData((prev) => ({ ...prev, location: loc }))
                  }
                  onSelect={({ formatted, lat, lng }) =>
                    setFormData((prev) => ({
                      ...prev,
                      location: formatted,
                      latitude: lat,
                      longitude: lng,
                    }))
                  }
                />
              </div>

              {/* Date and Time */}
              <div className="space-y-2">
                <Label htmlFor="dateTime">Date and Time *</Label>
                <Input
                  id="dateTime"
                  name="dateTime"
                  type="datetime-local"
                  min={new Date().toISOString().slice(0, 16)}
                  value={formData.dateTime}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Max Participants */}
              <div className="space-y-2">
                <Label htmlFor="maxParticipants">
                  Maximum Participants (Optional)
                </Label>
                <Input
                  id="maxParticipants"
                  name="maxParticipants"
                  type="number"
                  placeholder="Leave empty for unlimited"
                  value={formData.maxParticipants}
                  onChange={handleChange}
                  min={1}
                />
              </div>

              {/* Privacy */}
              <div className="space-y-2">
                <Label htmlFor="privacy">Privacy Setting</Label>
                <Select
                  value={formData.isPublic ? "public" : "private"}
                  onValueChange={(val) =>
                    handleSelectChange("isPublic", val === "public")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select privacy setting" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">
                      Public (Everyone can see)
                    </SelectItem>
                    <SelectItem value="private">
                      Private (Only friends can see)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.isPublic
                    ? "Anyone can discover and join this activity"
                    : "Only your friends will see this activity"}
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/myactivities")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Activity"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </Layout>
  );
}

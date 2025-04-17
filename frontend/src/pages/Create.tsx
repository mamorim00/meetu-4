import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "components/Layout";
import { useUserGuardContext } from "app";
import { useActivityStore, Activity, ActivityCategory } from "../utils/activityStore";
import { toast } from "sonner";
import  LocationAutocomplete   from "components/LocationAutocomplete";

// UI components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Defined activity categories (excluding "All" as it's not a real category)
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
  
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
    dateTime: "",
    category: "" as ActivityCategory,
    maxParticipants: "" as string | number,
    isPublic: true,
  });

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate form
    if (!formData.title || !formData.description || !formData.location || !formData.dateTime || !formData.category) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Form validation
      if (!formData.title) {
        toast.error("Please enter a title");
        return;
      }
      if (!formData.description) {
        toast.error("Please enter a description");
        return;
      }
      if (!formData.location) {
        toast.error("Please enter a location");
        return;
      }
      if (!formData.dateTime) {
        toast.error("Please enter a date and time");
        return;
      }
      if (!formData.category) {
        toast.error("Please select a category");
        return;
      }

      // Format the date correctly
      let dateTimeStr = formData.dateTime;
      try {
        // Ensure dateTime is in ISO string format
        dateTimeStr = new Date(formData.dateTime).toISOString();
      } catch (error) {
        console.error("Error formatting date:", error);
        toast.error("Invalid date format");
        return;
      }
      
      // Prepare activity data
      const newActivity = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        dateTime: dateTimeStr,
        category: formData.category,
        createdBy: {
          userId: user.uid,
          displayName: user.displayName || "Anonymous",
        },
        maxParticipants: formData.maxParticipants
  ? parseInt(formData.maxParticipants as string)
  : undefined,
        isPublic: formData.isPublic,
      };
      
      // Create activity in Firestore
      console.log('Submitting activity:', newActivity);
      const activityId = await createActivity(newActivity);
      console.log('Activity created with ID:', activityId);
      
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
    <Layout title="Create New Activity">
      <div className="container mx-auto max-w-3xl px-4">
            <Card className="bg-card shadow-sm border-border/40">
              <CardHeader>
                <CardTitle className="text-2xl">Create New Activity</CardTitle>
                <CardDescription>Fill in the details to create a new activity for others to join</CardDescription>
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
                      onValueChange={(value) => handleSelectChange("category", value)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {activityCategories.map((category) => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Location */}
                  <div className="space-y-2">
            <Label htmlFor="location">Location *</Label>
            <LocationAutocomplete
              value={formData.location}
              onChange={loc => setFormData(prev => ({ ...prev, location: loc }))}
            />
          </div>
                  
                  {/* Date and Time */}
                  <div className="space-y-2">
                    <Label htmlFor="dateTime">Date and Time *</Label>
                    <Input
                    id="dateTime"
                    name="dateTime"
                    type="datetime-local"
                    min={new Date().toISOString().slice(0, 16)} // ensures current date/time
                    value={formData.dateTime}
                    onChange={handleChange}
                    required
                  />
                  </div>
                  
                  {/* Max Participants */}
                  <div className="space-y-2">
                    <Label htmlFor="maxParticipants">Maximum Participants (Optional)</Label>
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
                  
                  {/* Privacy Setting */}
                  <div className="space-y-2">
                    <Label htmlFor="privacy">Privacy Setting</Label>
                    <Select 
                      value={formData.isPublic ? "public" : "private"} 
                      onValueChange={(value) => handleSelectChange("isPublic", value === "public")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select privacy setting" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public (Everyone can see)</SelectItem>
                        <SelectItem value="private">Private (Only friends can see)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {formData.isPublic 
                        ? "Anyone can discover and join this activity" 
                        : "Only your friends will see this activity"}
                    </p>
                  </div>
                  
                  {/* Image URL - REMOVED */}
                  {/* <div className="space-y-2">
                    <Label htmlFor="imageUrl">Image URL (Optional)</Label>
                    <Input
                      id="imageUrl"
                      name="imageUrl"
                      placeholder="Paste an image URL for your activity"
                      value={formData.imageUrl}
                      onChange={handleChange}
                    />
                    <p className="text-xs text-muted-foreground">Add an image to make your activity more appealing</p>
                  </div> */}
                </CardContent>
                
                <CardFooter className="flex justify-between">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => navigate("/feed")}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Creating..." : "Create Activity"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
      </div>
    </Layout>
  );
}

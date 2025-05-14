import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserGuardContext } from "app";
import { useUserProfileStore, UserProfile } from "../utils/userProfileStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Edit, Save, X, Camera, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast, Toaster } from "sonner";
import { uploadProfilePicture } from "../utils/fileStorage";
import { Layout } from "components/Layout";
import { resizeImage } from "../utils/imageUtils";

const ACTIVITY_INTERESTS = [
  "Hiking", "Running", "Walking", "Cycling", "Swimming", 
  "Yoga", "Gym", "Dancing", "Movies", "Music", 
  "Food", "Drinks", "Coffee", "Travel", "Sightseeing",
  "Museums", "Art", "Theater", "Concerts", "Sports", 
  "Games", "Books", "Coding", "Photography", "Cooking"
];

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useUserGuardContext();

  // pull in initializeListener along with profile, isLoading, update
  const { profile, isLoading, updateProfile, initializeListener } = useUserProfileStore();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile>>();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // subscribe to Firestore on mount (and whenever user changes)
  useEffect(() => {
    if (!user) return;
    const unsubscribe = initializeListener(user);
    return () => unsubscribe();
  }, [user, initializeListener]);

  // Initialize form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || "",
        bio: profile.bio || "",
        location: profile.location || "",
      });
      setSelectedInterests(profile.interests || []);
    }
  }, [profile]);

  // Reset form data when entering edit mode
  useEffect(() => {
    if (isEditing && profile) {
      setFormData({
        displayName: profile.displayName || "",
        bio: profile.bio || "",
        location: profile.location || "",
      });
      setSelectedInterests(profile.interests || []);
    }
  }, [isEditing, profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSave = async () => {
    console.log("🏷️ handleSave fired, formData:", formData, "interests:", selectedInterests);
    if (!formData) {
      console.warn("handleSave aborted: no formData");
      return;
    }

    try {
      await updateProfile({
        ...formData,
        interests: selectedInterests
      });
      toast.success("Profile updated successfully");
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    }
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.loading("Compressing and uploading picture...");
      const compressedBlob = await resizeImage(file, 128);
      const compressedFile = new File([compressedBlob], file.name, { type: compressedBlob.type });
      const photoURL = await uploadProfilePicture(user.uid, compressedFile);
      console.log("got photoURL:", photoURL);
      await updateProfile({ photoURL });
      toast.dismiss();
      toast.success("Profile picture updated successfully");
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      toast.dismiss();
      toast.error("Failed to upload profile picture");
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading profile…</p>
      </div>
    );
  }

  return (
    <Layout contentClassName="container mx-auto px-4 py-6 max-w-4xl">
      <Toaster position="top-right" />
      <div className="flex flex-col gap-6">
        {/* Profile Header Card */}
        <Card className="shadow-md overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-secondary/10 h-32 relative" />
          <CardContent className="pt-0 relative">
            <div className="flex flex-col md:flex-row gap-6 -mt-12">
              <div className="relative">
                <Avatar className="w-24 h-24 border-4 border-background">
                  <AvatarImage src={profile.photoURL || undefined} alt={profile.displayName || "User"} />
                  <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <label htmlFor="profile-picture" className="absolute bottom-0 right-0 bg-primary text-primary-foreground p-1 rounded-full cursor-pointer hover:bg-primary/80 transition-colors">
                    <Camera className="w-4 h-4" />
                    <input id="profile-picture" type="file" accept="image/*" className="hidden" onChange={handleProfilePictureChange} />
                  </label>
                )}
              </div>
              <div className="mt-4 md:mt-12 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    {isEditing ? (
                      <Input name="displayName" value={formData?.displayName || ""} onChange={handleChange} placeholder="Your name" className="text-xl font-bold mb-2" />
                    ) : (
                      <h2 className="text-2xl font-bold">{profile.displayName || user.email?.split("@")[0] || "User"}</h2>
                    )}
                    <p className="text-muted-foreground">{profile.email}</p>
                  </div>
                  <div>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)}><X className="h-4 w-4" /></Button>
                        <Button variant="default" size="icon" onClick={handleSave}><Save className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                        <Edit className="h-4 w-4 mr-2" />Edit Profile
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Friends Card */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Friends</CardTitle>
            <CardDescription>Manage your friends and friend requests</CardDescription>
          </CardHeader>
          <CardContent><Button onClick={() => navigate("/friends")} variant="outline" className="w-full"><Users className="h-4 w-4 mr-2" />View Friends & Requests</Button></CardContent>
        </Card>
        {/* Share Profile Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Share Your Profile</CardTitle>
            <CardDescription>Share your profile with friends or on social media</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => {
              const profileLink = `${window.location.origin}/other-profile?userId=${user.uid}`;
              navigator.clipboard.writeText(profileLink)
                .then(() => toast.success("Copied profile link to clipboard!"))
                .catch(() => toast.error("Failed to copy link"));
            }}>Copy Profile Link</Button>
          </CardContent>
        </Card>
        {/* Bio & Location Card */}
        <Card className="shadow-sm">
          <CardHeader><CardTitle>About Me</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Location</h3>
              {isEditing ? (
                <Input name="location" value={formData?.location || ""} onChange={handleChange} placeholder="Where are you based?" />
              ) : (
                <p>{profile.location || "Not specified"}</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Bio</h3>
              {isEditing ? (
                <Textarea name="bio" value={formData?.bio || ""} onChange={handleChange} placeholder="Tell us a bit about yourself" rows={4} />
              ) : (
                <p className="whitespace-pre-wrap">{profile.bio || "No bio yet"}</p>
              )}
            </div>
          </CardContent>
        </Card>
        {/* Interests Card */}
        <Card className="shadow-sm">
          <CardHeader><CardTitle>Activity Interests</CardTitle><CardDescription>Select activities you're interested in joining</CardDescription></CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_INTERESTS.map(interest => (
                  <Badge key={interest} variant={selectedInterests.includes(interest) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleInterest(interest)}>{interest}</Badge>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.interests && profile.interests.length > 0 ? (
                  profile.interests.map(interest => <Badge key={interest}>{interest}</Badge>)
                ) : (
                  <p className="text-muted-foreground">No interests selected</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

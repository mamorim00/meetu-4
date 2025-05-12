import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "components/Layout";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { firebaseApp } from "app";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUserGuardContext } from "app";
import { useFriendsStore, FriendRequestStatus } from "../utils/friendsStore";
import { UserProfile } from "../utils/userProfileStore";

const db = getFirestore(firebaseApp);

export default function UserProfilePage() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("userId");
  const navigate = useNavigate();
  const { user } = useUserGuardContext();
  const {
    friends,
    sentRequests,
    receivedRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    initializeListeners,
  } = useFriendsStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"friend" | "sent" | "received" | "none" | null>(null);
  const statusReadyRef = useRef(false);

  // Initialize real-time listeners
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = initializeListeners(user.uid);
    return () => unsub();
  }, [user, initializeListeners]);

  // Fetch profile
  useEffect(() => {
    if (!userId) {
      toast.error("No userId provided");
      navigate("/friends");
      return;
    }
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const ref = doc(db, "userProfiles", userId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        } else {
          toast.error("Profile not found");
          navigate("/friends");
        }
      } catch (e) {
        console.error("Error fetching profile", e);
        toast.error("Failed to load profile");
        navigate("/friends");
      } finally {
        setLoading(false);
      }
    };
    void fetchProfile();
  }, [userId, navigate]);

  // Determine friend/request status once store updates
  useEffect(() => {
    if (!user || !profile) return;
    // wait until listeners have populated at least one array
    if (!statusReadyRef.current) {
      if (friends.length === 0 && sentRequests.length === 0 && receivedRequests.length === 0) {
        return;
      }
      statusReadyRef.current = true;
    }
    let newStatus: typeof status = "none";
    if (friends.includes(profile.userId)) {
      newStatus = "friend";
    } else if (
      sentRequests.some(r => r.receiverId === profile.userId && r.status === FriendRequestStatus.PENDING)
    ) {
      newStatus = "sent";
    } else if (
      receivedRequests.some(r => r.senderId === profile.userId && r.status === FriendRequestStatus.PENDING)
    ) {
      newStatus = "received";
    }
    setStatus(newStatus);
  }, [user, profile, friends, sentRequests, receivedRequests]);

  const handleAdd = async () => {
    if (!user || !profile) return;
    if (status === "friend") {
      toast.error("You are already friends");
      return;
    }
    try {
      await sendFriendRequest(user, profile.userId);
      toast.success("Friend request sent");
    } catch (e) {
      console.error(e);
      toast.error("Failed to send friend request");
    }
  };

  const handleRemove = async () => {
    if (!user || !profile) return;
    try {
      await removeFriend(user.uid, profile.userId);
      toast.success("Friend removed");
    } catch (e) {
      console.error(e);
      toast.error("Failed to remove friend");
    }
  };

  const handleAccept = async () => {
    const req = receivedRequests.find(r => r.senderId === profile!.userId && r.status === FriendRequestStatus.PENDING);
    if (!req) return;
    try {
      await acceptFriendRequest(req.id);
      toast.success("Friend request accepted");
    } catch (e) {
      console.error(e);
      toast.error("Failed to accept request");
    }
  };

  const handleReject = async () => {
    const req = receivedRequests.find(r => r.senderId === profile!.userId && r.status === FriendRequestStatus.PENDING);
    if (!req) return;
    try {
      await rejectFriendRequest(req.id);
      toast.success("Friend request rejected");
    } catch (e) {
      console.error(e);
      toast.error("Failed to reject request");
    }
  };

  if (loading || status === null || !statusReadyRef.current) {
    return (
      <Layout title="Profile">
        <p className="text-center py-12">Loading...</p>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout title="Profile">
        <p className="text-center py-12">Profile not found.</p>
      </Layout>
    );
  }

  return (
    <Layout title={`${profile.displayName || 'User'}'s Profile`}>
      <div className="container mx-auto max-w-md">
        <Card>
          <CardHeader>
            <Avatar className="mx-auto mb-4 h-24 w-24">
              {profile.photoURL ? (
                <AvatarImage src={profile.photoURL} alt={profile.displayName || "User"} />
              ) : (
                <AvatarFallback>{profile.displayName?.charAt(0)}</AvatarFallback>
              )}
            </Avatar>
            <CardTitle className="text-center">{profile.displayName || 'Unnamed User'}</CardTitle>
            <CardDescription className="text-center text-sm text-muted-foreground">
              {profile.email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profile.bio && <p className="mb-4 whitespace-pre-wrap">{profile.bio}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            {/* Friend actions */}
            {status === 'friend' && (
              <Button className="w-full" variant="destructive" onClick={handleRemove}>
                Remove Friend
              </Button>
            )}
            {status === 'none' && (
              <Button className="w-full" onClick={handleAdd}>
                Add Friend
              </Button>
            )}
            {status === 'sent' && (
              <Button className="w-full" variant="outline" disabled>
                Request Sent
              </Button>
            )}
            {status === 'received' && (
              <div className="flex space-x-2 w-full">
                <Button className="flex-1" onClick={handleAccept}>
                  Accept Request
                </Button>
                <Button className="flex-1" variant="outline" onClick={handleReject}>
                  Reject Request
                </Button>
              </div>
            )}
            <Button onClick={() => navigate('/friends')} className="w-full" variant="outline">
              Back to Friends
            </Button>
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
}

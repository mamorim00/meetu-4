
import React, { useState, useEffect } from "react";
import { Layout } from "components/Layout";
import { useUserGuardContext } from "app";
import { useUserProfileStore, UserProfile } from "../utils/userProfileStore";
import { useFriendsStore, FriendRequestStatus } from "../utils/friendsStore";
import { toast } from "sonner";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { firebaseApp } from "app";
import { useParams, useNavigate } from "react-router-dom"; 

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Check, X, UserPlus, Search } from "lucide-react";

interface UserSearchResult {
  userId: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  isFriend: boolean;
  hasRequestPending: boolean;
  hasRequestSent: boolean;
}

const db = getFirestore(firebaseApp);

export default function Friends() {
  const { user } = useUserGuardContext();
  const { profile } = useUserProfileStore();
  const navigate = useNavigate();
  const {
    friends,
    sentRequests,
    receivedRequests,
    initializeListeners,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend
  } = useFriendsStore();
  

  const [friendsList, setFriendsList] = useState<UserProfile[]>([]);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Real-time listeners
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = initializeListeners(user.uid);
    return () => unsubscribe();
  }, [user, initializeListeners]);

  // Load friends' profiles
  useEffect(() => {
    const loadFriends = async () => {
      if (!friends.length) {
        setFriendsList([]);
        return;
      }
      try {
        const ref = collection(db, 'userProfiles');
        // Firestore 'in' supports max 10 IDs; handle larger lists if needed
        const q = query(ref, where('userId', 'in', friends));
        const snapshot = await getDocs(q);
        setFriendsList(snapshot.docs.map(doc => doc.data() as UserProfile));
      } catch (e) {
        console.error('Error loading friends profiles', e);
        toast.error('Failed to load friends');
      }
    };
    loadFriends();
  }, [friends]);

  // Fetch profiles for search
  const fetchAllProfiles = async () => {
    const profilesRef = collection(db, 'userProfiles');
    const snapshot = await getDocs(profilesRef);
    return snapshot.docs.map(doc => doc.data() as UserProfile);
  };

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const profiles = await fetchAllProfiles();
      const lower = searchQuery.toLowerCase();
      const results = profiles
        .filter(u => u.userId !== user?.uid)
        .filter(u =>
          u.displayName?.toLowerCase().includes(lower) ||
          u.email?.toLowerCase().includes(lower)
        )
        .map(u => ({
          ...u,
          isFriend: friends.includes(u.userId),
          hasRequestPending: receivedRequests.some(r => r.senderId === u.userId && r.status === FriendRequestStatus.PENDING),
          hasRequestSent: sentRequests.some(r => r.receiverId === u.userId && r.status === FriendRequestStatus.PENDING)
        } as UserSearchResult));
      setSearchResults(results);
    } catch (e) {
      console.error('Search error', e);
      toast.error('Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  // Actions
  const handleSendRequest = async (receiverId: string) => {
    try {
      await sendFriendRequest(user, receiverId);
      toast.success('Friend request sent');
      setSearchResults(prev => prev.map(r => r.userId === receiverId ? { ...r, hasRequestSent: true } : r));
    } catch (e) {
      console.error(e);
      toast.error('Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptFriendRequest(requestId);
      toast.success('Friend request accepted');
    } catch (e) {
      console.error(e);
      toast.error('Failed to accept friend request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectFriendRequest(requestId);
      toast.success('Friend request rejected');
    } catch (e) {
      console.error(e);
      toast.error('Failed to reject friend request');
    }
  };

  const pendingRequests = receivedRequests.filter(r => r.status === FriendRequestStatus.PENDING);

  return (
    <Layout title="Friends">
      <div className="container mx-auto max-w-4xl">
        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="friends">My Friends</TabsTrigger>
            <TabsTrigger value="requests">
              Requests
              {pendingRequests.length > 0 && (
                <Badge variant="destructive" className="ml-2">{pendingRequests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="find">Find Friends</TabsTrigger>
          </TabsList>

          {/* Friends List Tab */}
          <TabsContent value="friends" className="space-y-4">
            {friendsList.length > 0 ? (
              <div className="space-y-4">
                {friendsList.map((friend) => (
                  <Card key={friend.userId} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-center p-4">
                        <Avatar className="h-12 w-12 mr-4">
                          <AvatarImage
                            src={friend.photoURL || ""}
                            alt={friend.displayName || ""}
                          />
                          <AvatarFallback>
                            {friend.displayName?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          {/* 3) Replace the <Link> block with an onClick */}
                          <button
                            className="text-lg font-medium hover:underline"
                            onClick={() =>
                              navigate(`/other-profile?userId=${friend.userId}`)
                            }
                          >
                            {friend.displayName}
                          </button>
                          <p className="text-sm text-muted-foreground">
                            {friend.email}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeFriend(user.uid, friend.userId)}
                        >
                          Remove
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">You don't have any friends yet.</p>
                <Button variant="outline" className="mt-4" onClick={() => (document.querySelector('[value="find"]') as HTMLButtonElement)?.click()}>
                  Find Friends
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Friend Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
            {pendingRequests.length > 0 ? (
              pendingRequests.map(req => (
                <Card key={req.senderName} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex items-center p-4">
                      <Avatar className="h-12 w-12 mr-4">
                        <AvatarImage src={req.senderPhotoURL || ""} alt={req.senderName || ""} />
                        <AvatarFallback>{req.senderName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                   
                      <div className="flex-1">
                      <button
                            className="text-lg font-medium hover:underline"
                            onClick={() =>
                              navigate(`/other-profile?userId=${req.senderId}`)
                            }
                          >
                            {req.senderName}
                          </button>
                      </div>
                      <div className="flex space-x-2">
                        <Button size="icon" className="h-8 w-8" onClick={() => handleAcceptRequest(req.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handleRejectRequest(req.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">You don't have any pending friend requests.</p>
              </div>
            )}
          </TabsContent>

          {/* Find Friends Tab */}
          <TabsContent value="find" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Find Friends</CardTitle>
                <CardDescription>Search for users by name or email</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-2">
                  <Input
                    className="flex-1"
                    placeholder="Search by name or email"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} disabled={isSearching}>
                    <Search className="h-4 w-4 mr-2" /> Search
                  </Button>
                </div>
              </CardContent>
            </Card>

            {searchResults.length > 0 ? (
              <div className="space-y-4 mt-4">
                <h3 className="text-lg font-medium">Search Results</h3>
                {searchResults.map(r => (
                  <Card key={r.displayName} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-center p-4">
                        <Avatar className="h-12 w-12 mr-4">
                          <AvatarImage src={r.photoURL || ""} alt={r.displayName || ""} />
                          <AvatarFallback>{r.displayName?.charAt(0) || r.email?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <button
                            className="text-lg font-medium hover:underline"
                            onClick={() =>
                              navigate(`/other-profile?userId=${r.userId}`)
                            }
                          >
                            {r.displayName || r.email}
                          </button>
                        </div>
                        {r.isFriend ? (
                            <Badge variant="outline" className="mr-2">Friend</Badge>
                        ) : r.hasRequestPending ? (
                          <Button size="sm" onClick={() => { const reqId = pendingRequests.find(p => p.senderId === r.userId)?.id; reqId ? handleAcceptRequest(reqId) : toast.error('No pending request'); }}>
                            Accept Request
                          </Button>
                        ) : r.hasRequestSent ? (
                          <Badge variant="secondary" className="mr-2">Request Sent</Badge>
                        ) : (
                          <Button size="sm" onClick={() => handleSendRequest(r.userId)}>
                            <UserPlus className="h-4 w-4 mr-2" /> Add Friend
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              searchQuery && !isSearching && (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">No users found matching your search.</p>
                </div>
              )
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

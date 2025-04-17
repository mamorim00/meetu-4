import React, { useState, useEffect } from "react";
import { Layout } from "components/Layout";
import { useUserGuardContext } from "app";
import { useUserProfileStore } from "../utils/userProfileStore";
import { useFriendsStore, FriendRequestStatus } from "../utils/friendsStore";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import { firebaseApp } from "app";
import { UserProfile } from "../utils/userProfileStore";
import { Check, X, UserPlus, Search } from "lucide-react";

interface UserSearchResult extends UserProfile {
  isFriend: boolean;
  hasRequestPending: boolean;
  hasRequestSent: boolean;
}

export default function Friends() {
  const { user } = useUserGuardContext();
  const { friends, sentRequests, receivedRequests, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend } = useFriendsStore();
  const { profile } = useUserProfileStore();
  
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [friendsList, setFriendsList] = useState<UserProfile[]>([]);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const db = getFirestore(firebaseApp);

  // Load friend profiles from Firestore
  useEffect(() => {
    const loadFriendProfiles = async () => {
      if (!friends || friends.length === 0) {
        setFriendsList([]);
        return;
      }

      try {
        const userProfilesRef = collection(db, 'userProfiles');
        const friendsData: UserProfile[] = [];

        // Fetch each friend's profile
        for (const friendId of friends) {
          const q = query(userProfilesRef, where('userId', '==', friendId));
          const querySnapshot = await getDocs(q);

          querySnapshot.forEach((doc) => {
            friendsData.push(doc.data() as UserProfile);
          });
        }

        setFriendsList(friendsData);
      } catch (error) {
        console.error('Error loading friend profiles:', error);
        toast.error('Failed to load friends');
      }
    };

    loadFriendProfiles();
  }, [friends, db]);

  // Load pending request profiles
  useEffect(() => {
    const loadPendingRequestProfiles = async () => {
      if (!receivedRequests || receivedRequests.length === 0) {
        setPendingRequests([]);
        return;
      }

      // Filter for only pending requests
      const pendingReqs = receivedRequests.filter(
        req => req.status === FriendRequestStatus.PENDING
      );

      if (pendingReqs.length === 0) {
        setPendingRequests([]);
        return;
      }

      try {
        const userProfilesRef = collection(db, 'userProfiles');
        const pendingData = [];

        // Fetch each sender's profile
        for (const request of pendingReqs) {
          const q = query(userProfilesRef, where('userId', '==', request.senderId));
          const querySnapshot = await getDocs(q);

          querySnapshot.forEach((doc) => {
            pendingData.push({
              ...doc.data(),
              requestId: request.id
            });
          });
        }

        setPendingRequests(pendingData);
      } catch (error) {
        console.error('Error loading pending requests:', error);
      }
    };

    loadPendingRequestProfiles();
  }, [receivedRequests, db]);

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const userProfilesRef = collection(db, 'userProfiles');
      const searchLower = searchQuery.toLowerCase();

      // Search by display name or email
      // This is a simple implementation - in a real app you might want server-side search
      const q = query(userProfilesRef);
      const querySnapshot = await getDocs(q);

      const results: UserSearchResult[] = [];

      querySnapshot.forEach((doc) => {
        const userData = doc.data() as UserProfile;
        
        // Skip the current user
        if (userData.userId === user.uid) return;
        
        // Skip users already in the search results
        if (results.some(r => r.userId === userData.userId)) return;

        // Check if the user matches the search query
        const displayNameMatch = userData.displayName?.toLowerCase().includes(searchLower);
        const emailMatch = userData.email?.toLowerCase().includes(searchLower);

        if (displayNameMatch || emailMatch) {
          results.push({
            ...userData,
            isFriend: friends.includes(userData.userId),
            hasRequestPending: receivedRequests.some(
              req => req.senderId === userData.userId && req.status === FriendRequestStatus.PENDING
            ),
            hasRequestSent: sentRequests.some(
              req => req.receiverId === userData.userId && req.status === FriendRequestStatus.PENDING
            )
          });
        }
      });

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
      toast.error('Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  // Send friend request
  const handleSendRequest = async (receiverId: string) => {
    try {
      await sendFriendRequest(user, receiverId);
      toast.success('Friend request sent');
      
      // Update search results to reflect the request has been sent
      setSearchResults(prev => 
        prev.map(result => 
          result.userId === receiverId 
            ? { ...result, hasRequestSent: true }
            : result
        )
      );
    } catch (error) {
      console.error('Error sending friend request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send friend request';
      toast.error(errorMessage);
    }
  };

  // Accept friend request
  const handleAcceptRequest = async (requestId: string, senderId: string) => {
    try {
      await acceptFriendRequest(requestId);
      toast.success('Friend request accepted');
      
      // Update pending requests list
      setPendingRequests(prev => prev.filter(req => req.requestId !== requestId));
    } catch (error) {
      console.error('Error accepting friend request:', error);
      toast.error('Failed to accept friend request');
    }
  };

  // Reject friend request
  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectFriendRequest(requestId);
      toast.success('Friend request rejected');
      
      // Update pending requests list
      setPendingRequests(prev => prev.filter(req => req.requestId !== requestId));
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      toast.error('Failed to reject friend request');
    }
  };

  // Remove friend
  const handleRemoveFriend = async (friendId: string) => {
    try {
      await removeFriend(user.uid, friendId);
      toast.success('Friend removed');
    } catch (error) {
      console.error('Error removing friend:', error);
      toast.error('Failed to remove friend');
    }
  };

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
                              <AvatarImage src={friend.photoURL || undefined} alt={friend.displayName || ""} />
                              <AvatarFallback>{friend.displayName?.charAt(0) || friend.email?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h3 className="text-lg font-medium">{friend.displayName}</h3>
                              <p className="text-sm text-muted-foreground">{friend.email}</p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleRemoveFriend(friend.userId)}
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
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => document.querySelector('[value="find"]')?.dispatchEvent(new MouseEvent('click'))}
                    >
                      Find Friends
                    </Button>
                  </div>
                )}
              </TabsContent>
              
              {/* Friend Requests Tab */}
              <TabsContent value="requests" className="space-y-4">
                {pendingRequests.length > 0 ? (
                  <div className="space-y-4">
                    {pendingRequests.map((request) => (
                      <Card key={request.requestId} className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex items-center p-4">
                            <Avatar className="h-12 w-12 mr-4">
                              <AvatarImage src={request.photoURL || undefined} alt={request.displayName || ""} />
                              <AvatarFallback>{request.displayName?.charAt(0) || request.email?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h3 className="text-lg font-medium">{request.displayName}</h3>
                              <p className="text-sm text-muted-foreground">{request.email}</p>
                            </div>
                            <div className="flex space-x-2">
                              <Button 
                                variant="default" 
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleAcceptRequest(request.requestId, request.userId)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleRejectRequest(request.requestId)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
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
                      <div className="flex-1">
                        <Input 
                          placeholder="Search by name or email" 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                      </div>
                      <Button 
                        onClick={handleSearch}
                        disabled={isSearching}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                {searchResults.length > 0 && (
                  <div className="space-y-4 mt-4">
                    <h3 className="text-lg font-medium">Search Results</h3>
                    {searchResults.map((result) => (
                      <Card key={result.userId} className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="flex items-center p-4">
                            <Avatar className="h-12 w-12 mr-4">
                              <AvatarImage src={result.photoURL || undefined} alt={result.displayName || ""} />
                              <AvatarFallback>{result.displayName?.charAt(0) || result.email?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h3 className="text-lg font-medium">{result.displayName}</h3>
                              <p className="text-sm text-muted-foreground">{result.email}</p>
                            </div>
                            {result.isFriend ? (
                              <Badge variant="outline" className="mr-2">Friend</Badge>
                            ) : result.hasRequestPending ? (
                              <div className="flex space-x-2">
                                <Button 
                                  variant="default" 
                                  size="sm"
                                  className="bg-primary hover:bg-primary/90"
                                  onClick={() => handleAcceptRequest(
                                    receivedRequests.find(req => req.senderId === result.userId)?.id || '',
                                    result.userId
                                  )}
                                >
                                  Accept Request
                                </Button>
                              </div>
                            ) : result.hasRequestSent ? (
                              <Badge variant="secondary" className="mr-2">Request Sent</Badge>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleSendRequest(result.userId)}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Add Friend
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                
                {searchQuery && searchResults.length === 0 && !isSearching && (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">No users found matching your search.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
      </div>
    </Layout>
  );
}

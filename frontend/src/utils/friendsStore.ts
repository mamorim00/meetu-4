import { create } from 'zustand';
import { firebaseApp } from 'app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  arrayUnion,
  arrayRemove,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { User } from 'firebase/auth';

// Initialize Firestore
const db = getFirestore(firebaseApp);

// Friend request status types
export enum FriendRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected'
}

// Friend request interface
export interface FriendRequest {
  id: string;
  senderId: string;
  senderName: string | null;
  senderPhotoURL: string | null;
  receiverId: string;
  status: FriendRequestStatus;
  createdAt: number;
}

// Store interface
type Unsubscribe = () => void;
interface FriendsState {
  friends: string[];
  sentRequests: FriendRequest[];
  receivedRequests: FriendRequest[];
  isLoading: boolean;
  error: Error | null;

  // Initialize listeners
  initializeListeners: (userId: string) => Unsubscribe;
  
  // Friend actions
  sendFriendRequest: (currentUser: User, receiverId: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  rejectFriendRequest: (requestId: string) => Promise<void>;
  removeFriend: (currentUserId: string, friendId: string) => Promise<void>;
  
  // Helper methods
  isFriend: (userId: string) => boolean;
  hasPendingRequestFrom: (userId: string) => boolean;
  hasSentRequestTo: (userId: string) => boolean;
}

// Create store
export const useFriendsStore = create<FriendsState>((set, get) => ({
  friends: [],
  sentRequests: [],
  receivedRequests: [],
  isLoading: false,
  error: null,
  
  // Initialize listeners for friend data
  initializeListeners: (userId: string) => {
    set({ isLoading: true });
    const unsubscribers: Unsubscribe[] = [];

    // 1. Listen for friends list
    const userProfileRef = doc(db, 'userProfiles', userId);
    unsubscribers.push(onSnapshot(userProfileRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        set({ friends: data.friends || [] });
      }
    }, (error) => {
      console.error('Error in friends listener:', error);
      set({ error: error as Error });
    }));

    // 2. Listen for sent friend requests
    const sentRequestsQuery = query(
      collection(db, 'friendRequests'),
      where('senderId', '==', userId)
    );
    unsubscribers.push(onSnapshot(sentRequestsQuery, (querySnapshot) => {
      const sentRequestsData: FriendRequest[] = [];
      querySnapshot.forEach((doc) => {
        sentRequestsData.push({ id: doc.id, ...doc.data() } as FriendRequest);
      });
      set({ sentRequests: sentRequestsData });
    }, (error) => {
      console.error('Error in sent requests listener:', error);
      set({ error: error as Error });
    }));

    // 3. Listen for received friend requests
    const receivedRequestsQuery = query(
      collection(db, 'friendRequests'),
      where('receiverId', '==', userId)
    );
    unsubscribers.push(onSnapshot(receivedRequestsQuery, (querySnapshot) => {
      const receivedRequestsData: FriendRequest[] = [];
      querySnapshot.forEach((doc) => {
        receivedRequestsData.push({ id: doc.id, ...doc.data() } as FriendRequest);
      });
      set({ receivedRequests: receivedRequestsData, isLoading: false });
    }, (error) => {
      console.error('Error in received requests listener:', error);
      set({ error: error as Error, isLoading: false });
    }));

    return () => unsubscribers.forEach(unsub => unsub());
  },
  
  // Send a friend request
  sendFriendRequest: async (currentUser, receiverId) => {
    try {
      if (!currentUser.uid || !receiverId) throw new Error('Missing user information');
      if (get().isFriend(receiverId)) throw new Error('Already friends');
      if (get().hasSentRequestTo(receiverId)) throw new Error('Request already sent');

      const newRequest = {
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        senderPhotoURL: currentUser.photoURL,
        receiverId,
        status: FriendRequestStatus.PENDING,
        createdAt: Date.now()
      };
      await addDoc(collection(db, 'friendRequests'), newRequest);
    } catch (error) {
      console.error('Error sending friend request:', error);
      set({ error: error as Error });
      throw error;
    }
  },
  
  // Accept a friend request (client only flips status)
  acceptFriendRequest: async (requestId: string) => {
    try {
      const requestRef = doc(db, 'friendRequests', requestId);
      await updateDoc(requestRef, { status: FriendRequestStatus.ACCEPTED });
      // Profile updates handled in Cloud Function
    } catch (error) {
      console.error('Error accepting friend request:', error);
      set({ error: error as Error });
      throw error;
    }
  },

  // Reject a friend request
  rejectFriendRequest: async (requestId) => {
    try {
      const requestRef = doc(db, 'friendRequests', requestId);
      await updateDoc(requestRef, { status: FriendRequestStatus.REJECTED });
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      set({ error: error as Error });
      throw error;
    }
  },
  
  // Remove a friend
  removeFriend: async (currentUserId, friendId) => {
    try {
      const currentUserRef = doc(db, 'userProfiles', currentUserId);
      await updateDoc(currentUserRef, { friends: arrayRemove(friendId) });
      const friendUserRef = doc(db, 'userProfiles', friendId);
      await updateDoc(friendUserRef, { friends: arrayRemove(currentUserId) });
    } catch (error) {
      console.error('Error removing friend:', error);
      set({ error: error as Error });
      throw error;
    }
  },
  
  // Helpers
  isFriend: (userId) => get().friends.includes(userId),
  hasPendingRequestFrom: (userId) =>
    get().receivedRequests.some(req => req.senderId === userId && req.status === FriendRequestStatus.PENDING),
  hasSentRequestTo: (userId) =>
    get().sentRequests.some(req => req.receiverId === userId && req.status === FriendRequestStatus.PENDING)
}));

// Note: Deploy a Cloud Function to handle the status→friends-array update under admin privileges.

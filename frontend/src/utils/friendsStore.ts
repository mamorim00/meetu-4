import { create } from 'zustand';
import { firebaseApp } from 'app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where, arrayUnion, arrayRemove, Timestamp, addDoc } from 'firebase/firestore';
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
interface FriendsState {
  friends: string[];
  sentRequests: FriendRequest[];
  receivedRequests: FriendRequest[];
  isLoading: boolean;
  error: Error | null;

  // Initialize listeners
  initializeListeners: (userId: string) => () => void;
  
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
    
    const unsubscribers: (() => void)[] = [];
    
    // 1. Listen for friends list (stored in user profile)
    const userProfileRef = doc(db, 'userProfiles', userId);
    const profileUnsubscribe = onSnapshot(userProfileRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        set({ friends: data.friends || [] });
      }
    }, (error) => {
      console.error('Error in friends listener:', error);
      set({ error: error as Error });
    });
    unsubscribers.push(profileUnsubscribe);
    
    // 2. Listen for sent friend requests
    const sentRequestsQuery = query(
      collection(db, 'friendRequests'),
      where('senderId', '==', userId)
    );
    
    const sentRequestsUnsubscribe = onSnapshot(sentRequestsQuery, (querySnapshot) => {
      const sentRequestsData: FriendRequest[] = [];
      querySnapshot.forEach((doc) => {
        sentRequestsData.push({ id: doc.id, ...doc.data() } as FriendRequest);
      });
      set({ sentRequests: sentRequestsData });
    }, (error) => {
      console.error('Error in sent requests listener:', error);
      set({ error: error as Error });
    });
    unsubscribers.push(sentRequestsUnsubscribe);
    
    // 3. Listen for received friend requests
    const receivedRequestsQuery = query(
      collection(db, 'friendRequests'),
      where('receiverId', '==', userId)
    );
    
    
    const receivedRequestsUnsubscribe = onSnapshot(receivedRequestsQuery, (querySnapshot) => {
      const receivedRequestsData: FriendRequest[] = [];
      querySnapshot.forEach((doc) => {
        receivedRequestsData.push({ id: doc.id, ...doc.data() } as FriendRequest);
      });
      set({ receivedRequests: receivedRequestsData, isLoading: false });
    }, (error) => {
      console.error('Error in received requests listener:', error);
      set({ error: error as Error, isLoading: false });
    });
    unsubscribers.push(receivedRequestsUnsubscribe);
    
    // Return a function to unsubscribe from all listeners
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  },
  
  // Send a friend request
  sendFriendRequest: async (currentUser, receiverId) => {
    try {
      if (!currentUser.uid || !receiverId) {
        throw new Error('Missing user information');
      }
      
      // Check if already friends
      if (get().isFriend(receiverId)) {
        throw new Error('You are already friends with this user');
      }
      
      // Check if already sent a request
      if (get().hasSentRequestTo(receiverId)) {
        throw new Error('You have already sent a friend request to this user');
      }
      
      // Create new friend request
      const newRequest: Omit<FriendRequest, 'id'> = {
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
  
  // Accept a friend request
  acceptFriendRequest: async (requestId: string) => {
    try {
      const requestRef = doc(db, 'friendRequests', requestId);
      // 1) load the actual request doc
      const requestSnap = await getDoc(requestRef);
      if (!requestSnap.exists()) {
        throw new Error('Friend request not found');
      }
      const requestData = requestSnap.data() as FriendRequest;
      const { senderId, receiverId } = requestData;

      // 2) mark it accepted
      await updateDoc(requestRef, { status: FriendRequestStatus.ACCEPTED });

      // 3) add each to the other’s friends list
      const currentUserRef = doc(db, 'userProfiles', receiverId);
      const senderUserRef  = doc(db, 'userProfiles', senderId);

      await Promise.all([
        updateDoc(currentUserRef, { friends: arrayUnion(senderId) }),
        updateDoc(senderUserRef,  { friends: arrayUnion(receiverId) })
      ]);
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
      // Remove friend from current user's friends list
      const currentUserRef = doc(db, 'userProfiles', currentUserId);
      await updateDoc(currentUserRef, {
        friends: arrayRemove(friendId)
      });
      
      // Remove current user from friend's friends list
      const friendUserRef = doc(db, 'userProfiles', friendId);
      await updateDoc(friendUserRef, {
        friends: arrayRemove(currentUserId)
      });
    } catch (error) {
      console.error('Error removing friend:', error);
      set({ error: error as Error });
      throw error;
    }
  },
  
  // Check if a user is in the friends list
  isFriend: (userId) => {
    return get().friends.includes(userId);
  },
  
  // Check if there's a pending request from this user
  hasPendingRequestFrom: (userId) => {
    return get().receivedRequests.some(
      req => req.senderId === userId && req.status === FriendRequestStatus.PENDING
    );
  },
  
  // Check if a request has been sent to this user
  hasSentRequestTo: (userId) => {
    return get().sentRequests.some(
      req => req.receiverId === userId && req.status === FriendRequestStatus.PENDING
    );
  }
}));

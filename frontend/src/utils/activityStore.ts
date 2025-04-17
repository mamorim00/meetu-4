import { create } from 'zustand';
import { firebaseApp } from 'app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, orderBy, Timestamp, arrayUnion, arrayRemove, where } from 'firebase/firestore';
import { ActivityCategory } from '../pages/Feed';
import { User } from 'firebase/auth';
import { useChatStore } from './chatStore';

// Initialize Firestore
const db = getFirestore(firebaseApp);

// Define activity interface with Firestore specifics
export interface Activity {
  id: string;
  title: string;
  description: string;
  location: string;
  dateTime: string;
  category: ActivityCategory;
  createdBy: {
    userId: string;
    displayName: string;
  };
  participantIds: string[];
  maxParticipants?: number;
  createdAt: number;
  isPublic: boolean;
}



// Export the ActivityCategory from here too to ensure consistency
export type ActivityCategory = 
  | "Sports"
  | "Dining"
  | "Hiking"
  | "Gaming"
  | "Movies"
  | "Travel"
  | "Music"
  | "Cooking"
  | "All";

// Define store state
interface ActivityState {
  activities: Activity[];
  isLoading: boolean;
  error: Error | null;
  // Function to initialize the listener for real-time updates
  initializeListener: (userId?: string, showPrivate?: boolean) => () => void;
  // Function to create a new activity
  createActivity: (activity: Omit<Activity, 'id' | 'participantIds' | 'participantsCount' | 'createdAt'>) => Promise<string>;
  // Function to join an activity
  joinActivity: (activityId: string, userId: string) => Promise<void>;
  // Function to leave an activity
  leaveActivity: (activityId: string, userId: string) => Promise<void>;
  // Function to delete an activity
  deleteActivity: (activityId: string, userId: string) => Promise<void>;
  // Function to check if a user is a participant in an activity
  isParticipant: (activityId: string, userId: string) => boolean;
}

// Create store
export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: [],
  isLoading: false,
  error: null,
  
  // Initialize listener for real-time updates
  initializeListener: (userId = '', showFriendsOnly = false) => {
    set({ isLoading: true });
    
    // Set up query for activities collection
    // If userId is provided, we'll filter for public activities and private activities from friends
    let q;
    
    // We'll always load all activities and filter on the client side based on friendship
    // This is because Firestore can't query based on array membership across documents
    q = query(collection(db, 'activities'), orderBy('dateTime'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const activitiesData: Activity[] = [];
      querySnapshot.forEach((doc) => {
        try {
          const data = doc.data();
          if (!data) {
            console.warn('Empty document data for ID:', doc.id);
            return;
          }
          
          activitiesData.push({
            id: doc.id,
            title: data.title || '',
            description: data.description || '',
            location: data.location || '',
            dateTime: data.dateTime || '',
            category: data.category || 'All',
            createdBy: {
              userId: data.createdBy?.userId || '',
              displayName: data.createdBy?.displayName || 'Anonymous',
            },
            participantIds: data.participantIds || [],
            maxParticipants: data.maxParticipants,
            createdAt: data.createdAt || Date.now(),
            isPublic: data.isPublic !== undefined ? data.isPublic : true, // Default to public for backward compatibility
          });
        } catch (error) {
          console.error('Error processing document:', doc.id, error);
        }
      });
      
      // Sort by date (newest first for created activities)
      activitiesData.sort((a, b) => {
        return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
      });
      
      set({ 
        activities: activitiesData, 
        isLoading: false,
      });
    }, (error) => {
      console.error('Error getting activities:', error);
      set({ error, isLoading: false });
    });
    
    return unsubscribe;
  },
  
  // Create a new activity
  createActivity: async (activity) => {
    try {
      if (!activity || !activity.createdBy || !activity.createdBy.userId) {
        console.error('Invalid activity data:', activity);
        throw new Error('Invalid activity data');
      }

      const activityRef = doc(collection(db, 'activities'));
      
      // Validate required fields
      if (!activity.title || !activity.description || !activity.location || !activity.dateTime || !activity.category) {
        throw new Error('Missing required fields for activity');
      }
      
      // Format the data correctly for Firestore - removing imageUrl
      const newActivity = {
        title: activity.title,
        description: activity.description,
        location: activity.location,
        dateTime: activity.dateTime,
        category: activity.category,
        createdBy: {
          userId: activity.createdBy.userId,
          displayName: activity.createdBy.displayName || 'Anonymous',
        },
        participantIds: [activity.createdBy.userId], // Creator is automatically a participant
        createdAt: Date.now(),
        maxParticipants: activity.maxParticipants,
        isPublic: activity.isPublic !== undefined ? activity.isPublic : true, // Default to public if not specified
      };
      
      console.log('Creating activity with data:', JSON.stringify(newActivity));
      
      // Ensure we're using a valid Firestore document reference
      await setDoc(activityRef, newActivity);
      console.log('Activity created with ID:', activityRef.id);
      return activityRef.id;
    } catch (error) {
      console.error('Error creating activity:', error);
      set({ error: error as Error });
      throw error;
    }
  },
  
  // Join an activity
  joinActivity: async (activityId, userId) => {
    try {
      if (!activityId || !userId) {
        throw new Error('Activity ID and user ID are required');
      }
      
      const activityRef = doc(db, 'activities', activityId);
      const activityDoc = await getDoc(activityRef);
      
      if (!activityDoc.exists()) {
        throw new Error('Activity not found');
      }
      
      const activityData = activityDoc.data();
      
      // Check if the user is already a participant
      if (activityData.participantIds?.includes(userId)) {
        console.log('User already joined this activity');
        return; // User is already a participant, do nothing
      }
      
      // Check if the activity is full
      if (activityData.maxParticipants && 
          activityData.participantIds?.length >= activityData.maxParticipants) {
        throw new Error('Activity is full');
      }
      
      // Add user to participants array
      await updateDoc(activityRef, {
        participantIds: arrayUnion(userId),
      });
      
      // Note: Chat creation/joining moved to lazy load when entering chat page
      console.log('Activity joined successfully, chat will be created when needed');
      
      console.log(`User ${userId} joined activity ${activityId}`);
    } catch (error) {
      console.error('Error joining activity:', error);
      set({ error: error as Error });
      throw error;
    }
  },
  
  // Leave an activity
  leaveActivity: async (activityId, userId) => {
    try {
      if (!activityId || !userId) {
        throw new Error('Activity ID and user ID are required');
      }
      
      const activityRef = doc(db, 'activities', activityId);
      const activityDoc = await getDoc(activityRef);
      
      if (!activityDoc.exists()) {
        throw new Error('Activity not found');
      }
      
      const activityData = activityDoc.data();
      
      // Check if the user is actually a participant
      if (!activityData.participantIds?.includes(userId)) {
        console.log('User is not a participant in this activity');
        return; // User is not a participant, do nothing
      }
      
      // Check if user is the creator
      if (activityData.createdBy?.userId === userId) {
        // Optional: Prevent creator from leaving, or implement special handling
        console.log('Creator attempted to leave their own activity');
      }
      
      // Remove user from participants array
      await updateDoc(activityRef, {
        participantIds: arrayRemove(userId),
      });
      
      // Leave the activity chat
      try {
        const chatStore = useChatStore.getState();
        await chatStore.leaveActivityChat(activityId, userId);
      } catch (chatError) {
        console.error('Error leaving chat after leaving activity:', chatError);
        // Don't fail the leave operation if chat leaving fails
      }
      
      console.log(`User ${userId} left activity ${activityId}`);
    } catch (error) {
      console.error('Error leaving activity:', error);
      set({ error: error as Error });
      throw error;
    }
  },
  
  // Check if a user is a participant in an activity
  isParticipant: (activityId, userId) => {
    if (!activityId || !userId) return false;
    
    const activity = get().activities.find(a => a.id === activityId);
    return activity ? activity.participantIds?.includes(userId) : false;
  },
  
  // Delete an activity
  deleteActivity: async (activityId, userId) => {
    try {
      if (!activityId || !userId) {
        throw new Error('Activity ID and user ID are required');
      }
      
      const activityRef = doc(db, 'activities', activityId);
      const activityDoc = await getDoc(activityRef);
      
      if (!activityDoc.exists()) {
        throw new Error('Activity not found');
      }
      
      const activityData = activityDoc.data();
      
      // Check if the user is the creator of the activity
      if (activityData.createdBy?.userId !== userId) {
        throw new Error('Only the creator can delete an activity');
      }
      
      // Delete the activity document
      await deleteDoc(activityRef);
      
      // Clean up related chat data if it exists
      try {
        const chatStore = useChatStore.getState();
        // This would typically be a method to clean up chat data, but we'll implement it in the chat cleanup task
        // For now, we just log it
        console.log(`Activity ${activityId} deleted, chat data will be cleaned up separately`);
      } catch (chatError) {
        console.error('Error cleaning up chat after deleting activity:', chatError);
        // Don't fail the delete operation if chat cleanup fails
      }
      
      console.log(`Activity ${activityId} deleted successfully`);
    } catch (error) {
      console.error('Error deleting activity:', error);
      set({ error: error as Error });
      throw error;
    }
  },
}));

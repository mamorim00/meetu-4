import { create } from 'zustand';
import { firebaseApp } from 'app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { ActivityCategory } from '../pages/Feed';
import { useChatStore } from './chatStore';

// Initialize Firestore
const db = getFirestore(firebaseApp);

// Define activity interface with Firestore specifics
export interface Activity {
  id: string;
  title: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
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

// Define input type for creating activities
export type NewActivity = Omit<
  Activity,
  'id' | 'participantIds' | 'createdAt'
>;

// Define store state
interface ActivityState {
  activities: Activity[];
  isLoading: boolean;
  error: Error | null;
  initializeListener: (userId?: string, showPrivate?: boolean) => () => void;
  createActivity: (activity: NewActivity) => Promise<string>;
  joinActivity: (activityId: string, userId: string) => Promise<void>;
  leaveActivity: (activityId: string, userId: string) => Promise<void>;
  deleteActivity: (activityId: string, userId: string) => Promise<void>;
  isParticipant: (activityId: string, userId: string) => boolean;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: [],
  isLoading: false,
  error: null,

  initializeListener: (userId = '', showFriendsOnly = false) => {
    set({ isLoading: true });
    const q = query(collection(db, 'activities'), orderBy('dateTime'));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const activitiesData: Activity[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          activitiesData.push({
            id: docSnap.id,
            title: data.title || '',
            description: data.description || '',
            location: data.location || '',
            latitude: typeof data.latitude === 'number' ? data.latitude : 0,
            longitude: typeof data.longitude === 'number' ? data.longitude : 0,
            dateTime: data.dateTime || '',
            category: data.category || 'All',
            createdBy: {
              userId: data.createdBy?.userId || '',
              displayName: data.createdBy?.displayName || 'Anonymous',
            },
            participantIds: data.participantIds || [],
            maxParticipants: data.maxParticipants,
            createdAt: data.createdAt || Date.now(),
            isPublic: data.isPublic ?? true,
          });
        });

        activitiesData.sort(
          (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
        );
        set({ activities: activitiesData, isLoading: false });
      },
      (error) => {
        console.error('Error getting activities:', error);
        set({ error, isLoading: false });
      }
    );

    return unsubscribe;
  },

  createActivity: async (activity) => {
    try {
      const { title, description, location, latitude, longitude, dateTime, category, createdBy, maxParticipants, isPublic } =
        activity;

      if (!title || !description || !location || !dateTime || !category) {
        throw new Error('Missing required fields for activity');
      }

      const activityRef = doc(collection(db, 'activities'));
      const newActivity = {
        title,
        description,
        location,
        latitude,
        longitude,
        dateTime,
        category,
        createdBy: {
          userId: createdBy.userId,
          displayName: createdBy.displayName || 'Anonymous',
        },
        participantIds: [createdBy.userId],
        createdAt: Date.now(),
        maxParticipants,
        isPublic: isPublic ?? true,
      };

      await setDoc(activityRef, newActivity);
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

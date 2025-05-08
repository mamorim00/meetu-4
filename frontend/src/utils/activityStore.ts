import { create } from 'zustand';
import { firebaseApp } from 'app'; // Assuming 'app' exports your initialized firebaseApp
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
  where,
  orderBy,
  arrayUnion,
  arrayRemove,
  Timestamp as FirestoreTimestamp // *** Import Firestore Timestamp ***
} from 'firebase/firestore';
import { ActivityCategory } from '../pages/Feed'; // Ensure this path is correct
import { useChatStore } from './chatStore'; // Ensure this path is correct
import { ref as rtdbRef, set as rtdbSet } from "firebase/database";
import { realtimeDb } from "./firebase";    // your RTDB instance
import { getAuth } from "firebase/auth";


// Initialize Firestore
const db = getFirestore(firebaseApp);

// Define activity interface with Firestore specifics
// *** Add lastMessageTimestamp (optional) ***
export interface Activity {
  id: string;
  title: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  // Consider changing dateTime to Firestore Timestamp for consistency if possible
  dateTime: string | FirestoreTimestamp; // Allow both for now if needed
  category: ActivityCategory;
  createdBy: {
    userId: string;
    displayName: string;
  };
  participantIds: string[];
  maxParticipants?: number;
  createdAt: number; // JS Timestamp (milliseconds from Date.now())
  isPublic: boolean;
  // *** Add the field here ***
  lastMessageTimestamp?: FirestoreTimestamp;
}

// Define input type for creating activities
export type NewActivity = Omit<
  Activity,
  'id' | 'participantIds' | 'createdAt' | 'lastMessageTimestamp' // Exclude new field too
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

  // --- Initialize Listener (Consider type safety) ---
  initializeListener: (userId = '', showFriendsOnly = false) => {
    console.log(`%cDEBUG: activityStore.initializeListener - Initializing... User: ${userId || 'None'}, ShowFriendsOnly: ${showFriendsOnly}`, 'color: brown;');
    set({ isLoading: true, error: null });
    // Adjust query based on userId/showFriendsOnly if needed later
    // For now, keeping the original query logic
    const q = query(
      collection(db, 'activities'),
      where('isPublic', '==', true),
      orderBy('dateTime')
    );
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        console.log(`%cDEBUG: activityStore.initializeListener - Snapshot received. Docs: ${querySnapshot.size}`, 'color: brown;');
        const activitiesData: Activity[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data(); // Get typed data potentially
          // Add more robust type checking if possible
          activitiesData.push({
            id: docSnap.id,
            title: data.title || 'Untitled',
            description: data.description || '',
            location: data.location || 'No location',
            latitude: typeof data.latitude === 'number' ? data.latitude : 0,
            longitude: typeof data.longitude === 'number' ? data.longitude : 0,
            // Keep dateTime as stored for now, handle conversion in UI if needed
            dateTime: data.dateTime || new Date().toISOString(), // Default to now if missing? Risky.
            category: data.category || 'Other',
            createdBy: {
              userId: data.createdBy?.userId || 'unknown',
              displayName: data.createdBy?.displayName || 'Unknown',
            },
            participantIds: Array.isArray(data.participantIds) ? data.participantIds : [],
            maxParticipants: typeof data.maxParticipants === 'number' ? data.maxParticipants : undefined,
            // createdAt should ideally be Firestore Timestamp, but using number from your code
            createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
            isPublic: typeof data.isPublic === 'boolean' ? data.isPublic : true,
            // *** Include lastMessageTimestamp when reading ***
            lastMessageTimestamp: data.lastMessageTimestamp instanceof FirestoreTimestamp ? data.lastMessageTimestamp : undefined,
          });
        });

        // Client-side sort by dateTime (as original code did)
        // The Firestore query in Chats.tsx handles the lastMessageTimestamp sort
        activitiesData.sort(
          (a, b) => {
              try {
                 // Assuming dateTime is string ISO format or Timestamp
                 const timeA = typeof a.dateTime === 'string' ? new Date(a.dateTime).getTime() : a.dateTime instanceof FirestoreTimestamp ? a.dateTime.toMillis() : 0;
                 const timeB = typeof b.dateTime === 'string' ? new Date(b.dateTime).getTime() : b.dateTime instanceof FirestoreTimestamp ? b.dateTime.toMillis() : 0;
                 return timeA - timeB;
              } catch (e) { return 0; } // Handle potential date parsing errors
          }
        );
        console.log(`%cDEBUG: activityStore.initializeListener - Setting ${activitiesData.length} activities.`, 'color: brown;');
        set({ activities: activitiesData, isLoading: false, error: null });
      },
      (error) => {
        console.error('%cDEBUG: activityStore.initializeListener - Error:', 'color: red;', error);
        set({ error, isLoading: false });
      }
    );

    // Return the unsubscribe function for cleanup
    return unsubscribe;
  },


  // --- Create Activity ---
  createActivity: async (activity) => {
     console.log('%cDEBUG: activityStore.createActivity - Attempting to create:', 'color: blue;', activity);
    try {
      const { title, description, location, latitude, longitude, dateTime, category, createdBy, maxParticipants, isPublic } =
        activity;

      // Basic validation
      if (!title || !description || !location || !dateTime || !category || !createdBy?.userId) {
         console.error('%cDEBUG: activityStore.createActivity - Missing required fields', 'color: red;', activity);
        throw new Error('Missing required fields for activity (title, description, location, dateTime, category, createdBy.userId)');
      }

      const activityRef = doc(collection(db, 'activities')); // Generate new Doc Ref
      const creationTimeMillis = Date.now(); // JS Timestamp for createdAt

      // *** Convert creationTimeMillis to Firestore Timestamp for lastMessageTimestamp ***
      const initialLastMessageTimestamp = FirestoreTimestamp.fromMillis(creationTimeMillis);

      const newActivityData = {
        title,
        description,
        location,
        latitude: latitude ?? 0, // Default latitude
        longitude: longitude ?? 0, // Default longitude
        // Store dateTime as provided (string or Timestamp) - Consider standardizing to Timestamp later
        dateTime: dateTime,
        category,
        createdBy: {
          userId: createdBy.userId,
          displayName: createdBy.displayName || 'Anonymous',
        },
        participantIds: [createdBy.userId], // Creator is the first participant
        createdAt: creationTimeMillis, // Store JS Timestamp for createdAt (as per original code)
        // *** Add the default lastMessageTimestamp ***
        lastMessageTimestamp: initialLastMessageTimestamp,
        // Only include maxParticipants if it's a positive number
        ...(maxParticipants && maxParticipants > 0 && { maxParticipants }),
        isPublic: isPublic ?? true, // Default to public if not specified
      };

      console.log('%cDEBUG: activityStore.createActivity - Data to be set:', 'color: blue;', newActivityData);
      await setDoc(activityRef, newActivityData);
      console.log(`%cDEBUG: activityStore.createActivity - Successfully created with ID: ${activityRef.id}`, 'color: green;');

      // Maybe automatically join/create chat here? Or keep it lazy? Current code assumes lazy.
      // Example: await useChatStore.getState().createOrJoinActivityChat(activityRef.id, { uid: createdBy.userId, displayName: createdBy.displayName } as any);


      return activityRef.id;
    } catch (error) {
      console.error('%cDEBUG: activityStore.createActivity - Error:', 'color: red;', error);
      set({ error: error as Error });
      throw error; // Re-throw error
    }
  },

  updateLastMessage: async (
    activityId: string,
    text: string,
    senderName: string,
    timestampMillis: number
  ) => {
    console.log(
      `%cDEBUG: activityStore.updateLastMessage – Updating activity ${activityId}`,
      'color: purple;'
    );
    const activityRef = doc(db, 'activities', activityId);
    await updateDoc(activityRef, {
      lastMessageText: text,
      lastMessageSenderName: senderName,
      lastMessageTimestamp: FirestoreTimestamp.fromMillis(timestampMillis)
    });
  },

  // --- Join Activity ---
  joinActivity: async (activityId, userId) => {
    // 1) Firestore: add user to participantIds
    const activityRef = doc(db, 'activities', activityId);
    await updateDoc(activityRef, {
      participantIds: arrayUnion(userId),
    });

  // 2) RTDB: write member with correct displayName
  const auth = getAuth(firebaseApp);
  const currentUser = auth.currentUser!;
  const displayName = currentUser.displayName || "Anonymous";

  const memberRef = rtdbRef(
    realtimeDb,
    `activity-chats/${activityId}/members/${userId}`
  );
  await rtdbSet(memberRef, {
    userId,
    displayName,
    joinedAt: Date.now()
  });
    console.log(`User ${displayName} joined RTDB chat members for activity ${activityId}`);
  },
  
  // --- Leave Activity ---
  leaveActivity: async (activityId, userId) => {
    console.log(`%cDEBUG: activityStore.leaveActivity - User: ${userId}, Activity: ${activityId}`, 'color: orange;');
    try {
      if (!activityId || !userId) {
        throw new Error('Activity ID and user ID are required');
      }
  
      const activityRef = doc(db, 'activities', activityId);
      const activityDoc = await getDoc(activityRef);
  
      if (!activityDoc.exists()) {
        console.warn(`%cDEBUG: activityStore.leaveActivity - Activity ${activityId} not found.`, 'color: orange;');
        throw new Error('Activity not found');
      }
  
      const activityData = activityDoc.data();
  
      // 🛑 Prevent creator from leaving their own activity
      if (activityData?.createdBy?.userId === userId) {
        console.error(`%cDEBUG: activityStore.leaveActivity - Creator ${userId} cannot leave their own activity ${activityId}.`, 'color: red;');
        throw new Error('You cannot leave an activity you created.');
      }
  
      // Atomically remove user ID
      await updateDoc(activityRef, {
        participantIds: arrayRemove(userId),
      });
      console.log(`%cDEBUG: activityStore.leaveActivity - Firestore updated for ${activityId}.`, 'color: orange;');
  
      // Leave the activity chat using the chatStore
      try {
        console.log(`%cDEBUG: activityStore.leaveActivity - Calling chatStore.leaveActivityChat for ${activityId}.`, 'color: orange;');
        await useChatStore.getState().leaveActivityChat(activityId, userId);
        console.log(`%cDEBUG: activityStore.leaveActivity - chatStore.leaveActivityChat completed for ${activityId}.`, 'color: green;');
      } catch (chatError) {
        console.error('%cDEBUG: activityStore.leaveActivity - Error calling leaveActivityChat, continuing leave operation:', 'color: red;', chatError);
      }
  
      console.log(`User ${userId} left activity ${activityId}`);
    } catch (error) {
      console.error(`%cDEBUG: activityStore.leaveActivity - Error leaving activity ${activityId}:`, 'color: red;', error);
      set({ error: error as Error });
      throw error;
    }
  },

  // --- isParticipant (uses local state) ---
  isParticipant: (activityId, userId) => {
    if (!activityId || !userId) return false;
    const activity = get().activities.find(a => a.id === activityId);
    const isPart = !!activity && Array.isArray(activity.participantIds) && activity.participantIds.includes(userId);
    // console.log(`%cDEBUG: activityStore.isParticipant - Activity: ${activityId}, User: ${userId}, Result: ${isPart}`, 'color: gray;');
    return isPart;
  },
  

   // --- Delete Activity ---
  deleteActivity: async (activityId, userId) => {
     console.log(`%cDEBUG: activityStore.deleteActivity - User: ${userId}, Activity: ${activityId}`, 'color: red; font-weight: bold;');
    try {
      if (!activityId || !userId) {
        throw new Error('Activity ID and user ID are required');
      }

      const activityRef = doc(db, 'activities', activityId);
      const activityDoc = await getDoc(activityRef); // Get doc to check creator

      if (!activityDoc.exists()) {
        console.warn(`%cDEBUG: activityStore.deleteActivity - Activity ${activityId} not found.`, 'color: orange;');
        throw new Error('Activity not found');
      }

      const activityData = activityDoc.data();

      // Authorization Check: Only the creator can delete
      if (activityData.createdBy?.userId !== userId) {
         console.error(`%cDEBUG: activityStore.deleteActivity - Unauthorized attempt by ${userId} to delete activity ${activityId} created by ${activityData.createdBy?.userId}.`, 'color: red;');
        throw new Error('Only the creator can delete this activity');
      }

      // Delete the activity document
      await deleteDoc(activityRef);
      console.log(`%cDEBUG: activityStore.deleteActivity - Firestore document ${activityId} deleted.`, 'color: red;');


      // Optional: Clean up chat data - This needs careful implementation
      // Consider using Firebase Functions for robust cleanup triggered by Firestore delete event
      console.warn(`%cDEBUG: activityStore.deleteActivity - Chat data cleanup for ${activityId} should be handled (e.g., via Firebase Functions or a separate cleanup task).`, 'color: orange;');
      // Example if you had a cleanup function in chatStore:
      // try {
      //   await useChatStore.getState().cleanupChatDataForActivity(activityId);
      // } catch (chatCleanupError) {
      //   console.error(`%cDEBUG: activityStore.deleteActivity - Error during chat cleanup for ${activityId}:`, 'color: red;', chatCleanupError);
      // }

      console.log(`Activity ${activityId} deleted successfully by owner ${userId}`);
    } catch (error) {
      console.error(`%cDEBUG: activityStore.deleteActivity - Error deleting activity ${activityId}:`, 'color: red;', error);
      set({ error: error as Error });
      throw error;
    }
  },
}));
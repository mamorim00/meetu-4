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
  Timestamp as FirestoreTimestamp, // *** Import Firestore Timestamp ***
  QuerySnapshot,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';
import { ActivityCategory } from '../pages/Feed'; // Ensure this path is correct
import { useChatStore } from './chatStore'; // Ensure this path is correct
import { ref as rtdbRef, set as rtdbSet } from "firebase/database";
import { realtimeDb } from "./firebase";    // your RTDB instance
import { getAuth } from "firebase/auth";
import { useFriendsStore } from './friendsStore';



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
  initializeListener: (
    userId: string,
    friendIds: string[],
    showPrivate?: boolean
  ) => () => void;
  createActivity: (activity: NewActivity) => Promise<string>;
  joinActivity: (activityId: string, userId: string) => Promise<void>;
  leaveActivity: (activityId: string, userId: string) => Promise<void>;
  deleteActivity: (activityId: string, userId: string) => Promise<void>;
  isParticipant: (activityId: string, userId: string) => boolean;
  updateActivity: (activityId: string, data: Partial<Activity>) => Promise<void>;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: [],
  isLoading: false,
  error: null,
  initializeListener: (
    userId: string,
    friendIds: string[],
    showFriendsOnly = false
  ) => {
    set({ isLoading: true, error: null });
    const dbRef = collection(db, 'activities');
  
    // build your final unique set here
    const allCreatorIds = Array.from(new Set([...friendIds, userId]));
    console.log('DEBUG: initializeListener: allCreatorIds =', allCreatorIds);
  
    const unsubscribers: (() => void)[] = [];
    const activitiesMap = new Map<string, Activity>();
  
  

  
    const processSnapshot = (snapshot: QuerySnapshot<DocumentData>) => {
      let hasChanged = false;
  
      snapshot.docChanges().forEach(change => {
        const activityId = change.doc.id;
  
        if (change.type === 'removed') {
          if (activitiesMap.delete(activityId)) {
            hasChanged = true;
          }
          return;
        }
  
        const data = change.doc.data();
        const activity: Activity = {
          id: activityId,
          title: data.title || 'Untitled',
          description: data.description || '',
          location: data.location || 'No location',
          latitude: typeof data.latitude === 'number' ? data.latitude : 0,
          longitude: typeof data.longitude === 'number' ? data.longitude : 0,
          dateTime: data.dateTime || new Date().toISOString(),
          category: data.category || 'Other',
          createdBy: {
            userId: data.createdBy?.userId || 'unknown',
            displayName: data.createdBy?.displayName || 'Unknown',
          },
          participantIds: Array.isArray(data.participantIds)
            ? data.participantIds
            : [],
          maxParticipants:
            typeof data.maxParticipants === 'number'
              ? data.maxParticipants
              : undefined,
          createdAt:
            typeof data.createdAt === 'number'
              ? data.createdAt
              : Date.now(),
          isPublic:
            typeof data.isPublic === 'boolean' ? data.isPublic : true,
          lastMessageTimestamp:
            data.lastMessageTimestamp instanceof FirestoreTimestamp
              ? data.lastMessageTimestamp
              : undefined,
        };
  
        const prev = activitiesMap.get(activityId);
        if (!prev || JSON.stringify(prev) !== JSON.stringify(activity)) {
          activitiesMap.set(activityId, activity);
          hasChanged = true;
        }
      });
  
      if (hasChanged) {
        const activitiesArray = Array.from(activitiesMap.values()).sort((a, b) => {
          const timeA =
            a.dateTime instanceof FirestoreTimestamp
              ? a.dateTime.toMillis()
              : new Date(a.dateTime).getTime();
          const timeB =
            b.dateTime instanceof FirestoreTimestamp
              ? b.dateTime.toMillis()
              : new Date(b.dateTime).getTime();
          return timeA - timeB;
        });
  
        console.log(
          `%cDEBUG: Realtime update, total activities: ${activitiesArray.length}`,
          'color: green'
        );
        set({ activities: activitiesArray, isLoading: false });
      }
    };
  
    const handleError = (err: FirestoreError) => {
      console.error('Snapshot error:', err);
      set({ error: err, isLoading: false });
    };
  
     
  // only subscribe to public if showFriendsOnly is false
  if (!showFriendsOnly) {
    const publicQ = query(
      dbRef,
      where('isPublic', '==', true),
      orderBy('dateTime', 'asc'),
    );
    unsubscribers.push(onSnapshot(publicQ, processSnapshot, handleError));
  }

  // chunk the allCreatorIds into 10‑sized slices
  for (let i = 0; i < allCreatorIds.length; i += 10) {
    const chunk = allCreatorIds.slice(i, i + 10);
    const privateQ = query(
      dbRef,
      where('createdBy.userId', 'in', chunk),
      orderBy('dateTime', 'asc')  // make sure you have the composite index, or remove this
    );
    unsubscribers.push(onSnapshot(privateQ, processSnapshot, handleError));
  }

  return () => unsubscribers.forEach((u) => u());
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

    /** Edit an existing activity document */
   updateActivity: async (activityId, data) => {
     const ref = doc(db, 'activities', activityId);
     // If dateTime was edited as a string, convert to Timestamp
     if (typeof data.dateTime === 'string') {
       data.dateTime = FirestoreTimestamp.fromDate(new Date(data.dateTime));
     }
     await updateDoc(ref, data);
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
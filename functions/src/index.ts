import { onDocumentUpdated, onDocumentCreated, onDocumentDeleted  } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize the Admin SDK
initializeApp();

// Explicitly grab a Firestore client
const db = getFirestore();

/**
 * Triggered when a friendRequests document is updated.
 * Checks for status change from 'pending' to 'accepted' and updates userProfiles.
 */
export const onActivityCreated = onDocumentCreated('activities/{activityId}', async (event) => {
    const activity = event.data?.data();
    const { activityId } = event.params;
  
    if (!activity?.ownerId) {
      console.warn(`No ownerId found for activity ${activityId}`);
      return;
    }
  
    const ownerSnap = await db.doc(`users/${activity.ownerId}`).get();
    const ownerData = ownerSnap.exists ? ownerSnap.data() : {};
  
    await db.doc(`chats/${activityId}/members/${activity.ownerId}`).set({
      joinedAt: FieldValue.serverTimestamp(),
      ...ownerData,
    });
  
    console.log(`Owner ${activity.ownerId} added to chat ${activityId}`);
  });
  
  
  // 2. When a participant is added, add them to the chat
  export const onParticipantAdded = onDocumentCreated('activities/{activityId}/participants/{userId}', async (event) => {
    const { activityId, userId } = event.params;
  
    const userSnap = await db.doc(`users/${userId}`).get();
    const userData = userSnap.exists ? userSnap.data() : {};
  
    await db.doc(`chats/${activityId}/members/${userId}`).set({
      joinedAt: FieldValue.serverTimestamp(),
      ...userData,
    });
  
    console.log(`Participant ${userId} added to chat ${activityId}`);
  });
  
  
  // 3. When a participant is removed, remove them from the chat
  export const onParticipantRemoved = onDocumentDeleted('activities/{activityId}/participants/{userId}', async (event) => {
    const { activityId, userId } = event.params;
  
    await db.doc(`chats/${activityId}/members/${userId}`).delete();
  
    console.log(`Participant ${userId} removed from chat ${activityId}`);
  });

export const onFriendRequestAccepted = onDocumentUpdated(
  'friendRequests/{requestId}',
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData  = event.data?.after?.data();

    if (!beforeData || !afterData) {
      console.warn('Missing before or after data on friendRequests update');
      return;
    }

    // Only proceed if status flipped pending -> accepted
    if (beforeData.status === 'pending' && afterData.status === 'accepted') {
      const { senderId, receiverId } = afterData;
      const profiles = db.collection('userProfiles');

      // Update both profiles in parallel, using the new FieldValue import
      await Promise.all([
        profiles.doc(senderId).update({
          friends: FieldValue.arrayUnion(receiverId),
        }),
        profiles.doc(receiverId).update({
          friends: FieldValue.arrayUnion(senderId),
        }),
      ]);

      console.log(`Updated friends arrays for ${senderId} and ${receiverId}`);
    }
  }
);

import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
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

export const onParticipantAdded = onDocumentUpdated(
    'activities/{activityId}/participants/{userId}',
    async (event) => {
      const { activityId, userId } = event.params;
  
      const before = event.data?.before.exists ? event.data.before.data() : null;
      const after = event.data?.after.exists ? event.data.after.data() : null;
  
      // If the participant was just added (doc didn't exist before), run logic
      if (!before && after) {
        const userSnap = await db.doc(`users/${userId}`).get();
        const userData = userSnap.exists ? userSnap.data() : {};
  
        await db.doc(`chats/${activityId}/members/${userId}`).set({
          joinedAt: FieldValue.serverTimestamp(),
          ...userData,
        });
  
        console.log(`User ${userId} added to chat ${activityId}`);
      }
    }
  );
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

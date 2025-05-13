import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

// Initialize the Admin SDK
admin.initializeApp();

/**
 * Triggered when a friendRequests document is updated.
 * Checks for status change from 'pending' to 'accepted' and updates userProfiles.
 */
export const onFriendRequestAccepted = onDocumentUpdated(
  'friendRequests/{requestId}',
  async (event) => {
    // v2 Firestore event provides data in event.data
    const beforeData = event.data?.before?.data();
    const afterData  = event.data?.after?.data();

    if (!beforeData || !afterData) {
      console.warn('Missing before or after data on friendRequests update');
      return;
    }

    // Only proceed if status flipped pending -> accepted
    if (beforeData.status === 'pending' && afterData.status === 'accepted') {
      const { senderId, receiverId } = afterData;
      const profiles = admin.firestore().collection('userProfiles');

      // Update both profiles in parallel
      await Promise.all([
        profiles.doc(senderId).update({
          friends: admin.firestore.FieldValue.arrayUnion(receiverId),
        }),
        profiles.doc(receiverId).update({
          friends: admin.firestore.FieldValue.arrayUnion(senderId),
        }),
      ]);

      console.log(`Updated friends arrays for ${senderId} and ${receiverId}`);
    }
  }
);

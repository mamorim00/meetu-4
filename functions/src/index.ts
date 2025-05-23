import { onDocumentUpdated, onDocumentCreated, onDocumentDeleted  } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';



// Initialize the Admin SDK
initializeApp();

// Explicitly grab a Firestore client
const db = getFirestore();
const rtdb = getDatabase();

// When a user is created or updated, add a lowercase version of their display name
export const onUserCreatedOrUpdated = onDocumentUpdated('users/{userId}', async (event) => {
  const after = event.data?.after?.data();
  const before = event.data?.before?.data();

  if (!after) {
    console.warn('Missing after data in user update');
    return;
  }

  // Only update if displayName changed or lowercase field is missing
  if (
    after.displayName &&
    (before?.displayName !== after.displayName || !after.displayName_lowercase)
  ) {
    const displayNameLower = after.displayName.toLowerCase();

    await db.doc(`users/${event.params.userId}`).update({
      displayName_lowercase: displayNameLower,
    });

    console.log(`Updated displayName_lowercase for user ${event.params.userId}`);
  }
});

export const onUserCreated = onDocumentCreated('users/{userId}', async (event) => {
  const data = event.data?.data();
  if (!data?.displayName) {
    console.warn(`User ${event.params.userId} created without a displayName`);
    return;
  }

  const displayNameLower = data.displayName.toLowerCase();

  await db.doc(`users/${event.params.userId}`).update({
    displayName_lowercase: displayNameLower,
  });

  console.log(`Created displayName_lowercase for user ${event.params.userId}`);
});


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

  await rtdb.ref(`activity-chats/${activityId}/members/${activity.ownerId}`).set({
    joinedAt: Date.now(),
    name: ownerData?.name ?? null,
  });

  console.log(`Owner ${activity.ownerId} added to activity-chats/${activityId}/members`);

  // Add lowercase title if title exists
  if (typeof activity.title === "string") {
    const titleLower = activity.title.toLowerCase();
    await db.doc(`activities/${activityId}`).update({
      title_lowercase: titleLower,
    });
    console.log(`Added title_lowercase="${titleLower}" to activity ${activityId}`);
  }
});

  
  
  // 2. When a participant is added, add them to the chat
  export const onParticipantAdded = onDocumentCreated('activities/{activityId}/participants/{userId}', async (event) => {
    const { activityId, userId } = event.params;
  
    const userSnap = await db.doc(`users/${userId}`).get();
    const userData = userSnap.exists ? userSnap.data() : {};
  
    await rtdb.ref(`activity-chats/${activityId}/members/${userId}`).set({
      joinedAt: Date.now(),
      name: userData?.name ?? null,
    });
  
    console.log(`Participant ${userId} added to activity-chats/${activityId}/members`);
  });
  
  
  // 3. When a participant is removed, remove them from the chat
  export const onParticipantRemoved = onDocumentDeleted('activities/{activityId}/participants/{userId}', async (event) => {
    const { activityId, userId } = event.params;
  
    await rtdb.ref(`activity-chats/${activityId}/members/${userId}`).remove();
  
    console.log(`Participant ${userId} removed from activity-chats/${activityId}/members`);
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

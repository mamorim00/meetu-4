import { onDocumentUpdated, onDocumentCreated, onDocumentDeleted  } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { onSchedule } from 'firebase-functions/v2/scheduler';

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


// ——————————————————————————————————
// 1) When an activity is created:
export const onActivityCreated = onDocumentCreated('activities/{activityId}', async (event) => {
  const activity   = event.data?.data();
  const { activityId } = event.params;

  if (!activity) {
    console.warn(`onActivityCreated: no data for ${activityId}`);
    return;
  }

  // 1️⃣ Add owner to RTDB members
  if (activity.ownerId) {
    const ownerSnap = await db.doc(`users/${activity.ownerId}`).get();
    const ownerData = ownerSnap.exists ? ownerSnap.data()! : {};

    await rtdb.ref(`activity-chats/${activityId}/members/${activity.ownerId}`).set({
      joinedAt: Date.now(),
      name:     ownerData.name || null,
    });

    // 1️⃣a Push “Chat created…” system message
    await rtdb.ref(`chat-messages/${activityId}`).push({
      senderId:   'system',
      senderName: 'System',
      text:       'Chat created. Welcome! Coordinate with participants here.',
      timestamp:  Date.now(),
      type:       'system'
    });

    console.log(`Owner ${activity.ownerId} added and welcome message sent for chat ${activityId}`);
  } else {
    console.warn(`onActivityCreated: No ownerId for ${activityId}`);
  }

  // 2️⃣ Add lowercase title
  if (typeof activity.title === "string") {
    const titleLower = activity.title.toLowerCase();
    await db.doc(`activities/${activityId}`).update({ title_lowercase: titleLower });
    console.log(`Added title_lowercase="${titleLower}" to activity ${activityId}`);
  }

    // 3️⃣ Set initial archived flag to false
    await db.doc(`activities/${activityId}`).update({ archived: false });
    console.log(`Set archived=false for activity ${activityId}`);

  
});

// 4) Scheduled function: archive past activities once a day

// 4) Scheduled function: archive past activities once a day
export const archivePastActivities = onSchedule('every day 00:00', async () => {
  const now = new Date();

  const snapshot = await db.collection('activities')
    .where('archived', '==', false)
    .where('dateTime', '<', now)
    .get();

  if (snapshot.empty) {
    console.log('No past activities to archive.');
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, { archived: true });
    console.log(`Archiving activity ${doc.id}`);
  });

  await batch.commit();
  console.log(`Archived ${snapshot.size} activities`);
});



// ——————————————————————————————————
// 2) When someone joins (participant subcollection created):
export const onParticipantAdded = onDocumentCreated(
  'activities/{activityId}/participants/{userId}',
  async (event) => {
    const { activityId, userId } = event.params;
    console.log('🐛 onParticipantAdded fired for', activityId, userId);
    const userSnap = await db.doc(`users/${userId}`).get();
    const userData = userSnap.exists ? userSnap.data()! : {};

    // 2️⃣a Add them into RTDB members
    await rtdb.ref(`activity-chats/${activityId}/members/${userId}`).set({
      joinedAt: Date.now(),
      name:     userData.name || null,
    });

    // 2️⃣b Push “X has joined…” system message
    await rtdb.ref(`chat-messages/${activityId}`).push({
      senderId:   'system',
      senderName: 'System',
      text:       `${userData.name || 'A participant'} has joined the chat.`,
      timestamp:  Date.now(),
      type:       'system'
    });

    console.log(`Participant ${userId} added and join message sent for chat ${activityId}`);
  }
);


// ——————————————————————————————————
// 3) When someone leaves (participant subcollection deleted):
export const onParticipantRemoved = onDocumentDeleted(
  'activities/{activityId}/participants/{userId}',
  async (event) => {
    const { activityId, userId } = event.params;
    const oldData = event.data?.data() || {};
    const displayName = oldData.displayName || 'A participant';

    // 3️⃣a Push “X has left…” system message
    await rtdb.ref(`chat-messages/${activityId}`).push({
      senderId:   'system',
      senderName: 'System',
      text:       `${displayName} has left the chat.`,
      timestamp:  Date.now(),
      type:       'system'
    });

    // 3️⃣b Remove from RTDB members
    await rtdb.ref(`activity-chats/${activityId}/members/${userId}`).remove();

    console.log(`Participant ${userId} removed and leave message sent for chat ${activityId}`);
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

export const cleanupInactiveChats = onSchedule('every day 01:00', async () => {
  const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;

  const chatRefs = await rtdb.ref('activity-chats').get();
  if (!chatRefs.exists()) {
    console.log('No chats to check.');
    return;
  }

  let deletedCount = 0;

  const deletions = Object.keys(chatRefs.val()).map(async (activityId) => {
    try {
      const activityDoc = await db.doc(`activities/${activityId}`).get();

      // If activity was deleted or is older than 5 days
      if (!activityDoc.exists) {
        console.log(`Activity ${activityId} was deleted. Removing chat.`);
        await deleteChat(activityId);
        deletedCount++;
      } else {
        const activityData = activityDoc.data();
        const activityDate = activityData?.dateTime?.toMillis?.() || new Date(activityData?.dateTime).getTime();

        if (activityDate && activityDate < fiveDaysAgo) {
          console.log(`Activity ${activityId} is older than 5 days. Removing chat.`);
          await deleteChat(activityId);
          deletedCount++;
        }
      }
    } catch (err) {
      console.warn(`Error processing activity ${activityId}:`, err);
    }
  });

  await Promise.all(deletions);

  console.log(`Cleanup done. Deleted ${deletedCount} inactive chats.`);
});

async function deleteChat(activityId: string) {
  // Remove chat messages
  await rtdb.ref(`chat-messages/${activityId}`).remove();
  // Remove members list
  await rtdb.ref(`activity-chats/${activityId}`).remove();
}
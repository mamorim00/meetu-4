import { onDocumentUpdated, onDocumentCreated, onDocumentDeleted  } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onValueCreated } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";



// Initialize the Admin SDK
initializeApp();

// Explicitly grab a Firestore client
const db = getFirestore();
const rtdb = getDatabase();
export const sendChatNotification = onValueCreated(
  {
    ref: "/chat-messages/{chatId}/{messageId}",
    // region: "europe-west1",
  },
  async (event) => {
    const chatId = event.params.chatId;
    const messageSnapshot = event.data;
    const messageData = messageSnapshot.val();

    if (!messageData) {
      console.log("⚠️ No data in new message snapshot; exiting.");
      return;
    }

    const senderId = messageData.senderId as string;
    const text = messageData.text as string;
    const senderName = (messageData.senderName as string) || "Someone";

    // ✅ Use already initialized Firestore client
    const activityDocRef = db.collection("activities").doc(chatId);
    const activitySnap = await activityDocRef.get();

    if (!activitySnap.exists) {
      console.log(`⚠️ No Firestore document for activities/${chatId}. Exiting.`);
      return;
    }

    const activityData = activitySnap.data()!;
    const participants = (activityData.participants as string[]) || [];

    if (!Array.isArray(participants) || participants.length === 0) {
      console.log(`⚠️ "participants" array missing or empty in activities/${chatId}.`);
      return;
    }

    const recipientUids = participants.filter((uid) => uid !== senderId);
    if (recipientUids.length === 0) {
      console.log("ℹ️ No one else to notify (sender is only participant). Exiting.");
      return;
    }

    const tokens: string[] = [];
    const usersCollection = db.collection("userProfiles");

    await Promise.all(
      recipientUids.map(async (uid) => {
        try {
          const userDoc = await usersCollection.doc(uid).get();
          if (!userDoc.exists) {
            console.log(`⚠️ No userProfiles/${uid} document found.`);
            return;
          }
          const userData = userDoc.data()!;
          const fcmToken = userData.fcmToken as string | undefined;
          if (typeof fcmToken === "string" && fcmToken.length > 0) {
            tokens.push(fcmToken);
          } else {
            console.log(`⚠️ No valid fcmToken for userProfiles/${uid}.`);
          }
        } catch (err) {
          console.error(`❌ Error fetching userProfiles/${uid}:`, err);
        }
      })
    );

    if (tokens.length === 0) {
      console.log("ℹ️ No FCM tokens found for recipients. Exiting.");
      return;
    }

    const truncatedText = text.length > 80 ? text.substring(0, 77) + "…" : text;
    const payload: admin.messaging.MessagingPayload = {
      notification: {
        title: senderName,
        body: truncatedText,
        sound: "default",
      },
      data: {
        chatId: chatId,
      },
    };

    try {
      const response = await admin.messaging().sendToDevice(tokens, payload);
      console.log(
        `✅ Notifications sent for chatId=${chatId}. Successes=${response.successCount}, Failures=${response.failureCount}`
      );
    } catch (error) {
      console.error("❌ Error sending FCM notifications:", error);
    }
  }
);


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
import { Timestamp } from 'firebase-admin/firestore';


// ——————————————————————————————————
// 1) When an activity is created:
export const onActivityCreated = onDocumentCreated('activities/{activityId}', async (event) => {
  const activity   = event.data?.data();
  const { activityId } = event.params;
  const tsMillis = Date.now();
  const tsFire = Timestamp.fromMillis(tsMillis);

  if (!activity) {
    console.warn(`onActivityCreated: no data for ${activityId}`);
    return;
  }

  try {
    // 🔑 Pull owner info out of your createdBy map
    const createdBy = activity.createdBy as {
      userId?: string;
      displayName?: string;
    };
    const ownerId = createdBy?.userId;
    const ownerName = createdBy?.displayName || null;

    if (ownerId) {
      // 1️⃣ Add owner to RTDB members
      await rtdb
        .ref(`activity-chats/${activityId}/members/${ownerId}`)
        .set({
          joinedAt: Date.now(),
          name: ownerName,
        });


  // 1a) Add to /user-chats/{ownerId}/{activityId}
      await rtdb.ref(`user-chats/${ownerId}/${activityId}`).set(true);

      // 1️⃣a Push “Chat created…” system message
      await rtdb.ref(`chat-messages/${activityId}`).push({
        senderId: 'system',
        senderName: 'System',
        text: 'Chat created. Welcome! Coordinate with participants here.',
        timestamp: Date.now(),
        type: 'system',
      });

      console.log(
        `Owner ${ownerId} (${ownerName}) added and welcome message sent for chat ${activityId}`
      );
    } else {
      console.warn(`onActivityCreated: No createdBy.userId for ${activityId}`);
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
  } catch (err) {
    console.error(`onActivityCreated [${activityId}] failed:`, err);
    throw err; // so the error surfaces in Cloud Functions logs
  }
   // 4) **CRITICAL**: set lastMessageTimestamp on your Firestore doc
   await db.doc(`activities/${activityId}`).update({
    lastMessageTimestamp: tsFire,
    title_lowercase:      (activity.title || '').toLowerCase(),
    archived:             false,
  });
  
});

export const onParticipantAdded = onDocumentUpdated(
  'activities/{activityId}',
  async (event) => {
    const { activityId } = event.params;

    const before = event.data?.before?.data();
    const after  = event.data?.after?.data();
    if (!before || !after) {
      console.warn(`onParticipantAdded: missing before/after for ${activityId}`);
      return;
    }

    const beforeIds = before.participantIds as string[] || [];
    const afterIds  = after.participantIds  as string[] || [];

    // Compute newly added user IDs
    const newlyAdded = afterIds.filter((id: string) => !beforeIds.includes(id));

    for (const userId of newlyAdded) {
      try {
        console.log('👤 Detected new participant:', userId, 'in activity', activityId);

        const userSnap  = await db.doc(`users/${userId}`).get();
        const userData  = userSnap.exists ? userSnap.data()! : {};
        const displayName = userData.displayName || userData.name || null;

        // 1️⃣ Add to RTDB members list
        await rtdb
          .ref(`activity-chats/${activityId}/members/${userId}`)
          .set({
            joinedAt: Date.now(),
            name:     displayName,
          });

        // 2️⃣ Maintain per-user index
        await rtdb
          .ref(`user-chats/${userId}/${activityId}`)
          .set(true);

        // 3️⃣ Send “X has joined” system message
        await rtdb
          .ref(`chat-messages/${activityId}`)
          .push({
            senderId:   'system',
            senderName: 'System',
            text:       `${displayName || 'A participant'} has joined the chat.`,
            timestamp:  Date.now(),
            type:       'system',
          });

        console.log(`✅ Participant ${userId} indexed and welcome message sent for chat ${activityId}`);
      } catch (err) {
        console.error(`❌ Failed to process new participant ${userId} for chat ${activityId}:`, err);
      }
    }
  }
);


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
// 3) When someone leaves (participant subcollection deleted):
export const onParticipantRemoved = onDocumentDeleted(
  'activities/{activityId}/participants/{userId}',
  async (event) => {
    const { activityId, userId } = event.params;
    const oldData     = event.data?.data() || {};
    const displayName = oldData.displayName || 'A participant';

    try {
      // 3️⃣a Push “X has left…” system message
      await rtdb
        .ref(`chat-messages/${activityId}`)
        .push({
          senderId:   'system',
          senderName: 'System',
          text:       `${displayName} has left the chat.`,
          timestamp:  Date.now(),
          type:       'system',
        });

      // 3️⃣b Remove from RTDB members
      await rtdb
        .ref(`activity-chats/${activityId}/members/${userId}`)
        .remove();

      // 3️⃣c Remove from per-user index
      await rtdb
        .ref(`user-chats/${userId}/${activityId}`)
        .remove();

      console.log(
        `✅ Participant ${userId} removed from members, index cleared, and leave message sent for chat ${activityId}`
      );
    } catch (err) {
      console.error(
        `❌ Error in onParticipantRemoved for user ${userId}, chat ${activityId}:`,
        err
      );
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
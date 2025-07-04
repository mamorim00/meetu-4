// ── index.ts (or index.js) ──

// 1) Firestore triggers
import { onDocumentUpdated, onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";

// 3) Scheduled triggers
import { onSchedule } from "firebase-functions/v2/scheduler";

// 4) Firebase-Admin imports
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
// import { initializeApp } from 'firebase-admin/app';

// 1) Import the v2 “onValueCreated” trigger, plus Firestore + RTDB Admin SDKs
import { onValueCreated } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";
// ────────────────────────────────────────────────────────────────────────────
// Initialize the Admin SDK exactly once
// ────────────────────────────────────────────────────────────────────────────
//const serviceAccount = require("../serviceAccountKey.json");
//const PROJECT_ID = "meetudatabutton-default";

// ────────────────────────────────────────────────────────────────────────────
// Initialize the Admin SDK exactly once, using default credentials.
// In Cloud Functions, this picks up the built-in service account
// that already has Firestore/RTDB/FCM permissions.
// ────────────────────────────────────────────────────────────────────────────
admin.initializeApp({
  databaseURL: "https://meetudatabutton-default-rtdb.europe-west1.firebasedatabase.app"
});

// ────────────────────────────────────────────────────────────────────────────
// Grab Firestore + Realtime Database references
// ────────────────────────────────────────────────────────────────────────────
const db = getFirestore();
const rtdb = getDatabase();

// ────────────────────────────────────────────────────────────────────────────
// Cloud Function: sendChatNotification
//
// Listens for new children under:
//    /chat-messages/{activityId}/{messageId}
// and sends an FCM multicast to all other participants.
// ────────────────────────────────────────────────────────────────────────────

export const sendChatNotification = onValueCreated(
  {
    ref: "/chat-messages/{activityId}/{messageId}",
    instance: "meetudatabutton-default-rtdb",
    region:    "europe-west1",
  },
  async (event) => {
    const activityId = event.params.activityId;
    const messageData = event.data.val();
    if (
      !messageData ||
      typeof messageData.text !== "string" ||
      messageData.text.trim() === ""
    ) {
      console.log("⚠️ No valid text; exiting.");
      return;
    }

    const senderId   = messageData.senderId as string;
    const fullText   = messageData.text as string;
    const senderName = (messageData.senderName as string) || "Someone";
    const truncatedText =
      fullText.length > 80 ? fullText.substring(0, 77) + "…" : fullText;

    // 1) Load the Activity document to get participantIds
    const activitySnap = await db.collection("activities").doc(activityId).get();
    if (!activitySnap.exists) {
      console.log(`⚠️ activities/${activityId} missing; exiting.`);
      return;
    }
    const activityData = activitySnap.data()!;
    const participantIds = (activityData.participantIds as string[]) || [];
    const recipientUids  = participantIds.filter((uid) => uid !== senderId);
    if (recipientUids.length === 0) {
      console.log("ℹ️ No other participants; exiting.");
      return;
    }

    // 2) Gather FCM tokens for each recipient
    const tokens: string[] = [];
    await Promise.all(
      recipientUids.map(async (uid) => {
        try {
          const userDoc = await db.collection("userProfiles").doc(uid).get();
          if (!userDoc.exists) return;
          const userData = userDoc.data()!;
          const fcmToken    = userData.fcmToken as string | undefined;
          const webFcmToken = userData.webFcmToken as string | undefined;
          if (fcmToken) tokens.push(fcmToken);
          if (webFcmToken) tokens.push(webFcmToken);
        } catch (err) {
          console.error(`❌ error fetching userProfiles/${uid}:`, err);
        }
      })
    );
    if (tokens.length === 0) {
      console.log("ℹ️ No tokens found; exiting.");
      return;
    }

    // 3) Optional: compute a dynamic badge count
    // For simplicity, we’ll just send badge=1. If you want to show “total unread”:
    // you could query Firestore for unread‐count and set badgeCount accordingly.
    const badgeCount = 1;

    // 4) Build and send the notification to each token
    const sendPromises = tokens.map((token) => {
      const message: admin.messaging.Message = {
        token: token,
        notification: {
          title: senderName,
          body:  truncatedText,
        },
        data: {
          activityId: activityId,
        },
        android: {
          notification: { sound: "default" }
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: badgeCount,
            }
          }
        }
      };
      return admin.messaging().send(message);
    });

    try {
      const results = await Promise.allSettled(sendPromises);
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failureCount = results.length - successCount;
      console.log(
        `✅ send() done. Success: ${successCount}, Failures: ${failureCount}`
      );
      results.forEach((r, idx) => {
        if (r.status === "rejected") {
          console.warn(`❌ Token[${idx}] failed:`, (r as PromiseRejectedResult).reason);
        }
      });
    } catch (err) {
      console.error("❌ Unexpected error during send():", err);
    }
  }
);
// ────────────────────────────────────────────────────────────────────────────
// ── 2) onUserCreatedOrUpdated: lowercases displayName whenever a user document is updated
// ────────────────────────────────────────────────────────────────────────────
export const onUserCreatedOrUpdated = onDocumentUpdated("userProfiles/{userId}", async (event) => {
  const after = event.data?.after?.data();
  const before = event.data?.before?.data();

  if (!after) {
    console.warn("Missing after data in user update");
    return;
  }

  // Only update if displayName changed or lowercase field is missing
  if (
    after.displayName &&
    (before?.displayName !== after.displayName || !after.displayName_lowercase)
  ) {
    const displayNameLower = after.displayName.toLowerCase();

    await db.doc(`userProfiles/${event.params.userId}`).update({
      displayName_lowercase: displayNameLower,
    });

    console.log(`Updated displayName_lowercase for user ${event.params.userId}`);
  }
});

export const onUserCreated = onDocumentCreated("userProfiles/{userId}", async (event) => {
  const data = event.data?.data();
  if (!data?.displayName) {
    console.warn(`User ${event.params.userId} created without a displayName`);
    return;
  }

  const displayNameLower = data.displayName.toLowerCase();

  await db.doc(`userProfiles/${event.params.userId}`).update({
    displayName_lowercase: displayNameLower,
  });

  console.log(`Created displayName_lowercase for user ${event.params.userId}`);
});


// ────────────────────────────────────────────────────────────────────────────
// ── 3) onActivityCreated: initialize RTDB indices and set defaults on Firestore activity documents
// ────────────────────────────────────────────────────────────────────────────
export const onActivityCreated = onDocumentCreated("activities/{activityId}", async (event) => {
  const activity = event.data?.data();
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
        senderId: "system",
        senderName: "System",
        text: "Chat created. Welcome! Coordinate with participants here.",
        timestamp: Date.now(),
        type: "system",
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
    title_lowercase: (activity.title || "").toLowerCase(),
    archived: false,
  });
});


// ────────────────────────────────────────────────────────────────────────────
// ── 4) onParticipantAdded: when someone is added to activities/{activityId}.participantIds
// ────────────────────────────────────────────────────────────────────────────
export const onParticipantAdded = onDocumentUpdated("activities/{activityId}", async (event) => {
  const { activityId } = event.params;

  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!before || !after) {
    console.warn(`onParticipantAdded: missing before/after for ${activityId}`);
    return;
  }

  const beforeIds = (before.participantIds as string[]) || [];
  const afterIds = (after.participantIds as string[]) || [];

  // Compute newly added user IDs
  const newlyAdded = afterIds.filter((id: string) => !beforeIds.includes(id));

  for (const userId of newlyAdded) {
    try {
      console.log("👤 Detected new participant:", userId, "in activity", activityId);

      const userSnap = await db.doc(`userProfiles/${userId}`).get();
      const userData = userSnap.exists ? userSnap.data()! : {};
      const displayName = userData.displayName || userData.name || null;

      // 1️⃣ Add to RTDB members list
      await rtdb.ref(`activity-chats/${activityId}/members/${userId}`).set({
        joinedAt: Date.now(),
        name: displayName,
      });

      // 2️⃣ Maintain per-user index
      await rtdb.ref(`user-chats/${userId}/${activityId}`).set(true);

      // 3️⃣ Send “X has joined” system message
      await rtdb.ref(`chat-messages/${activityId}`).push({
        senderId: "system",
        senderName: "System",
        text: `${displayName || "A participant"} has joined the chat.`,
        timestamp: Date.now(),
        type: "system",
      });

      console.log(
        `✅ Participant ${userId} indexed and welcome message sent for chat ${activityId}`
      );
    } catch (err) {
      console.error(`❌ Failed to process new participant ${userId} for chat ${activityId}:`, err);
    }
  }
});

// ────────────────────────────────────────────────────────────────────────────
// ── 5) archivePastActivities: run every day at midnight to archive old activities
// ────────────────────────────────────────────────────────────────────────────
export const archivePastActivities = onSchedule("every day 00:00", async () => {
  const now = new Date();
  // Define what "old" means for deletion (e.g., activities older than 30 days)
  const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

  const activitiesToArchiveSnapshot = await db
    .collection("activities")
    .where("archived", "==", false)
    .where("dateTime", "<", now) // Activities whose date/time has passed
    .get();

  const activitiesToDeleteChatsSnapshot = await db
    .collection("activities")
    .where("dateTime", "<", thirtyDaysAgo) // Activities older than 30 days
    .get();

  if (activitiesToArchiveSnapshot.empty && activitiesToDeleteChatsSnapshot.empty) {
    console.log("No activities to archive or delete chats for.");
    return;
  }

  const batch = db.batch();
  let archivedCount = 0;
  let chatDeletedCount = 0;
  const chatDeletionPromises: Promise<void>[] = [];

  // --- Archive activities ---
  activitiesToArchiveSnapshot.docs.forEach((doc) => {
    if (!doc.data().archived) { // Double-check if not already archived
      batch.update(doc.ref, { archived: true });
      console.log(`Archiving activity ${doc.id}`);
      archivedCount++;
    }
  });

  // --- Delete chats for very old activities ---
  activitiesToDeleteChatsSnapshot.docs.forEach((doc) => {
    const activityId = doc.id;
    console.log(`Scheduling chat deletion for very old activity ${activityId}`);
    chatDeletionPromises.push(deleteChat(activityId).then(() => {
      chatDeletedCount++;
    }).catch(err => {
      console.error(`Error deleting chat for activity ${activityId}:`, err);
    }));
    // Optionally, you might want to delete the Firestore activity document itself
    // if you consider it entirely purged after chat deletion.
    // batch.delete(doc.ref);
  });

  // Commit Firestore batch operations
  if (archivedCount > 0) {
    await batch.commit();
    console.log(`Archived ${archivedCount} activities in Firestore.`);
  } else {
    console.log("No new activities to archive today.");
  }

  // Wait for all chat deletions to complete
  if (chatDeletionPromises.length > 0) {
    await Promise.allSettled(chatDeletionPromises); // Use allSettled to ensure all promises run even if some fail
    console.log(`Deleted chats for ${chatDeletedCount} old activities in Realtime Database.`);
  } else {
    console.log("No old chats to delete today.");
  }

  console.log("Daily cleanup routine complete.");
});

// ────────────────────────────────────────────────────────────────────────────
// ── 6) onParticipantRemoved: fires when a participant subdocument is deleted
// ────────────────────────────────────────────────────────────────────────────
export const onParticipantRemoved = onDocumentDeleted(
  "activities/{activityId}/participants/{userId}",
  async (event) => {
    const { activityId, userId } = event.params;
    const oldData = event.data?.data() || {};
    const displayName = oldData.displayName || "A participant";

    try {
      // 3️⃣a Push “X has left…” system message
      await rtdb.ref(`chat-messages/${activityId}`).push({
        senderId: "system",
        senderName: "System",
        text: `${displayName} has left the chat.`,
        timestamp: Date.now(),
        type: "system",
      });

      // 3️⃣b Remove from RTDB members
      await rtdb.ref(`activity-chats/${activityId}/members/${userId}`).remove();

      // 3️⃣c Remove from per-user index
      await rtdb.ref(`user-chats/${userId}/${activityId}`).remove();

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


// ────────────────────────────────────────────────────────────────────────────
// ── 7) onFriendRequestAccepted: when a friendRequests/{requestId} flips to “accepted”
// ────────────────────────────────────────────────────────────────────────────
export const onFriendRequestAccepted = onDocumentUpdated(
  "friendRequests/{requestId}",
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();

    if (!beforeData || !afterData) {
      console.warn("Missing before or after data on friendRequests update");
      return;
    }

    // Only proceed if status flipped pending -> accepted
    if (beforeData.status === "pending" && afterData.status === "accepted") {
      const { senderId, receiverId } = afterData;
      const profiles = db.collection("userProfiles");

      // Update both profiles in parallel, using FieldValue.arrayUnion
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


// ────────────────────────────────────────────────────────────────────────────
// ── 8) cleanupInactiveChats: daily cleanup for old or deleted chats
// ────────────────────────────────────────────────────────────────────────────
export const cleanupInactiveChats = onSchedule("every day 01:00", async () => {
  const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;

  const chatRefs = await rtdb.ref("activity-chats").get();
  if (!chatRefs.exists()) {
    console.log("No chats to check.");
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
        const activityDate =
          activityData?.dateTime?.toMillis?.() || new Date(activityData?.dateTime).getTime();

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

async function removeBlockerFromSharedActivitiesAndChats(blockerId: string, targetId: string) {
  console.log(`Checking for shared activities between blocker ${blockerId} and target ${targetId}...`);

  // 1. Find all activities the blocker is currently a part of.
  const activitiesRef = db.collection("activities");
  const snapshot = await activitiesRef.where("participantIds", "array-contains", blockerId).get();

  if (snapshot.empty) {
      console.log(`Blocker ${blockerId} is not in any activities.`);
      return;
  }

  const batch = db.batch();
  let sharedActivitiesFound = 0;

  // 2. Filter these activities to find the ones shared with the target.
  for (const doc of snapshot.docs) {
      const activity = doc.data();
      const activityId = doc.id;

      // A "shared activity" is one where the target is either the creator or another participant.
      const isShared = (activity.createdBy.userId === targetId) || (activity.participantIds.includes(targetId));

      if (isShared) {
          sharedActivitiesFound++;
          console.log(`Found shared activity: ${activityId}. Removing blocker ${blockerId}.`);
          
          // 3a. Remove the blocker from the activity's participants list in Firestore.
          batch.update(doc.ref, {
              participantIds: FieldValue.arrayRemove(blockerId)
          });

          // 3b. Remove the blocker from the corresponding chat in Realtime Database.
          await rtdb.ref(`activity-chats/${activityId}/members/${blockerId}`).remove();
          await rtdb.ref(`user-chats/${blockerId}/${activityId}`).remove();

          // 3c. (Optional) Post a "User has left" system message to the chat.
          await rtdb.ref(`chat-messages/${activityId}`).push({
              senderId: "system",
              senderName: "System",
              text: `${activity.createdBy.displayName || "A participant"} has left the chat.`, // Use a generic name
              timestamp: Date.now(),
              type: "system",
          });
      }
  }

  // 4. Commit all the Firestore updates at once.
  if (sharedActivitiesFound > 0) {
      await batch.commit();
      console.log(`✅ Successfully removed blocker ${blockerId} from ${sharedActivitiesFound} shared activities.`);
  } else {
      console.log(`No shared activities found between ${blockerId} and ${targetId}.`);
  }
}


/**
* UPDATED FUNCTION
* Listens for updates on a user's profile. When a user blocks someone,
* it now also triggers the cleanup of shared activities.
*/
export const syncBlocklistChanges = onDocumentUpdated("userProfiles/{userId}", async (event) => {
  const beforeData = event.data?.before.data();
  const afterData = event.data?.after.data();
  const blockerId = event.params.userId;

  if (!beforeData || !afterData) {
      console.log("No data change to process.");
      return;
  }

  const beforeBlockedIds = new Set<string>(beforeData.blockedUsers || []);
  const afterBlockedIds = new Set<string>(afterData.blockedUsers || []);

  const newlyBlocked = [...afterBlockedIds].filter(id => !beforeBlockedIds.has(id));
  const newlyUnblocked = [...beforeBlockedIds].filter(id => !afterBlockedIds.has(id));

  const promises: Promise<any>[] = [];

  // Process newly blocked users
  if (newlyBlocked.length > 0) {
      console.log(`User ${blockerId} blocked:`, newlyBlocked);
      for (const targetId of newlyBlocked) {
          const targetUserRef = db.collection("userProfiles").doc(targetId);
          
          // Promise 1: Update the target's 'blockedBy' list.
          promises.push(targetUserRef.update({
              blockedBy: FieldValue.arrayUnion(blockerId)
          }));
          
          // --- NEW ---
          // Promise 2: Remove the blocker from any activities/chats shared with the target.
          promises.push(removeBlockerFromSharedActivitiesAndChats(blockerId, targetId));
      }
  }

  // Process newly unblocked users
  if (newlyUnblocked.length > 0) {
      console.log(`User ${blockerId} unblocked:`, newlyUnblocked);
      for (const targetId of newlyUnblocked) {
          const targetUserRef = db.collection("userProfiles").doc(targetId);
          promises.push(targetUserRef.update({
              blockedBy: FieldValue.arrayRemove(blockerId)
          }));
      }
  }

  // Execute all the updates
  if (promises.length > 0) {
      try {
          await Promise.all(promises);
          console.log(`✅ Successfully synced blocklist changes and actions for ${blockerId}.`);
      } catch (error) {
          console.error(`❌ Failed to sync blocklist changes for ${blockerId}:`, error);
      }
  }
});
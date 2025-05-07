import { create } from 'zustand';
//import { ref, set, onValue, push, update, remove, serverTimestamp, off, DatabaseReference, DataSnapshot, query, orderByChild, endAt } from 'firebase/database';
import { User, getAuth } from 'firebase/auth';
import { toast } from "sonner";
import { realtimeDb, firestore } from './firebase'; // Import firestore
import { doc, updateDoc, Timestamp as FirestoreTimestamp } from 'firebase/firestore'; // Import firestore functions

import {
  ref,
  set    as rtdbSet,
  onValue,
  push,
  update as rtdbUpdate,
  remove as rtdbRemove,
  serverTimestamp, 
  off, 
  DatabaseReference, 
  DataSnapshot, 
  query, 
  orderByChild, 
  endAt
} from "firebase/database";

// Define message interface
export interface ChatMessage {
  id: string;
  activityId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number; // JS Timestamp (milliseconds)
}

// Define chat member interface
export interface ChatMember {
  userId: string;
  displayName: string;
  joinedAt: number; // JS Timestamp (milliseconds)
}

// Define chat interface (as stored in RTDB activity-chats)
export interface Chat {
  id: string; // Usually same as activityId
  activityId: string;
  members: Record<string, ChatMember>;
  createdAt: number; // JS Timestamp (milliseconds)
}

// Define store state
interface ChatState {
  currentChatId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: Error | null;
  messageListeners: Record<string, () => void>; // Stores unsubscribe functions
  unreadCounts: Record<string, number>;
  totalUnreadCount: number;

  // Function to mark chat as read
  markChatAsRead: (activityId: string) => void;

  // Initialize chat listeners
  subscribeToChat: (activityId: string, userId: string) => Promise<void>;
  unsubscribeFromChat: () => void;

  // Chat creation and management
  createOrJoinActivityChat: (activityId: string, user: User) => Promise<void>;
  leaveActivityChat: (activityId: string, userId: string) => Promise<void>;

  // Message functions
  sendMessage: (activityId: string, user: User, text: string) => Promise<string | null | undefined>; // Adjusted return type

  // Cleanup functions
  cleanupExpiredMessages: (activityId: string) => Promise<number>;
}

// Create store
export const useChatStore = create<ChatState>((set, get) => {
  // Create the store object
  const store: ChatState = {
    currentChatId: null,
    messages: [],
    isLoading: false,
    error: null,
    messageListeners: {},
    unreadCounts: {},
    totalUnreadCount: 0,

    // Mark all messages in a chat as read
    markChatAsRead: (activityId: string) => {
      const now = Date.now();
      const nowStr = new Date(now).toISOString();
      console.log(`%cDEBUG: markChatAsRead - Activity: ${activityId}, Setting last_viewed_${activityId} to ${now} (${nowStr})`, 'color: #FF9800; font-weight: bold;');
      // Store last viewed timestamp using JS milliseconds
      localStorage.setItem(`last_viewed_${activityId}`, String(now));

      set(state => {
        const newUnreadCounts = { ...state.unreadCounts };
        const hadUnread = activityId in newUnreadCounts && newUnreadCounts[activityId] > 0;
        // Remove the count for this chat
        delete newUnreadCounts[activityId];
        const totalCount = Object.values(newUnreadCounts).reduce((sum, count) => sum + count, 0);

        if (hadUnread) {
           console.log(`%cDEBUG: markChatAsRead - Cleared unread count for ${activityId}. New total: ${totalCount}`, 'color: #FF9800;');
        } else {
            console.log(`%cDEBUG: markChatAsRead - No unread count to clear for ${activityId}. Total remains: ${totalCount}`, 'color: gray;');
        }

        return {
          unreadCounts: newUnreadCounts,
          totalUnreadCount: totalCount
        };
      });
    },

    // Subscribe to chat messages for an activity
    subscribeToChat: async (activityId: string, userId: string) => {
      console.log(`%cDEBUG: subscribeToChat START - Activity: ${activityId}, User: ${userId}`, 'color: #2196F3; font-weight: bold;');
      try {
        set({ isLoading: true, error: null, messages: [], currentChatId: activityId }); // Reset messages for the new chat

        // Clear any existing listeners for this specific activity ID if re-subscribing
        const existingListeners = get().messageListeners;
        if (existingListeners[activityId]) {
            console.log(`%cDEBUG: subscribeToChat - Unsubscribing existing message listener for ${activityId}`, 'color: orange;');
            existingListeners[activityId]();
        }
         if (existingListeners[`chat_${activityId}`]) {
             console.log(`%cDEBUG: subscribeToChat - Unsubscribing existing chat listener for ${activityId}`, 'color: orange;');
            existingListeners[`chat_${activityId}`]();
        }

        const db = realtimeDb;
        if (!db) {
            console.error('%cDEBUG: subscribeToChat ERROR - Realtime Database not available', 'color: red;');
            throw new Error('Realtime Database not available - please reload the page');
        }
        console.log('%cDEBUG: subscribeToChat - Using initialized Realtime Database', 'color: #4CAF50;');

        // Get chat ID for this activity (assuming chat info is at activity-chats/{activityId})
        const chatRef = ref(db, `activity-chats/${activityId}`);
        console.log(`%cDEBUG: subscribeToChat - Chat reference path: ${chatRef.toString()}`, 'color: #2196F3;');

        // --- Listener for Chat Metadata (Optional, if needed) ---
        const unsubscribeChat = onValue(chatRef, (snapshot: DataSnapshot) => {
           console.log(`%cDEBUG: subscribeToChat [Chat Listener] - Snapshot received for ${activityId}. Exists: ${snapshot.exists()}. Path: ${chatRef.toString()}`, 'color: blue;');
           // You could update members or other chat metadata here if needed
           // const chatData = snapshot.val();
           // if (chatData) set({ currentChatId: chatData.id || activityId }); // Ensure currentChatId is set
        }, (error) => {
           console.error(`%cDEBUG: subscribeToChat [Chat Listener] - Error for ${activityId}:`, 'color: red;', error);
           set({ error: error as Error, isLoading: false });
        });

        // --- Listener for Messages ---
        const messagesRef = ref(db, `chat-messages/${activityId}`);
        console.log(`%cDEBUG: subscribeToChat - Setting up messages listener for path: ${messagesRef.toString()}`, 'color: #2196F3;');

        const unsubscribeMessages = onValue(messagesRef, (snapshot: DataSnapshot) => {
          const receiveTime = Date.now();
          console.log(`%cDEBUG: subscribeToChat [Messages Listener] - Received snapshot for ${activityId}. Exists: ${snapshot.exists()}. Timestamp: ${new Date(receiveTime).toISOString()}`, 'color: green;');

          const messagesData = snapshot.val();
          const formattedMessages: ChatMessage[] = [];
          let latestTimestamp = 0; // Track latest timestamp for debug

          if (messagesData) {
             console.log(`%cDEBUG: subscribeToChat [Messages Listener] - Processing ${Object.keys(messagesData).length} raw message entries for ${activityId}...`, 'color: green;');
            Object.keys(messagesData).forEach(key => {
              const message = messagesData[key];
              if (message && typeof message.timestamp === 'number' && message.senderId && message.text) {
                  // Basic validation
                  const timestamp = message.timestamp;
                  latestTimestamp = Math.max(latestTimestamp, timestamp); // Update latest timestamp
                  formattedMessages.push({
                    id: key,
                    activityId,
                    senderId: message.senderId,
                    senderName: message.senderName || 'Unknown',
                    text: message.text,
                    timestamp: timestamp // Use JS timestamp
                  });
              } else {
                  console.warn(`%cDEBUG: subscribeToChat [Messages Listener] - Skipping invalid message entry for ${activityId}, Key: ${key}`, 'color: orange;', message);
              }
            });

            formattedMessages.sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp ascending
             console.log(`%cDEBUG: subscribeToChat [Messages Listener] - Processed ${formattedMessages.length} valid messages for ${activityId}. Latest Timestamp: ${new Date(latestTimestamp).toISOString()}`, 'color: green;');

             // --- Unread Count Logic ---
             // Use JS timestamp from localStorage
             const lastViewedTimestampStr = localStorage.getItem(`last_viewed_${activityId}`) || '0';
             const lastViewedTimestamp = parseInt(lastViewedTimestampStr, 10);
             if (isNaN(lastViewedTimestamp)) {
                 console.warn(`%cDEBUG: subscribeToChat [Unread Calc] - Invalid lastViewedTimestamp found in localStorage for ${activityId}. Defaulting to 0.`, 'color: orange;');
             }
             console.log(`%cDEBUG: subscribeToChat [Unread Calc] - Activity: ${activityId}, Last Viewed: ${new Date(lastViewedTimestamp).toISOString()} (${lastViewedTimestamp})`, 'color: #FFC107;');

             const newMessages = formattedMessages.filter(msg =>
               msg.senderId !== userId && msg.timestamp > lastViewedTimestamp
             );
             console.log(`%cDEBUG: subscribeToChat [Unread Calc] - Activity: ${activityId}, Found ${newMessages.length} potential new messages since last view.`, 'color: #FFC107;', newMessages.map(m => ({id: m.id, time: new Date(m.timestamp).toISOString(), sender: m.senderId})) );

             // Update unread count only if this is NOT the currently active chat
             // The check `get().currentChatId !== activityId` determines if the user is actively viewing THIS chat.
             if (get().currentChatId !== activityId) {
               if (newMessages.length > 0) {
                 set(state => {
                   const currentUnread = state.unreadCounts[activityId] || 0;
                   if (currentUnread !== newMessages.length) {
                       const newUnreadCounts = { ...state.unreadCounts, [activityId]: newMessages.length };
                       const totalCount = Object.values(newUnreadCounts).reduce((sum, count) => sum + count, 0);
                       console.log(`%cDEBUG: subscribeToChat [Unread Update] - Updating unread count for INACTIVE chat ${activityId} to ${newMessages.length}. New total: ${totalCount}`, 'color: #FF9800; font-weight: bold;');
                       return { ...state, unreadCounts: newUnreadCounts, totalUnreadCount: totalCount };
                   } else {
                       console.log(`%cDEBUG: subscribeToChat [Unread Update] - Unread count for INACTIVE chat ${activityId} is already ${newMessages.length}. No state change.`, 'color: gray;');
                       return state; // No change needed
                   }
                 });
               } else {
                   // If there are no new messages, ensure the count is removed if it exists for an inactive chat
                   set(state => {
                       if (state.unreadCounts[activityId]) {
                           const newUnreadCounts = { ...state.unreadCounts };
                           delete newUnreadCounts[activityId];
                           const totalCount = Object.values(newUnreadCounts).reduce((sum, count) => sum + count, 0);
                           console.log(`%cDEBUG: subscribeToChat [Unread Update] - Removing unread count for INACTIVE chat ${activityId} as there are no new messages. New total: ${totalCount}`, 'color: #FF9800;');
                           return { ...state, unreadCounts: newUnreadCounts, totalUnreadCount: totalCount };
                       }
                       return state; // No change needed
                   });
               }
             } else {
                 // If it IS the current chat, ensure its unread count is 0 (as the user is viewing it)
                 // This handles the case where markChatAsRead might not have triggered yet, or new messages arrive while viewing.
                  set(state => {
                      if (state.unreadCounts[activityId]) {
                          const newUnreadCounts = { ...state.unreadCounts };
                          delete newUnreadCounts[activityId];
                          const totalCount = Object.values(newUnreadCounts).reduce((sum, count) => sum + count, 0);
                           console.log(`%cDEBUG: subscribeToChat [Unread Update] - Removing unread count for ACTIVE chat ${activityId}. New total: ${totalCount}`, 'color: #FF9800;');
                          return { ...state, unreadCounts: newUnreadCounts, totalUnreadCount: totalCount };
                      }
                      return state; // No change needed
                  });
                console.log(`%cDEBUG: subscribeToChat [Unread Calc] - Activity ${activityId} is the CURRENT chat. Global unread count for this chat is kept at 0.`, 'color: gray;');
             }
             // --- End Unread Count Logic ---

          } else {
             console.log(`%cDEBUG: subscribeToChat [Messages Listener] - No messages data found for ${activityId}.`, 'color: green;');
             // Ensure unread count is cleared if no messages exist
              set(state => {
                  if (state.unreadCounts[activityId]) {
                      const newUnreadCounts = { ...state.unreadCounts };
                      delete newUnreadCounts[activityId];
                      const totalCount = Object.values(newUnreadCounts).reduce((sum, count) => sum + count, 0);
                      console.log(`%cDEBUG: subscribeToChat [Unread Update] - Removing unread count for chat ${activityId} as it has no messages. New total: ${totalCount}`, 'color: #FF9800;');
                      return { ...state, unreadCounts: newUnreadCounts, totalUnreadCount: totalCount };
                  }
                  return state;
              });
          }

           // Update messages in state regardless of unread count logic
           set(state => {
               console.log(`%cDEBUG: subscribeToChat [State Update] - Setting messages for ${activityId}. Count: ${formattedMessages.length}. isLoading: false.`, 'color: #00BCD4;');
               // Prevent unnecessary re-renders if the message list content is identical
               if (JSON.stringify(state.messages) !== JSON.stringify(formattedMessages)) {
                   return { ...state, messages: formattedMessages, isLoading: false, error: null };
               }
               return { ...state, isLoading: false, error: null }; // Still update loading/error state
           });

        }, (error) => {
           console.error(`%cDEBUG: subscribeToChat [Messages Listener] - Error for ${activityId}:`, 'color: red;', error);
           set({ error: error as Error, isLoading: false });
        }); // End onValue for messagesRef

        // Save the listener references for cleanup
        set(state => ({
          messageListeners: {
            ...state.messageListeners,
            [`chat_${activityId}`]: unsubscribeChat, // Listener for chat metadata
            [activityId]: unsubscribeMessages      // Listener for messages
          }
        }));

        // Clean up expired messages when subscribing (optional, but good practice)
        get().cleanupExpiredMessages(activityId).then(deletedCount => {
              if (deletedCount > 0) {
                console.log(`%cDEBUG: subscribeToChat - Initial cleanup removed ${deletedCount} expired messages for ${activityId}`, 'color: orange;');
              }
            }).catch(error => {
              console.error('%cDEBUG: subscribeToChat - Error during initial cleanup:', 'color: red;', error);
            });

        console.log(`%cDEBUG: subscribeToChat END - Successfully subscribed to ${activityId}`, 'color: #2196F3; font-weight: bold;');

      } catch (error) {
        console.error('%cDEBUG: subscribeToChat FATAL ERROR:', 'color: red; font-weight: bold;', error);
        set({ error: error as Error, isLoading: false });
      }
    },

    // Unsubscribe from the currently active chat listeners
    unsubscribeFromChat: () => {
      const { currentChatId, messageListeners } = get();
      console.log(`%cDEBUG: unsubscribeFromChat - Attempting to unsubscribe from Chat ID: ${currentChatId}`, 'color: #2196F3; font-weight: bold;');

      if (currentChatId && messageListeners) {
        const unsubscribeMessages = messageListeners[currentChatId];
        const unsubscribeChat = messageListeners[`chat_${currentChatId}`];

        if (typeof unsubscribeMessages === 'function') {
          try {
            unsubscribeMessages();
            console.log(`%cDEBUG: unsubscribeFromChat - Unsubscribed messages listener for ${currentChatId}`, 'color: #4CAF50;');
          } catch (err) {
            console.error(`%cDEBUG: unsubscribeFromChat - Error unsubscribing messages listener for ${currentChatId}:`, 'color: red;', err);
          }
        } else {
            console.warn(`%cDEBUG: unsubscribeFromChat - No message listener function found for ${currentChatId}`, 'color: orange;');
        }

         if (typeof unsubscribeChat === 'function') {
          try {
            unsubscribeChat();
            console.log(`%cDEBUG: unsubscribeFromChat - Unsubscribed chat listener for ${currentChatId}`, 'color: #4CAF50;');
          } catch (err) {
            console.error(`%cDEBUG: unsubscribeFromChat - Error unsubscribing chat listener for ${currentChatId}:`, 'color: red;', err);
          }
        } else {
             console.warn(`%cDEBUG: unsubscribeFromChat - No chat listener function found for chat_${currentChatId}`, 'color: orange;');
        }

        // Remove listeners from state after unsubscribing
        set(state => {
            const newListeners = { ...state.messageListeners };
            delete newListeners[currentChatId];
            delete newListeners[`chat_${currentChatId}`];
            console.log(`%cDEBUG: unsubscribeFromChat - Cleaned listeners from state for ${currentChatId}.`, 'color: gray;');
            return {
                ...state,
                messageListeners: newListeners,
                messages: [], // Clear messages when unsubscribing
                currentChatId: null, // Clear current chat ID
                isLoading: false,
                error: null
            };
        });

      } else {
          console.log('%cDEBUG: unsubscribeFromChat - No currentChatId or listeners to unsubscribe from.', 'color: gray;');
          // Still reset state if no specific chat was active
           set({
                messages: [],
                currentChatId: null,
                isLoading: false,
                error: null
            });
      }
      console.log('%cDEBUG: unsubscribeFromChat END - Chat state reset.', 'color: #2196F3; font-weight: bold;');
    },

    // Create or join an activity chat
    createOrJoinActivityChat: async (activityId: string, user: User) => {
      console.log(`%cDEBUG: createOrJoinActivityChat START - Activity: ${activityId}, User: ${user.uid}`, 'color: #4CAF50; font-weight: bold;');

      if (!realtimeDb) {
        console.error('%cDEBUG: createOrJoinActivityChat ERROR - Realtime Database not initialized', 'color: red;');
        throw new Error('Chat service is unavailable - please try again later');
      }

      try {
        const chatRef = ref(realtimeDb, `activity-chats/${activityId}`);
        console.log('%cDEBUG: createOrJoinActivityChat - Database URL:', 'color: green;', realtimeDb.app.options.databaseURL);
        console.log('%cDEBUG: createOrJoinActivityChat - Chat reference path:', 'color: green;', chatRef.toString());

        // Use onValue with { onlyOnce: true } for a reliable single read
        const chatSnapshot = await new Promise<DataSnapshot>((resolve, reject) => {
            onValue(chatRef, resolve, (error) => {
                 console.error(`%cDEBUG: createOrJoinActivityChat ERROR - Failed to read chat data for ${activityId}`, 'color: red;', error);
                 reject(error);
            }, { onlyOnce: true });
         });

        const chatData = chatSnapshot.val();
        const timestamp = Date.now(); // JS Timestamp

        if (!chatData) {
          console.log(`%cDEBUG: createOrJoinActivityChat - No existing chat found for ${activityId}, creating new one.`, 'color: green;');
          const newChat: Chat = {
            id: activityId,
            activityId,
            members: {
              [user.uid]: {
                userId: user.uid,
                displayName: user.displayName || 'Anonymous',
                joinedAt: timestamp
              }
            },
            createdAt: timestamp
          };

          await rtdbSet(chatRef, newChat)
          console.log(`%cDEBUG: createOrJoinActivityChat - Created new chat metadata for ${activityId}.`, 'color: green;');

          // Add initial system message
          const messagesRef = ref(realtimeDb, `chat-messages/${activityId}`);
          const newMessageRef = push(messagesRef);
          await rtdbSet(newMessageRef, {
            senderId: 'system',
            senderName: 'System',
            text: `Chat created. Welcome! Coordinate with participants here.`,
            timestamp: timestamp + 1 // Ensure slightly later timestamp
          });
           console.log(`%cDEBUG: createOrJoinActivityChat - Added welcome message for ${activityId}.`, 'color: green;');

        } else {
          console.log(`%cDEBUG: createOrJoinActivityChat - Chat exists for ${activityId}, ensuring user is a member.`, 'color: green;');
          const memberRef = ref(realtimeDb, `activity-chats/${activityId}/members/${user.uid}`);
          const memberSnapshot = await new Promise<DataSnapshot>((resolve, reject) => {
            onValue(memberRef, resolve, reject, { onlyOnce: true });
           });

          if (!memberSnapshot.exists()) {
             console.log(`%cDEBUG: createOrJoinActivityChat - Adding user ${user.uid} to members of ${activityId}.`, 'color: green;');
             await rtdbSet(memberRef, {
                userId: user.uid,
                displayName: user.displayName || 'Anonymous',
                joinedAt: timestamp
             });

             // Add join system message
             const messagesRef = ref(realtimeDb, `chat-messages/${activityId}`);
             const newMessageRef = push(messagesRef);
             await rtdbSet(newMessageRef, {
                senderId: 'system',
                senderName: 'System',
                text: `${user.displayName || 'A new participant'} has joined the chat.`,
                timestamp: timestamp + 1
             });
              console.log(`%cDEBUG: createOrJoinActivityChat - Added join message for ${user.uid} in ${activityId}.`, 'color: green;');
          } else {
              console.log(`%cDEBUG: createOrJoinActivityChat - User ${user.uid} is already a member of ${activityId}.`, 'color: gray;');
          }
        }

        // Automatically subscribe after joining/creating
        console.log(`%cDEBUG: createOrJoinActivityChat - Attempting to subscribe to chat ${activityId} after join/create.`, 'color: green;');
        await get().subscribeToChat(activityId, user.uid);
        console.log(`%cDEBUG: createOrJoinActivityChat END - Successfully created/joined and subscribed to ${activityId}`, 'color: #4CAF50; font-weight: bold;');

      } catch (error) {
        console.error('%cDEBUG: createOrJoinActivityChat FATAL ERROR:', 'color: red; font-weight: bold;', error);
        set({ error: error as Error });
        throw error; // Re-throw to notify caller
      }
    },
    leaveActivityChat: async (activityId: string) => {
            // don’t trust the passed‐in userId — grab it from the SDK  
      const auth = getAuth();
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) {
        console.error("DEBUG: leaveActivityChat ERROR – no authenticated user");
        throw new Error("Not signed in");
      }
      console.log("→ SDK thinks auth.uid is:", currentUid);
    
      // 1) Load your own member data to get displayName
      const memberRef = ref(realtimeDb, `activity-chats/${activityId}/members/${currentUid}`);
      const snapshot = await new Promise<DataSnapshot>((res, rej) =>
        onValue(memberRef, res, rej, { onlyOnce: true })
      );
      const displayName = snapshot.val()?.displayName || 'A participant';
    
      // 2) Push the “X has left” system message *while* you’re still in members
      const messagesRef = ref(realtimeDb, `chat-messages/${activityId}`);
      const newMsgRef   = push(messagesRef);
      await rtdbSet(newMsgRef, {
        senderId:   'system',
        senderName: 'System',
        text:       `${displayName} has left the chat.`,
        timestamp:  Date.now()
      });
      console.log(`DEBUG: leaveActivityChat — system message sent`);
     
      // 3) Now that message is written, remove yourself
           // 3) Now that message is written, remove yourself  
            await rtdbRemove(memberRef);
            console.log(`DEBUG: leaveActivityChat — removed member ${currentUid}`);
    
      // 4) Unsubscribe if needed
      if (get().currentChatId === activityId) {
        get().unsubscribeFromChat();
        console.log(`DEBUG: leaveActivityChat — unsubscribed from chat`);
      }
    
      console.log(`DEBUG END leaveActivityChat: success`);
    },
    
    // Send a message to a chat
    sendMessage: async (activityId: string, user: User, text: string): Promise<string | null | undefined> => {
      const functionStartTime = Date.now(); // Debug: Start time
      console.log(`[${new Date(functionStartTime).toISOString()}] %cDEBUG: sendMessage START - Activity: ${activityId}, User: ${user.uid}`, 'color: blue; font-weight: bold;');

      const messageTimestamp = Date.now(); // Use a consistent JS timestamp (milliseconds)

      try {
        if (!activityId || !user || !text || !user.uid || text.trim().length === 0) {
           console.error(`%cDEBUG: sendMessage ERROR - Invalid parameters`, 'color: red;', { activityId, userId: user?.uid, textProvided: !!text, textTrimmed: text?.trim() });
          throw new Error('Invalid message parameters: Activity ID, user, and non-empty text are required.');
        }

        const db = realtimeDb;
        if (!db) {
          console.error('%cDEBUG: sendMessage ERROR - Realtime Database not initialized', 'color: red;');
          throw new Error('Chat service unavailable - please reload the page');
        }

        console.log(`%cDEBUG: sendMessage - Preparing RTDB write for Activity ${activityId}`, 'color: blue;');
        const chatMessagesRef = ref(db, `chat-messages/${activityId}`);
        const newMessageRef = push(chatMessagesRef); // Generate unique key locally

        const messageData = {
          senderId: user.uid,
          senderName: user.displayName || 'Anonymous',
          text: text.trim(),
          timestamp: messageTimestamp // Use the consistent JS timestamp
        };

        await rtdbSet(newMessageRef, messageData);
        const rtdbWriteEndTime = Date.now();
        console.log(`%cDEBUG: sendMessage - RTDB write SUCCESS - Activity: ${activityId}, Message Key: ${newMessageRef.key}, Time taken: ${rtdbWriteEndTime - functionStartTime}ms`, 'color: green;');

        // ----- Update Firestore lastMessageTimestamp -----
        try {
          console.log(`%cDEBUG: sendMessage - Preparing Firestore update for Activity ${activityId}`, 'color: purple;');
          const activityDocRef = doc(firestore, "activities", activityId);
          // Convert JS timestamp (milliseconds) to Firestore Timestamp object
          const firestoreTimestamp = FirestoreTimestamp.fromMillis(messageTimestamp);

          await updateDoc(activityDocRef, {
            lastMessageTimestamp: firestoreTimestamp // Use Firestore Timestamp object
          });
          const firestoreUpdateEndTime = Date.now();
          console.log(`%cDEBUG: sendMessage - Firestore update SUCCESS - Activity: ${activityId}, Timestamp: ${firestoreTimestamp.toDate().toISOString()}, Time taken: ${firestoreUpdateEndTime - rtdbWriteEndTime}ms`, 'color: darkgreen; font-weight: bold;');

        } catch (firestoreError) {
           console.error(`%cDEBUG: sendMessage ERROR - Failed to update Firestore 'lastMessageTimestamp' for Activity ${activityId}`, 'color: red;', firestoreError);
           // Log the error but don't prevent the message from being considered "sent" in RTDB
           toast.error("Failed to update chat order timestamp. Message sent.", { description: firestoreError instanceof Error ? firestoreError.message : String(firestoreError) });
        }
        // ----- END Firestore Update -----


        // Cleanup expired messages (keep this)
        try {
          const cleanupStartTime = Date.now();
          const deletedCount = await get().cleanupExpiredMessages(activityId);
          const cleanupEndTime = Date.now();
          if (deletedCount > 0) {
            console.log(`%cDEBUG: sendMessage - Cleanup SUCCESS - Deleted ${deletedCount} expired messages. Time taken: ${cleanupEndTime - cleanupStartTime}ms`, 'color: orange;');
          } else {
             console.log(`%cDEBUG: sendMessage - Cleanup INFO - No expired messages to delete. Time taken: ${cleanupEndTime - cleanupStartTime}ms`, 'color: gray;');
          }
        } catch (cleanupError) {
          console.error('%cDEBUG: sendMessage ERROR - Failed during cleanup after sending message', 'color: red;', cleanupError);
        }
        const functionEndTime = Date.now();
        console.log(`[${new Date(functionEndTime).toISOString()}] %cDEBUG: sendMessage END - Activity: ${activityId}. Total time: ${functionEndTime - functionStartTime}ms`, 'color: blue; font-weight: bold;');


        return newMessageRef.key; // Return the key of the new message in RTDB
      } catch (error) {
        const errorEndTime = Date.now();
        console.error(`[${new Date(errorEndTime).toISOString()}] %cDEBUG: sendMessage FATAL ERROR - Activity: ${activityId}`, 'color: red; font-weight: bold;', error);
        set({ error: error as Error });
        toast.error("Failed to send message.", { description: error instanceof Error ? error.message : String(error) });
        throw error; // Re-throw the error so the calling component knows it failed
      }
    },

    // Clean up expired messages (e.g., older than 5 days)
    cleanupExpiredMessages: async (activityId: string): Promise<number> => {
      const cleanupStartTime = Date.now();
      try {
        // Keep messages for 5 days (adjust as needed)
        const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
        const expirationTimestamp = Date.now() - FIVE_DAYS_MS; // JS Timestamp (milliseconds)

        console.log(`%cDEBUG: cleanupExpiredMessages START - Activity: ${activityId}. Cleaning messages older than ${new Date(expirationTimestamp).toISOString()}`, 'color: #FF5722;');

        const db = realtimeDb;
        if (!db) {
            console.error('%cDEBUG: cleanupExpiredMessages ERROR - Realtime Database not available', 'color: red;');
            throw new Error('Realtime Database not available');
        }

        const messagesRef = ref(db, `chat-messages/${activityId}`);
        // Query for messages older than the expiration timestamp
        const queryToCleanup = query(messagesRef, orderByChild('timestamp'), endAt(expirationTimestamp));

        const snapshot = await new Promise<DataSnapshot>((resolve, reject) => {
           onValue(queryToCleanup, resolve, reject, { onlyOnce: true });
        });

        if (!snapshot.exists()) {
          console.log(`%cDEBUG: cleanupExpiredMessages - No messages older than expiration found for ${activityId}.`, 'color: gray;');
          return 0; // No messages to delete
        }

        const messagesToDelete: Record<string, any> = snapshot.val();
        const messageKeysToDelete = Object.keys(messagesToDelete);
        console.log(`%cDEBUG: cleanupExpiredMessages - Found ${messageKeysToDelete.length} expired messages to delete for ${activityId}.`, 'color: #FF5722;');

        if (messageKeysToDelete.length === 0) {
            return 0;
        }

        // Prepare updates for atomic removal
        const updates: Record<string, null> = {};
        messageKeysToDelete.forEach(key => {
          updates[`chat-messages/${activityId}/${key}`] = null; // Setting to null deletes the key
        });

        // Use update for atomic removal of multiple keys at once
        await rtdbUpdate(ref(db), updates);

        const cleanupEndTime = Date.now();
        console.log(`%cDEBUG: cleanupExpiredMessages END - Successfully deleted ${messageKeysToDelete.length} messages for ${activityId}. Time taken: ${cleanupEndTime - cleanupStartTime}ms`, 'color: #FF5722; font-weight: bold;');
        return messageKeysToDelete.length;

      } catch (error) {
        console.error(`%cDEBUG: cleanupExpiredMessages ERROR - Failed to clean up messages for ${activityId}:`, 'color: red;', error);
        set({ error: error as Error }); // Set error state but don't necessarily throw
        return 0; // Return 0 as cleanup failed
      }
    }
  }; // End store object definition

  console.log('%cDEBUG: Creating chat store instance.', 'background: #3f51b5; color: white; padding: 2px 4px; border-radius: 2px;');
  return store;
}); // End create
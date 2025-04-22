import { create } from 'zustand';
import { ref, set, onValue, push, update, remove, serverTimestamp, off, DatabaseReference, DataSnapshot, query, orderByChild, endAt } from 'firebase/database';
import { User } from 'firebase/auth';
import { toast } from "sonner";
import { realtimeDb, firestore } from './firebase'; // Assuming firebase.ts exports these
import { doc, updateDoc, Timestamp as FirestoreTimestamp } from 'firebase/firestore'; // Import firestore functions


// Define message interface (ensure this matches your component's interface or vice-versa)
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
  // --- Add these fields for last message ---
  lastMessageText?: string;
  lastMessageSenderName?: string;
  lastMessageTimestamp?: number; // JS Timestamp (milliseconds)
  // ------------------------------------------
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
        // This listener could be used in a chat list component to display the last message.
        // We'll keep it here for completeness but it's not directly used *in this component*.
        const unsubscribeChat = onValue(chatRef, (snapshot: DataSnapshot) => {
           console.log(`%cDEBUG: subscribeToChat [Chat Metadata Listener] - Snapshot received for ${activityId}. Exists: ${snapshot.exists()}. Path: ${chatRef.toString()}`, 'color: blue;');
           const chatData = snapshot.val();
           if (chatData) {
             // You could potentially update chat metadata state here if needed elsewhere
             // console.log("Chat Metadata:", chatData);
           }
        }, (error) => {
           console.error(`%cDEBUG: subscribeToChat [Chat Metadata Listener] - Error for ${activityId}:`, 'color: red;', error);
           // Do not set global error here, as message listener error is more critical for display
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
            return { ...state, messageListeners: newListeners, currentChatId: null, messages: [] }; // Clear messages on unsubscribe
        });

        console.log(`%cDEBUG: unsubscribeFromChat END - Listeners for ${currentChatId} removed.`, 'color: #2196F3; font-weight: bold;');

      } else {
          console.log(`%cDEBUG: unsubscribeFromChat - No currentChatId (${currentChatId}) or messageListeners to unsubscribe from.`, 'color: gray;');
      }
    },

    // Create or join an activity chat
    createOrJoinActivityChat: async (activityId: string, user: User) => {
      console.log(`%cDEBUG: createOrJoinActivityChat START - Activity: ${activityId}, User: ${user.uid}`, 'color: #8BC34A; font-weight: bold;');
      const db = realtimeDb;
      if (!db) {
          console.error('%cDEBUG: createOrJoinActivityChat ERROR - Realtime Database not available', 'color: red;');
          toast.error("Database not available");
          return;
      }

      const chatRef = ref(db, `activity-chats/${activityId}`);
      const messagesRef = ref(db, `chat-messages/${activityId}`);
      const timestamp = Date.now();

      try {
        const snapshot = await new Promise<DataSnapshot>((resolve, reject) => {
          onValue(chatRef, resolve, reject, { onlyOnce: true });
        });

        const chatData = snapshot.val();
        console.log(`%cDEBUG: createOrJoinActivityChat - Existing chat data for ${activityId}:`, 'color: #8BC34A;', chatData);

        if (!chatData) {
          console.log(`%cDEBUG: createOrJoinActivityChat - Chat ${activityId} does not exist. Creating...`, 'color: #8BC34A;');
          // Create new chat
          const newChat: Chat = {
            id: activityId,
            activityId,
            members: {
              [user.uid]: {
                userId: user.uid,
                displayName: user.displayName || "Anonymous",
                joinedAt: timestamp
              }
            },
            createdAt: timestamp,
            // Initial last message (system message)
            lastMessageText: `Welcome to the activity chat! This is where you can coordinate with other participants.`,
            lastMessageSenderName: "System",
            lastMessageTimestamp: timestamp
          };
          await set(chatRef, newChat);
          console.log(`%cDEBUG: createOrJoinActivityChat - Chat ${activityId} created.`, 'color: #4CAF50;');

          // Add welcome message
          const newMessageRef = push(messagesRef);
          await set(newMessageRef, {
            senderId: "system",
            senderName: "System",
            text: `Welcome to the activity chat! This is where you can coordinate with other participants.`,
            timestamp
          });
           console.log(`%cDEBUG: createOrJoinActivityChat - Welcome message added for ${activityId}.`, 'color: #4CAF50;');

        } else {
          console.log(`%cDEBUG: createOrJoinActivityChat - Chat ${activityId} exists. Checking membership...`, 'color: #8BC34A;');
          // Just add user to members if not already there
          if (!chatData.members || !chatData.members[user.uid]) {
            console.log(`%cDEBUG: createOrJoinActivityChat - User ${user.uid} is not a member. Adding...`, 'color: #8BC34A;');
            const memberRef = ref(db, `activity-chats/${activityId}/members/${user.uid}`);
            await set(memberRef, {
              userId: user.uid,
              displayName: user.displayName || "Anonymous",
              joinedAt: timestamp
            });
            console.log(`%cDEBUG: createOrJoinActivityChat - User ${user.uid} added to members of ${activityId}.`, 'color: #4CAF50;');

            // Add system message about new member
            const newMessageRef = push(messagesRef);
            const memberJoinMessage = `${user.displayName || "A new participant"} has joined the chat.`;
            const messageData = {
                senderId: "system",
                senderName: "System",
                text: memberJoinMessage,
                timestamp
            };
            await set(newMessageRef, messageData);
            console.log(`%cDEBUG: createOrJoinActivityChat - Member join system message added for ${activityId}.`, 'color: #4CAF50;');

            // --- UPDATE LAST MESSAGE ON CHAT ENTRY ---
            const chatEntryUpdates: any = {
              lastMessageText: memberJoinMessage,
              lastMessageSenderName: "System",
              lastMessageTimestamp: timestamp
            };
            await update(chatRef, chatEntryUpdates);
            console.log(`%cDEBUG: createOrJoinActivityChat - Updated last message in activity-chats/${activityId} with system message.`, 'color: #4CAF50;');
            // --- END UPDATE ---

          } else {
             console.log(`%cDEBUG: createOrJoinActivityChat - User ${user.uid} is already a member of ${activityId}.`, 'color: gray;');
          }
        }
        console.log(`%cDEBUG: createOrJoinActivityChat END - Successfully created/joined chat ${activityId}`, 'color: #8BC34A; font-weight: bold;');

      } catch (error) {
        console.error(`%cDEBUG: createOrJoinActivityChat ERROR for ${activityId}:`, 'color: red;', error);
        toast.error("Failed to initialize chat");
        set({ error: error as Error }); // Set error state
        throw error; // Re-throw to allow calling component to handle
      }
    },

    // Leave an activity chat (Optional: You might implement this if users can leave)
    leaveActivityChat: async (activityId: string, userId: string) => {
       console.log(`%cDEBUG: leaveActivityChat START - Activity: ${activityId}, User: ${userId}`, 'color: #FF5722; font-weight: bold;');
        const db = realtimeDb;
         if (!db) {
            console.error('%cDEBUG: leaveActivityChat ERROR - Realtime Database not available', 'color: red;');
             toast.error("Database not available");
             return;
        }

        try {
            const memberRef = ref(db, `activity-chats/${activityId}/members/${userId}`);
            await remove(memberRef);
            console.log(`%cDEBUG: leaveActivityChat - User ${userId} removed from members of ${activityId}.`, 'color: #4CAF50;');

             // Optional: Add a system message indicating the user left
            const messagesRef = ref(db, `chat-messages/${activityId}`);
            const newMessageRef = push(messagesRef);
            const timestamp = Date.now();
            const leaveMessage = `${get().messageListeners[`chat_${activityId}`]?.userDisplayName || "A participant"} has left the chat.`; // Attempt to get display name or use generic
             const messageData = {
                senderId: "system",
                senderName: "System",
                text: leaveMessage,
                timestamp
            };
            await set(newMessageRef, messageData);
            console.log(`%cDEBUG: leaveActivityChat - Member leave system message added for ${activityId}.`, 'color: #4CAF50;');

             // --- UPDATE LAST MESSAGE ON CHAT ENTRY ---
            const chatRef = ref(db, `activity-chats/${activityId}`);
            const chatEntryUpdates: any = {
              lastMessageText: leaveMessage,
              lastMessageSenderName: "System",
              lastMessageTimestamp: timestamp
            };
            await update(chatRef, chatEntryUpdates);
             console.log(`%cDEBUG: leaveActivityChat - Updated last message in activity-chats/${activityId} with system message.`, 'color: #4CAF50;');
             // --- END UPDATE ---

            console.log(`%cDEBUG: leaveActivityChat END - User ${userId} left chat ${activityId}`, 'color: #FF5722; font-weight: bold;');

        } catch (error) {
            console.error(`%cDEBUG: leaveActivityChat ERROR for ${activityId}:`, 'color: red;', error);
            toast.error("Failed to leave chat");
             throw error; // Re-throw
        }
    },

    // Send a message
    sendMessage: async (activityId: string, user: User, text: string) => {
        console.log(`%cDEBUG: sendMessage START - Activity: ${activityId}, User: ${user.uid}`, 'color: #03A9F4; font-weight: bold;');
        if (!text.trim()) {
            console.warn('%cDEBUG: sendMessage - Message text is empty or whitespace.', 'color: orange;');
            return;
        }

        const db = realtimeDb;
         if (!db) {
             console.error('%cDEBUG: sendMessage ERROR - Realtime Database not available', 'color: red;');
              toast.error("Database not available");
             return;
        }

        try {
            const messagesRef = ref(db, `chat-messages/${activityId}`);
            const newMessageRef = push(messagesRef);
            const timestamp = Date.now(); // Use JS timestamp

            const messageData = {
                senderId: user.uid,
                senderName: user.displayName || "Anonymous",
                text: text.trim(),
                timestamp: timestamp // Use JS timestamp
            };

            await set(newMessageRef, messageData);
            console.log(`%cDEBUG: sendMessage - Message sent and saved to chat-messages/${activityId}. Key: ${newMessageRef.key}`, 'color: #4CAF50;', messageData);

            // --- UPDATE LAST MESSAGE ON CHAT ENTRY ---
            const chatRef = ref(db, `activity-chats/${activityId}`);
            const chatEntryUpdates: any = {
              lastMessageText: text.trim(),
              lastMessageSenderName: user.displayName || "Anonymous",
              lastMessageTimestamp: timestamp // Use JS timestamp
            };
             await update(chatRef, chatEntryUpdates);
             console.log(`%cDEBUG: sendMessage - Updated last message in activity-chats/${activityId}.`, 'color: #4CAF50;', chatEntryUpdates);
            // --- END UPDATE ---

             console.log(`%cDEBUG: sendMessage END - Message sent and last message updated for ${activityId}`, 'color: #03A9F4; font-weight: bold;');
            return newMessageRef.key; // Return the message ID
        } catch (error) {
            console.error(`%cDEBUG: sendMessage ERROR for ${activityId}:`, 'color: red;', error);
            toast.error("Failed to send message");
            set({ error: error as Error }); // Set error state
            throw error; // Re-throw to allow component to handle sending state
        }
    },

    // Cleanup expired messages (example logic - not fully implemented for specific expiry rules)
    cleanupExpiredMessages: async (activityId: string) => {
        console.log(`%cDEBUG: cleanupExpiredMessages START - Activity: ${activityId}`, 'color: #FF9800; font-weight: bold;');
         const db = realtimeDb;
         if (!db) {
            console.error('%cDEBUG: cleanupExpiredMessages ERROR - Realtime Database not available', 'color: red;');
             return 0;
         }

         // Example: Remove messages older than 30 days (adjust as needed)
         const expiryThreshold = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days ago in milliseconds

        try {
             const messagesRef = ref(db, `chat-messages/${activityId}`);
             // Query for messages with timestamp less than the expiry threshold
             const expiredMessagesQuery = query(messagesRef, orderByChild('timestamp'), endAt(expiryThreshold));

             const snapshot = await new Promise<DataSnapshot>((resolve, reject) => {
                onValue(expiredMessagesQuery, resolve, reject, { onlyOnce: true });
             });

             const messagesToDelete = snapshot.val();
             let deletedCount = 0;

             if (messagesToDelete) {
                 const updates: { [key: string]: null } = {};
                 Object.keys(messagesToDelete).forEach(key => {
                     updates[key] = null; // Set to null to delete
                     deletedCount++;
                 });

                 console.log(`%cDEBUG: cleanupExpiredMessages - Found ${deletedCount} messages older than ${new Date(expiryThreshold).toISOString()} for ${activityId}. Deleting...`, 'color: #FF9800;');

                 await update(messagesRef, updates);
                 console.log(`%cDEBUG: cleanupExpiredMessages - Deleted ${deletedCount} messages for ${activityId}.`, 'color: #4CAF50;');

                 // Note: Deleting messages *might* require recalculating the `lastMessage` on the activity-chats node
                 // if the last message happened to be one of the deleted ones. This complexity is omitted for this basic example.
                 // A robust solution might re-query the latest message after deletion or use Cloud Functions.

             } else {
                 console.log(`%cDEBUG: cleanupExpiredMessages - No expired messages found for ${activityId}.`, 'color: gray;');
             }

             console.log(`%cDEBUG: cleanupExpiredMessages END - Cleanup complete for ${activityId}. Deleted: ${deletedCount}`, 'color: #FF9800; font-weight: bold;');
            return deletedCount;

        } catch (error) {
             console.error(`%cDEBUG: cleanupExpiredMessages ERROR for ${activityId}:`, 'color: red;', error);
             // Do not set global error for cleanup
            return 0;
        }
    }
  };

  // Return the store object
  return store;
});
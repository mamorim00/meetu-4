import { create } from 'zustand';
import { ref, set, onValue, push, update, remove, serverTimestamp, off, DatabaseReference, DataSnapshot, query, orderByChild, endAt } from 'firebase/database';
import { User } from 'firebase/auth';
import { realtimeDb } from './firebase';
import { toast } from "sonner";

// Define message interface
export interface ChatMessage {
  id: string;
  activityId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

// Define chat member interface
export interface ChatMember {
  userId: string;
  displayName: string;
  joinedAt: number;
}

// Define chat interface
export interface Chat {
  id: string;
  activityId: string;
  members: Record<string, ChatMember>;
  createdAt: number;
}

// Define store state
interface ChatState {
  currentChatId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: Error | null;
  messageListeners: Record<string, () => void>;
  unreadCounts: Record<string, number>;
  totalUnreadCount: number;
  
  // Initialize chat listeners
  subscribeToChat: (activityId: string, userId: string) => Promise<void>;
  unsubscribeFromChat: () => void;
  
  // Chat creation and management
  createOrJoinActivityChat: (activityId: string, user: User) => Promise<void>;
  leaveActivityChat: (activityId: string, userId: string) => Promise<void>;
  
  // Message functions
  sendMessage: (activityId: string, user: User, text: string) => Promise<void>;
  
  // Cleanup functions
  cleanupExpiredMessages: (activityId: string) => Promise<number>;
}

// Create store
export const useChatStore = create<ChatState>((set, get) => {
  // Create the store object
  const store = {
    currentChatId: null,
    messages: [],
    isLoading: false,
    error: null,
    messageListeners: {},
    unreadCounts: {},
    totalUnreadCount: 0,
    
    // Mark all messages in a chat as read
    markChatAsRead: (activityId: string) => {
      // Store last viewed timestamp
      localStorage.setItem(`last_viewed_${activityId}`, Date.now().toString());
      
      // Clear unread count for this chat
      set(state => {
        const newUnreadCounts = { ...state.unreadCounts };
        delete newUnreadCounts[activityId];
        const totalCount = Object.values(newUnreadCounts).reduce((sum, count) => sum + count, 0);
        
        return {
          unreadCounts: newUnreadCounts,
          totalUnreadCount: totalCount
        };
      });
    },
    
    // Subscribe to chat messages for an activity
    subscribeToChat: async (activityId: string, userId: string) => {
      console.log(`%c📩 Subscribing to chat for activity ${activityId} user ${userId}`, 'color: #2196F3; font-weight: bold;');
      try {
        set({ isLoading: true, error: null });
        
        // Clear any existing listeners
        get().unsubscribeFromChat();
        
        // Use the centralized Firebase realtime database instance
        console.log('%c🔄 Initializing database for chat subscription...', 'color: #FF9800; font-weight: bold;');
        const db = realtimeDb;
        
        if (!db) {
          throw new Error('Realtime Database not available - please reload the page');
        }
        console.log('%c✅ Using initialized Realtime Database for chat', 'color: #4CAF50; font-weight: bold;');
        
        // Get chat ID for this activity
        const chatRef = ref(db, `activity-chats/${activityId}`);
        console.log(`Chat reference: activity-chats/${activityId}`);
        
        // Subscribe to the chat data
        const unsubscribeChat = onValue(chatRef, (snapshot: DataSnapshot) => {
          console.log("Chat snapshot received", snapshot.exists(), "Path:", chatRef.toString());
          const chatData = snapshot.val();
          if (chatData) {
            set({ currentChatId: chatData.id || activityId });
            
            // Clean up expired messages before loading
            get().cleanupExpiredMessages(activityId).then(deletedCount => {
              if (deletedCount > 0) {
                console.log(`Cleaned up ${deletedCount} expired messages`);
              }
            }).catch(error => {
              console.error('Error cleaning up expired messages:', error);
            });
            
            // Now subscribe to messages
            const messagesRef = ref(db, `chat-messages/${activityId}`);
            console.log(`Messages reference: chat-messages/${activityId}`);
            
            const unsubscribeMessages = onValue(messagesRef, (snapshot: DataSnapshot) => {
              console.log("Messages snapshot received", snapshot.exists(), "Path:", messagesRef.toString());
              const messagesData = snapshot.val();
              const formattedMessages: ChatMessage[] = [];
              
              if (messagesData) {
                // Convert object to array and sort by timestamp
                Object.keys(messagesData).forEach(key => {
                  const message = messagesData[key];
                  
                  if (!message) {
                    console.warn(`Skipping null/undefined message with key ${key}`);
                    return;
                  }
                  
                  try {
                    // Ensure timestamp is a valid number
                    let timestamp = Date.now(); // Default fallback
                    
                    if (message.timestamp) {
                      const parsedTimestamp = Number(message.timestamp);
                      if (!isNaN(parsedTimestamp) && 
                          parsedTimestamp > 1577836800000 && // Jan 1, 2020
                          parsedTimestamp < 1893456000000) { // Jan 1, 2030
                        timestamp = parsedTimestamp;
                      } else {
                        console.warn(`Invalid timestamp detected in message ${key}, using fallback:`, message.timestamp);
                      }
                    }
                    
                    formattedMessages.push({
                      id: key,
                      activityId,
                      senderId: message.senderId || '',
                      senderName: message.senderName || 'Unknown',
                      text: message.text || '',
                      timestamp: timestamp
                    });
                    
                    console.log(`Processed message ${key} from ${message.senderName || 'Unknown'}`);
                  } catch (err) {
                    console.error('Error processing message:', err, message);
                  }
                });
                
                formattedMessages.sort((a, b) => a.timestamp - b.timestamp);
                console.log(`Retrieved ${formattedMessages.length} messages`);
                
                // --------- Add debug logs for unread counts ----------
                const lastViewedTimestamp = localStorage.getItem(`last_viewed_${activityId}`) || '0';
                console.log(`Last viewed timestamp for activity ${activityId}:`, lastViewedTimestamp);
                
                const newMessages = formattedMessages.filter(msg => 
                  msg.senderId !== userId && msg.timestamp > parseInt(lastViewedTimestamp)
                );
                console.log(`Calculated unread messages for activity ${activityId}:`, newMessages.length);
                // -------------------------------------------------------
                
                // Update unread count if this is not the currently active chat
                const { currentChatId } = get();
                if (currentChatId !== activityId) {
                  if (newMessages.length > 0) {
                    set(state => {
                      const newUnreadCounts = { ...state.unreadCounts, [activityId]: newMessages.length };
                      const totalCount = Object.values(newUnreadCounts).reduce((sum, count) => sum + count, 0);
                      console.log(`Setting unread count for activity ${activityId} to ${newMessages.length}`);
                      return {
                        unreadCounts: newUnreadCounts,
                        totalUnreadCount: totalCount
                      };
                    });
                  } else {
                    console.log(`No new unread messages to update for activity ${activityId}`);
                  }
                }
              } else {
                console.log("No messages found in database");
              }
              
              set({ 
                messages: formattedMessages,
                isLoading: false 
              });
            });
            
            // Save the listener reference for cleanup
            set(state => ({
              messageListeners: {
                ...state.messageListeners,
                [activityId]: () => {
                  off(messagesRef);
                }
              }
            }));
          } else {
            console.log("No chat data found, empty state");
            set({ 
              currentChatId: null,
              messages: [],
              isLoading: false 
            });
          }
        });
        
        // Save the chat listener reference for cleanup
        set(state => ({
          messageListeners: {
            ...state.messageListeners,
            [`chat_${activityId}`]: () => {
              off(chatRef);
            }
          }
        }));
        
      } catch (error) {
        console.error('Error subscribing to chat:', error);
        set({ error: error as Error, isLoading: false });
      }
    },
    
    // Unsubscribe from all chat listeners
    unsubscribeFromChat: () => {
      console.log('%c🔄 Unsubscribing from chat listeners', 'color: #2196F3; font-weight: bold;');
      
      try {
        const { messageListeners } = get();
        
        if (messageListeners && typeof messageListeners === 'object') {
          const listenerValues = Object.values(messageListeners);
          if (listenerValues && Array.isArray(listenerValues) && listenerValues.length > 0) {
            console.log(`Found ${listenerValues.length} listeners to clean up`);
            listenerValues.forEach(unsubscribe => {
              if (typeof unsubscribe === 'function') {
                try {
                  unsubscribe();
                } catch (err) {
                  console.error('Error during unsubscribe:', err);
                }
              }
            });
          } else {
            console.log('No listener values found to unsubscribe');
          }
        } else {
          console.warn('No message listeners to unsubscribe from or messageListeners is not an object');
        }
      } catch (error) {
        console.error('Error in unsubscribeFromChat:', error);
      } finally {
        set({ 
          messageListeners: {},
          messages: [],
          currentChatId: null,
          error: null
        });
        console.log('%c✅ Chat state reset', 'color: #4CAF50; font-weight: bold;');
      }
    },
    
    // Create or join an activity chat
    createOrJoinActivityChat: async (activityId: string, user: User) => {
      console.log(`%c💾 Creating/joining chat for activity ${activityId} user ${user.uid}`, 'color: #4CAF50; font-weight: bold;');
      
      if (!realtimeDb) {
        console.error('%c❌ Realtime Database not initialized when creating chat', 'color: #F44336; font-weight: bold;');
        throw new Error('Chat service is unavailable - please try again later');
      }
      
      try {
        const chatRef = ref(realtimeDb, `activity-chats/${activityId}`);
        console.log('Database URL:', realtimeDb.app.options.databaseURL);
        console.log('Chat reference path:', chatRef.toString());
        
        const chatSnapshot = await new Promise<DataSnapshot>(resolve => {
          onValue(chatRef, resolve, { onlyOnce: true });
        });
        
        const chatData = chatSnapshot.val();
        const timestamp = Date.now();
        
        if (!chatData) {
          console.log("No existing chat found, creating a new one");
          const newChat: Omit<Chat, 'id'> & { id: string } = {
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
          
          await set(chatRef, newChat);
          
          const messagesRef = ref(realtimeDb, `chat-messages/${activityId}`);
          const newMessageRef = push(messagesRef);
          await set(newMessageRef, {
            senderId: 'system',
            senderName: 'System',
            text: `Welcome to the activity chat! This is where you can coordinate with other participants.`,
            timestamp
          });
          
          console.log(`Created new chat for activity ${activityId}`);
        } else {
          console.log("Chat exists, just joining");
          const memberRef = ref(realtimeDb, `activity-chats/${activityId}/members/${user.uid}`);
          await set(memberRef, {
            userId: user.uid,
            displayName: user.displayName || 'Anonymous',
            joinedAt: timestamp
          });
          
          const messagesRef = ref(realtimeDb, `chat-messages/${activityId}`);
          const newMessageRef = push(messagesRef);
          await set(newMessageRef, {
            senderId: 'system',
            senderName: 'System',
            text: `${user.displayName || 'A new participant'} has joined the chat.`,
            timestamp
          });
          
          console.log(`User ${user.uid} joined existing chat for activity ${activityId}`);
        }
        
        const storeState = useChatStore.getState();
        console.log('Store state for chat subscription:', storeState);
        console.log('subscribeToChat exists:', typeof storeState.subscribeToChat === 'function');
        
        if (typeof storeState.subscribeToChat === 'function') {
          await storeState.subscribeToChat(activityId, user.uid);
        } else {
          console.error('subscribeToChat function not found in store state');
          throw new Error('Chat subscription function not available');
        }
      } catch (error) {
        console.error('Error creating or joining chat:', error);
        set({ error: error as Error });
        throw error;
      }
    },
    
    // Leave an activity chat
    leaveActivityChat: async (activityId: string, userId: string) => {
      try {
        if (!realtimeDb) {
          console.error('%c❌ Realtime Database not initialized when leaving chat', 'color: #F44336; font-weight: bold;');
          throw new Error('Chat service is unavailable - please try again later');
        }
        
        const memberRef = ref(realtimeDb, `activity-chats/${activityId}/members/${userId}`);
        await remove(memberRef);
        
        const userDisplayName = get().messages.find(m => m.senderId === userId)?.senderName || 'A participant';
        
        const messagesRef = ref(realtimeDb, `chat-messages/${activityId}`);
        const newMessageRef = push(messagesRef);
        await set(newMessageRef, {
          senderId: 'system',
          senderName: 'System',
          text: `${userDisplayName} has left the chat.`,
          timestamp: Date.now()
        });
        
        if (get().currentChatId === activityId) {
          get().unsubscribeFromChat();
        }
        
        console.log(`User ${userId} left chat for activity ${activityId}`);
      } catch (error) {
        console.error('Error leaving chat:', error);
        set({ error: error as Error });
        throw error;
      }
    },
    
    // Send a message to a chat
    sendMessage: async (activityId: string, user: User, text: string) => {
      console.log(`Sending message to activity ${activityId} as ${user.displayName || 'Anonymous'} (${user.uid})`);
      const timestamp = Date.now();
      
      try {
        if (!activityId || !user || !text || !user.uid) {
          throw new Error('Invalid message parameters');
        }
        
        const db = realtimeDb;
        if (!db) {
          console.error('Realtime Database not initialized when attempting to send message');
          throw new Error('Chat service unavailable - please reload the page');
        }
        
        console.log(`%c📤 SENDING MESSAGE TO DATABASE`, 'background: #4CAF50; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;');
        console.log('Database:', db);
        console.log('Activity ID:', activityId);
        
        const chatMessagesRef = ref(db, `chat-messages/${activityId}`);
        const newMessageRef = push(chatMessagesRef);
        
        const messageData = {
          senderId: user.uid,
          senderName: user.displayName || 'Anonymous',
          text: text.trim(),
          timestamp
        };
        
        await set(newMessageRef, messageData);
        console.log(`%c✅ Message sent successfully to ${activityId}`, 'color: #4CAF50; font-weight: bold;');
        
        try {
          const deletedCount = await get().cleanupExpiredMessages(activityId);
          if (deletedCount > 0) {
            console.log(`Cleaned up ${deletedCount} expired messages after sending a new one`);
          }
        } catch (cleanupError) {
          console.error('Error cleaning up expired messages:', cleanupError);
        }
        
        return newMessageRef.key;
      } catch (error) {
        console.error('%c❌ ERROR SENDING MESSAGE:', 'background: #F44336; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;', error);
        set({ error: error as Error });
        throw error;
      }
    },
    
    // Clean up expired messages (older than 5 days)
    cleanupExpiredMessages: async (activityId: string) => {
      try {
        const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
        const expirationTimestamp = Date.now() - FIVE_DAYS_MS;
        
        console.log(`Cleaning up messages older than ${new Date(expirationTimestamp).toISOString()}`);
        
        const db = realtimeDb;
        if (!db) {
          throw new Error('Realtime Database not available');
        }
        
        const messagesRef = ref(db, `chat-messages/${activityId}`);
        
        const snapshot = await new Promise<DataSnapshot>(resolve => {
          onValue(messagesRef, resolve, { onlyOnce: true });
        });
        
        if (!snapshot.exists()) {
          return 0;
        }
        
        const messagesData = snapshot.val();
        const messagesToDelete: string[] = [];
        
        Object.entries(messagesData).forEach(([messageId, messageData]: [string, any]) => {
          if (messageData && messageData.timestamp && messageData.timestamp < expirationTimestamp) {
            messagesToDelete.push(messageId);
          }
        });
        
        console.log(`Found ${messagesToDelete.length} expired messages to delete`);
        
        const deletePromises = messagesToDelete.map(messageId => {
          const messageRef = ref(db, `chat-messages/${activityId}/${messageId}`);
          return remove(messageRef);
        });
        
        await Promise.all(deletePromises);
        
        return messagesToDelete.length;
      } catch (error) {
        console.error('Error cleaning up expired messages:', error);
        set({ error: error as Error });
        return 0;
      }
    }
  };

  console.log('%c🔧 Creating chat store', 'background: #3f51b5; color: white; padding: 2px 4px; border-radius: 2px;');
  console.log('Store functions:', Object.keys(store));
  console.log('subscribeToChat type:', typeof store.subscribeToChat);
  console.log('unsubscribeFromChat type:', typeof store.unsubscribeFromChat);
  console.log('createOrJoinActivityChat type:', typeof store.createOrJoinActivityChat);
  console.log('sendMessage type:', typeof store.sendMessage);
  
  return store;
});

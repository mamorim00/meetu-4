import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Layout } from "components/Layout";
import { useUserGuardContext } from "app"; // Assuming 'app' provides this context
import { MessageSquare, Loader2, Send, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "../utils/formatTime";

// Import DataSnapshot from firebase/database
import { ref, set, onValue, push, off, Database, connectDatabaseEmulator, DataSnapshot } from "firebase/database";

import { realtimeDb, firestore} from "../utils/firebase"; // Ensure these are initialized firebase app instances
import { useChatStore } from "../utils/chatStore";
import { doc, updateDoc, Timestamp as FirestoreTimestamp } from "firebase/firestore"; // Import Timestamp from firestore
import { useActivityStore } from '../utils/activityStore';  // adjust path

// Simplified chat message interface
interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

// Define a basic type for the chat data structure you expect from snapshot.val()
interface ChatStructure {
  id: string;
  activityId: string;
  members?: {
    [userId: string]: {
      userId: string;
      displayName: string;
      joinedAt: number;
    };
  };
  createdAt: number;
  // Potentially add a lastMessage field if your structure includes it here
  // lastMessage?: { text: string; senderName: string; timestamp: number; };
}

// Define a basic type for the messages data structure
interface MessagesStructure {
    [messageId: string]: Omit<ChatMessage, 'id'>; // Messages indexed by ID, matching ChatMessage without the ID
}


export default function ChatDetail() {
  const { user } = useUserGuardContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activityId = searchParams.get("activityId");
  const activityName = searchParams.get("activityName") || "Activity Chat";

  // Check if we have an activity ID
  // useEffect hook moved inside the component where it's always called
  useEffect(() => {
      if (!activityId) {
          toast.error("Missing activity ID");
          navigate("/chats");
      }
  }, [activityId, navigate]); // Add activityId and navigate to dependencies

  // Only render the redirect message if activityId is truly missing initially
  if (!activityId) {
    return <Layout>Redirecting...</Layout>;
  }

  return (
    <Layout>
      <div className="container max-w-4xl py-6">
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="p-2 h-8 w-8"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <h1 className="text-2xl font-semibold">{activityName}</h1>
        </div>

        <Card className="border shadow-sm">
          <CardHeader className="bg-primary/5 border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium">Chat</h2>
                <p className="text-sm text-muted-foreground">Talk with other participants</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* activityId check already done above, but keeping for clarity */}
            {activityId && <SimpleChatInterface activityId={activityId} />}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

interface SimpleChatInterfaceProps {
  activityId: string;
}

const SimpleChatInterface: React.FC<SimpleChatInterfaceProps> = ({ activityId }) => {
  const { user } = useUserGuardContext();
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Clean up function for message listeners
  const cleanupListeners = () => {
    try {
      console.log("Cleaning up chat listeners...");
      if (realtimeDb) {
        const messagesRef = ref(realtimeDb, `chat-messages/${activityId}`);
        // The `off` function needs the reference and optionally the event type and callback
        // Calling it just with the reference will remove all listeners at that location
        off(messagesRef);
      }
    } catch (error) {
      console.error("Error cleaning up listeners:", error);
    }
  };

  // Handle initial join and message subscription
  const initializeChat = async () => {
    if (!activityId || !user || !realtimeDb) {
      setError(new Error("Missing required data for chat or user")); // More specific error
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null); // Clear previous errors

    try {
      // First, create or join the chat
      console.log(`Initializing chat for activity: ${activityId}`);

      // Ensure user is in the chat members list
      const chatRef = ref(realtimeDb, `activity-chats/${activityId}`);

      // Use DataSnapshot type for the resolved promise value
      const snapshot: DataSnapshot = await new Promise((resolve, reject) => {
           // Add error handler to onValue for the promise
           onValue(chatRef, resolve, reject, { onlyOnce: true });
      });


      // Type assertion for chatData based on the ChatStructure interface
      const chatData = snapshot.val() as ChatStructure | null;

      const timestamp = Date.now();

      if (!chatData) {
        console.log(`Creating new chat for activity: ${activityId}`);
        // Create new chat
        await set(chatRef, {
          id: activityId,
          activityId, // Redundant if key is activityId, but okay
          members: {
            [user.uid]: {
              userId: user.uid,
              displayName: user.displayName || "Anonymous",
              joinedAt: timestamp
            }
          },
          createdAt: timestamp
        });

        // Add welcome message
        const messagesRef = ref(realtimeDb, `chat-messages/${activityId}`);
        const newMessageRef = push(messagesRef);
        await set(newMessageRef, {
          senderId: "system",
          senderName: "System",
          text: `Welcome to the activity chat! This is where you can coordinate with other participants.`,
          timestamp
        });
         console.log("New chat created and welcome message sent.");
      } else {
        console.log(`Chat found for activity: ${activityId}`);
        // Just add user to members if not already there
        // Use optional chaining safely access members
        if (!chatData.members?.[user.uid]) {
          console.log(`Adding user ${user.uid} to chat members.`);
          const memberRef = ref(realtimeDb, `activity-chats/${activityId}/members/${user.uid}`);
          await set(memberRef, {
            userId: user.uid,
            displayName: user.displayName || "Anonymous",
            joinedAt: timestamp
          });

          // Add system message about new member
          const messagesRef = ref(realtimeDb, `chat-messages/${activityId}`);
          const newMessageRef = push(messagesRef);
          await set(newMessageRef, {
            senderId: "system",
            senderName: "System",
            text: `${user.displayName || "A new participant"} has joined the chat.`,
            timestamp
          });
           console.log("User added to members and system message sent.");
        } else {
             console.log(`User ${user.uid} is already a member.`);
        }
      }

      // Subscribe to messages
      const messagesRef = ref(realtimeDb, `chat-messages/${activityId}`);
      // Add DataSnapshot type annotation to the listener callback parameter
      onValue(messagesRef, (snapshot: DataSnapshot) => {
        // Type assertion for messagesData based on the MessagesStructure interface
        const messagesData = snapshot.val() as MessagesStructure | null;
        const formattedMessages: ChatMessage[] = [];

        if (messagesData) {
          Object.keys(messagesData).forEach(key => {
            const message = messagesData[key];

            // Basic validation for message structure
            if (message && typeof message.senderId === 'string' && typeof message.senderName === 'string' && typeof message.text === 'string' && typeof message.timestamp === 'number') {
                 formattedMessages.push({
                  id: key,
                  senderId: message.senderId,
                  senderName: message.senderName,
                  text: message.text,
                  timestamp: message.timestamp
                });
            } else {
                 console.warn(`Skipping invalid message data for key ${key}:`, message);
            }
          });

          // Sort messages by timestamp
          formattedMessages.sort((a, b) => a.timestamp - b.timestamp);
        }

        setMessages(formattedMessages);
        setIsLoading(false);
        setRefreshing(false); // Also stop refreshing indicator here
        console.log(`Received ${formattedMessages.length} messages.`);
      }, (error) => {
           // Add error handler for the message listener
           console.error("Error fetching messages:", error);
           setError(error instanceof Error ? error : new Error("Failed to load messages"));
           setIsLoading(false);
           setRefreshing(false); // Also stop refreshing indicator on error
      });

      // toast.success("Connected to chat"); // Maybe only show success if messages are loaded? Or keep here.

    } catch (error) {
      console.error("Error initializing chat:", error);
      setError(error instanceof Error ? error : new Error("Failed to initialize chat"));
      setIsLoading(false);
      setRefreshing(false); // Also stop refreshing indicator on error
      toast.error("Failed to connect to chat");
    }
  };

  // Initialize on mount and re-run if activityId or user changes
  useEffect(() => {
    initializeChat();

    // Return cleanup function
    return () => {
        console.log("Component unmounting, cleaning up...");
        cleanupListeners();
    };
  }, [activityId, user?.uid, realtimeDb]); // Add user.uid and realtimeDb to dependencies

  // Mark chat as read when viewing
  // Moved this to happen once messages are loaded to ensure the chat exists
  useEffect(() => {
    // Only mark as read if messages have loaded and there's no error
    if (!isLoading && !error && messages.length > 0) {
        const chatStore = useChatStore.getState();
        if (activityId && chatStore.markChatAsRead) {
            chatStore.markChatAsRead(activityId);
            console.log(`Marked chat ${activityId} as read.`);
        }
    }
  }, [activityId, messages, isLoading, error]); // Dependencies include state that indicates readiness

  // Scroll to bottom when messages change
  useEffect(() => {
    // Only scroll if not refreshing or loading, and messages exist
    if (messagesEndRef.current && !isLoading && !refreshing && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, refreshing]); // Depend on state that affects rendering/scrolling

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!messageText?.trim() || !user || !realtimeDb || !firestore || sending) {
         console.warn("Cannot send message: missing text, user, db connection, or sending in progress.");
         return; // Prevent sending if prerequisites are not met
    }

    setSending(true);
    try {
      // 1) push into RealtimeDB
      const messagesRef = ref(realtimeDb, `chat-messages/${activityId}`);
      const newMessageRef = push(messagesRef);
      const nowTs = Date.now();
      const messageData = {
        senderId: user.uid,
        senderName: user.displayName || 'Anonymous',
        text: messageText.trim(),
        timestamp: nowTs // Use JS timestamp here
      };
      await set(newMessageRef, messageData);
       console.log("Message sent to Realtime DB.");

      // 2) mirror into Firestore activity doc - Use Firestore Timestamp
      const activityDocRef = doc(firestore, 'activities', activityId); // Get Firestore doc ref
      await updateDoc(activityDocRef, {
          lastMessage: {
              text: messageData.text,
              senderName: messageData.senderName,
              // Convert JS timestamp to Firestore Timestamp for Firestore update
              timestamp: FirestoreTimestamp.fromMillis(nowTs)
          }
          // You might also want to update a 'updatedAt' field here
          // updatedAt: FirestoreTimestamp.now()
      });
       console.log("Last message updated in Firestore.");


      setMessageText('');
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };


  // Handle enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Manual refresh
  const handleRefresh = () => {
    if (refreshing || isLoading) return; // Prevent multiple refresh attempts
    console.log("Manual refresh triggered.");
    setRefreshing(true);
    cleanupListeners(); // Clean up old listeners
    initializeChat(); // Re-initialize which sets up new listeners
  };

  // Get initials for avatar
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    // Filter out empty strings in case of multiple spaces
    return name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0].toUpperCase()) // Use toUpperCase() consistently
      .join("");
  };

  // Check if message is from current user
  const isCurrentUserMessage = (senderId: string) => {
    return user && senderId === user.uid; // Ensure user exists before checking uid
  };

  // Check if message is from system
  const isSystemMessage = (senderId: string) => {
    return senderId === "system";
  };

  // Render messages
  const renderMessages = () => {
    if (isLoading && !refreshing) { // Show loader only on initial load, not refresh
      return (
        <div className="flex-grow flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
        </div>
      );
    }

     if (error) {
      return (
        <div className="flex-grow flex items-center justify-center py-16 text-center">
          <div className="max-w-md">
            <h3 className="text-lg font-medium text-destructive mb-2">Connection Error</h3>
            <p className="text-muted-foreground mb-4">{error.message || "Failed to connect to chat"}</p>
            <Button onClick={handleRefresh} disabled={refreshing}> {/* Use handleRefresh */}
                {refreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Try Again
            </Button>
          </div>
        </div>
      );
    }


    if (!messages || messages.length === 0) {
      return (
        <div className="flex-grow flex items-center justify-center py-16 text-center">
          <div className="max-w-md">
            <div className="mx-auto bg-primary/10 h-16 w-16 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-primary/70" />
            </div>
            <h3 className="text-lg font-medium mb-2">No messages yet</h3>
            <p className="text-muted-foreground">Start the conversation below!</p>
          </div>
        </div>
      );
    }

    return (
      <ScrollArea className="h-[60vh] p-4"> {/* Consider min-h-[60vh] if content is short */}
        <div className="space-y-4">
          {messages.map((message) => {
            const isSystem = isSystemMessage(message.senderId);
            const isMine = isCurrentUserMessage(message.senderId);

            if (isSystem) {
              return (
                <div key={message.id} className="mx-auto max-w-[85%] text-center">
                  <div className="bg-muted/30 text-xs italic text-muted-foreground p-2 rounded-lg">
                    {message.text}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={message.id}
                className={`flex gap-2 max-w-[85%] ${isMine ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {!isMine && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    {/* Add AvatarImage if you have user profile pictures */}
                    {/* <AvatarImage src={message.senderPhotoURL} alt={message.senderName} /> */}
                    <AvatarFallback>{getInitials(message.senderName)}</AvatarFallback>
                  </Avatar>
                )}

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground"> {/* Added text-muted-foreground for sender name */}
                    {isMine ? 'You' : message.senderName}
                  </p>

                  <div className={`p-3 rounded-lg ${isMine ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}> {/* Added text-muted-foreground */}
                    <p className="whitespace-pre-wrap break-words">{message.text}</p>
                  </div>

                  <p className="text-xs text-muted-foreground text-right">
                    {/* formatTime expects a number (timestamp) */}
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} /> {/* Element to scroll into view */}
        </div>
      </ScrollArea>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh - 180px)]"> {/* Adjust height based on surrounding layout */}
      {renderMessages()}

      <div className="p-4 border-t bg-card"> {/* Added bg-card for clarity */}
        {/* Show refresh button only when not loading or there's an error */}
        {!isLoading && messages.length > 0 && !error && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="mb-2 w-full flex items-center justify-center gap-1 text-xs"
            >
              {refreshing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {refreshing ? "Refreshing..." : "Refresh Messages"}
            </Button>
        )}


        <div className="flex gap-2 items-center"> {/* Added items-center */}
          <Input
            placeholder="Type a message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading || !user || sending || error !== null || refreshing} // Disable if refreshing
            className="flex-grow pr-10" // Add padding for potential send icon positioning if desired
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !messageText?.trim() || sending || !user || error !== null || refreshing} // Disable if refreshing
            size="icon"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
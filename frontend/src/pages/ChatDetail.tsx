import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Layout } from "components/Layout";
import { useUserGuardContext } from "app";
import { MessageSquare, Loader2, Send, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "../utils/formatTime";
import { ref, set, onValue, push, off, database, connectDatabaseEmulator } from "firebase/database";
import { realtimeDb } from "../utils/firebase";
import { useChatStore } from "../utils/chatStore";

// Simplified chat message interface
interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export default function ChatDetail() {
  const { user } = useUserGuardContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activityId = searchParams.get("activityId");
  const activityName = searchParams.get("activityName") || "Activity Chat";
  
  // Check if we have an activity ID
  if (!activityId) {
    useEffect(() => {
      toast.error("Missing activity ID");
      navigate("/chats");
    }, [navigate]);
    
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
        off(messagesRef);
      }
    } catch (error) {
      console.error("Error cleaning up listeners:", error);
    }
  };
  
  // Handle initial join and message subscription
  const initializeChat = async () => {
    if (!activityId || !user || !realtimeDb) {
      setError(new Error("Missing required data for chat"));
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // First, create or join the chat
      console.log(`Initializing chat for activity: ${activityId}`);
      
      // Ensure user is in the chat members list
      const chatRef = ref(realtimeDb, `activity-chats/${activityId}`);
      const snapshot = await new Promise((resolve) => {
        onValue(chatRef, resolve, { onlyOnce: true });
      });
      
      const chatData = snapshot.val();
      const timestamp = Date.now();
      
      if (!chatData) {
        // Create new chat
        await set(chatRef, {
          id: activityId,
          activityId,
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
      } else {
        // Just add user to members if not already there
        if (!chatData.members || !chatData.members[user.uid]) {
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
        }
      }
      
      // Subscribe to messages
      const messagesRef = ref(realtimeDb, `chat-messages/${activityId}`);
      onValue(messagesRef, (snapshot) => {
        const messagesData = snapshot.val();
        const formattedMessages: ChatMessage[] = [];
        
        if (messagesData) {
          Object.keys(messagesData).forEach(key => {
            const message = messagesData[key];
            
            if (!message) return;
            
            formattedMessages.push({
              id: key,
              senderId: message.senderId || "",
              senderName: message.senderName || "Unknown",
              text: message.text || "",
              timestamp: message.timestamp || Date.now()
            });
          });
          
          // Sort messages by timestamp
          formattedMessages.sort((a, b) => a.timestamp - b.timestamp);
        }
        
        setMessages(formattedMessages);
        setIsLoading(false);
        setRefreshing(false);
      });
      
      toast.success("Connected to chat");
    } catch (error) {
      console.error("Error initializing chat:", error);
      setError(error instanceof Error ? error : new Error("Failed to initialize chat"));
      setIsLoading(false);
      setRefreshing(false);
    }
  };
  
  // Initialize on mount
  useEffect(() => {
    initializeChat();
    
    return cleanupListeners;
  }, [activityId, user]);
  
  // Mark chat as read when viewing
  useEffect(() => {
    const chatStore = useChatStore.getState();
    if (activityId && chatStore.markChatAsRead) {
      chatStore.markChatAsRead(activityId);
    }
  }, [activityId]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);
  
  // Handle sending a message
  const handleSendMessage = async () => {
    if (!messageText?.trim() || !user || sending) {
      return;
    }
    
    try {
      setSending(true);
      
      if (!realtimeDb) {
        throw new Error("Database not available");
      }
      
      const messagesRef = ref(realtimeDb, `chat-messages/${activityId}`);
      const newMessageRef = push(messagesRef);
      
      // Create message object
      const messageData = {
        senderId: user.uid,
        senderName: user.displayName || "Anonymous",
        text: messageText.trim(),
        timestamp: Date.now()
      };
      
      // Save to database
      await set(newMessageRef, messageData);
      setMessageText("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
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
    setRefreshing(true);
    cleanupListeners();
    initializeChat();
  };
  
  // Get initials for avatar
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((part) => part[0] || "")
      .join("")
      .toUpperCase();
  };
  
  // Check if message is from current user
  const isCurrentUserMessage = (senderId: string) => {
    return senderId === user.uid;
  };
  
  // Check if message is from system
  const isSystemMessage = (senderId: string) => {
    return senderId === "system";
  };
  
  // Render messages
  const renderMessages = () => {
    if (isLoading) {
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
            <Button onClick={initializeChat}>Try Again</Button>
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
      <ScrollArea className="h-[60vh] p-4">
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
                    <AvatarFallback>{getInitials(message.senderName)}</AvatarFallback>
                  </Avatar>
                )}
                
                <div className="space-y-1">
                  <p className="text-xs">
                    {isMine ? 'You' : message.senderName}
                  </p>
                  
                  <div className={`p-3 rounded-lg ${isMine ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <p className="whitespace-pre-wrap break-words">{message.text}</p>
                  </div>
                  
                  <p className="text-xs text-muted-foreground text-right">
                    {formatTime(message.timestamp)}
                  </p>
                </div>
                

              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    );
  };
  
  return (
    <div className="flex flex-col h-full">
      {renderMessages()}
      
      <div className="p-4 border-t">
        {!isLoading && !error && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh} 
            disabled={refreshing} 
            className="mb-2 w-full flex items-center justify-center gap-1"
          >
            {refreshing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Refresh Messages
          </Button>
        )}
        
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading || !user || sending || error !== null}
            className="flex-grow"
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={isLoading || !messageText?.trim() || sending || !user || error !== null}
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

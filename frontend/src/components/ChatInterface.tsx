import React, { useState, useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useChatStore, ChatMessage } from "../utils/chatStore";
import { useUserGuardContext } from "app";
import { User, Loader2, Send, AlertTriangle, RefreshCw, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { formatTime } from "../utils/formatTime";
import { firebaseApp, realtimeDb } from "../utils/firebase";

interface Props {
  activityId: string;
}

// Create wrapper component to ensure consistent hook calls
export const ChatInterface: React.FC<Props> = ({ activityId }) => {
  const { user } = useUserGuardContext();
  
  // Log the initialization of the component with activity ID
  console.log(`%c🔄 ChatInterface initialized for activity: ${activityId}`, 'color: #2196F3; font-weight: bold;');
  console.log(`%c👤 User data available:`, 'color: #4CAF50; font-weight: bold;', user?.uid, user?.displayName || 'Anonymous');
  
  // Check Firebase initialization status
  console.log(`%c🔥 Firebase status:`, 'color: #FFA000; font-weight: bold;', {
    firebaseApp: !!firebaseApp,
    realtimeDb: !!realtimeDb
  });
  
  return <ChatContent activityId={activityId} user={user} />;
};

// Separate content component with stable hook calls
const ChatContent: React.FC<{ activityId: string; user: any }> = ({ activityId, user }) => {
  const { messages, isLoading, error, subscribeToChat, sendMessage, unsubscribeFromChat } = useChatStore();
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Setup and initialize chat connection
  const setupChat = useCallback(async () => {
    try {
      console.log(`%c📡 CHAT SETUP - Attempting to create/join chat for activity ${activityId}`, 'background: #2196F3; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;');
      console.log(`User ID: ${user.uid}`);
      console.log(`User display name: ${user.displayName || 'Anonymous'}`);
      
      // Clear any previous chat data and listeners
      unsubscribeFromChat();
      
      // First verify Realtime Database is available
      if (!realtimeDb) {
        throw new Error('Realtime Database not initialized');
      }
      
      // Get the direct store access to ensure we're calling the latest implementation
      console.log('%c🚀 Creating or joining activity chat...', 'color: #4CAF50; font-weight: bold;');
      await useChatStore.getState().createOrJoinActivityChat(activityId, user);
      
      // Then subscribe to messages
      console.log('%c📩 Now subscribing to messages...', 'color: #4CAF50; font-weight: bold;');
      // Direct reference to useChatStore to ensure we're calling the correct implementation
      await useChatStore.getState().subscribeToChat(activityId, user.uid);
      
      // Show success toast only on successful connection
      toast.success("Connected to activity chat");
      console.log('%c✅ Chat setup completed successfully', 'background: #4CAF50; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;');
    } catch (error) {
      console.error('%c❌ CHAT SETUP ERROR:', 'background: #F44336; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;', error);
      
      // Log detailed error information
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      
      // Be more specific with the error message
      const errorMessage = error instanceof Error ? error.message : "Could not connect to chat";
      toast.error(`Chat connection error: ${errorMessage}. Please try again.`);
    }
  }, [activityId, user, subscribeToChat, unsubscribeFromChat]);
  
  // Subscribe to chat messages
  useEffect(() => {
    // Define if we can setup chat with all required data
    const canSetupChat = !!(activityId && user && realtimeDb);
    
    console.log(`%c💬 CHAT INITIALIZATION`, 'background: #9C27B0; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;');
    console.log(`Can setup chat: ${canSetupChat}`);
    console.log(`Activity ID: ${activityId || 'Missing'}`);
    console.log(`User: ${user ? `${user.uid} (${user.displayName || 'Anonymous'})` : 'Missing'}`);
    console.log(`Realtime Database: ${realtimeDb ? 'Available' : 'Missing'}`);
    
    // Only execute chat setup if all conditions are met
    if (canSetupChat) {
      setupChat();
    } else {
      console.log("%c⚠️ Cannot setup chat - missing required data", 'color: #FF9800; font-weight: bold;', { 
        hasActivityId: !!activityId, 
        hasUser: !!user,
        hasRealtimeDb: !!realtimeDb
      });
    }
    
    // Cleanup on unmount
    return () => {
      console.log("%c🧹 Cleaning up chat - unsubscribing from all listeners", 'color: #607D8B; font-weight: bold;');
      // Check if unsubscribeFromChat exists before calling it
      if (typeof unsubscribeFromChat === 'function') {
        try {
          unsubscribeFromChat();
          console.log("%c✅ Successfully unsubscribed from chat", 'color: #4CAF50; font-weight: bold;');
        } catch (error) {
          console.error("%c❌ Failed to unsubscribe from chat:", 'color: #F44336; font-weight: bold;', error);
        }
      } else {
        console.warn("%c⚠️ unsubscribeFromChat is not a function", 'color: #FF9800; font-weight: bold;');
      }
    };
  }, [activityId, user, setupChat, unsubscribeFromChat]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);
  
  // Handle sending a message
  const handleSendMessage = async () => {
    if (!messageText?.trim() || !user || sending) {
      console.log('Cannot send message:', { 
        hasText: !!messageText?.trim(), 
        hasUser: !!user, 
        isSending: sending 
      });
      return;
    }
    
    try {
      setSending(true);
      console.log(`Sending message to activity ${activityId} by user ${user.uid}`);
      
      // Verify Firebase is properly initialized
      if (!realtimeDb) {
        console.error('Realtime Database not initialized for sending message');
        throw new Error('Chat service connection issue - please reload the page');
      }
      
      // Clear any previous errors
      if (error) {
        // Reset error state
        console.log("Clearing previous chat errors before sending");
      }
      
      if (!activityId) {
        throw new Error('Missing activity ID');
      }
      
      // Log detailed info for troubleshooting
      console.log("%c📤 MESSAGE SEND ATTEMPT", 'background: #4CAF50; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;');
      console.log("Activity ID:", activityId);
      console.log("User data:", { uid: user.uid, displayName: user.displayName });
      console.log("Message length:", messageText?.trim().length);
      console.log("Firebase status:", {
        realtimeDb: !!realtimeDb,
        firebaseApp: !!firebaseApp
      });
      
      await sendMessage(activityId, user, messageText);
      console.log("%c✅ Message sent successfully", 'color: #4CAF50; font-weight: bold;');
      setMessageText("");
    } catch (error) {
      console.error("%c❌ ERROR SENDING MESSAGE:", 'background: #F44336; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;', error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Display a user-friendly error message
      toast.error(
        <div className="flex flex-col gap-1">
          <strong>Failed to send message</strong>
          <span className="text-xs opacity-90">{errorMessage}</span>
          <span className="text-xs mt-1">Try refreshing the chat or page.</span>
        </div>
      );
      
      // Attempt to recover from error
      if (!isLoading && realtimeDb) {
        // Try to re-establish the chat connection on next message
        console.log("%c🔄 Will attempt to refresh chat on next message", 'color: #FF9800; font-weight: bold;');
      }
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
  
  // Generate initials for avatar
  const getInitials = (name: string | null | undefined) => {
    if (!name || typeof name !== 'string' || name.trim() === '') return '?';
    
    return name
      .trim()
      .split(" ")
      .filter(part => part.length > 0) // Filter out empty parts
      .map((part) => part[0] || '')
      .join("")
      .toUpperCase() || '?';
  };
  
  // Check if message is from system
  const isSystemMessage = (message: ChatMessage) => {
    return message.senderId === "system";
  };
  
  // Check if message is from current user
  const isCurrentUserMessage = (message: ChatMessage) => {
    return message.senderId === user?.uid;
  };
  
  return (
    <div className="flex flex-col h-full border rounded-xl overflow-hidden shadow-sm">
      <div className="bg-primary/5 px-4 py-3 border-b flex justify-between items-center">
        <div>
          <h3 className="font-semibold">Activity Chat</h3>
          <p className="text-xs text-muted-foreground">Participants can communicate here</p>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={`text-muted-foreground hover:text-foreground ${isLoading ? 'animate-spin' : ''}`}
            onClick={() => {
              console.log("%c🔄 Manual chat refresh requested", 'color: #2196F3; font-weight: bold;');
              if (!!activityId && !!user && !!realtimeDb) {
                toast.info("Refreshing chat messages...");
                setupChat();
              } else {
                console.error("Cannot refresh - missing required data:", {
                  activityId,
                  hasUser: !!user,
                  hasRealtimeDb: !!realtimeDb
                });
                toast.error("Cannot refresh - missing required data");
              }
            }}
            disabled={isLoading}
            title="Refresh chat messages"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-grow flex flex-col">
        {isLoading ? (
          <div className="flex-grow flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex-grow flex items-center justify-center text-center p-6">
            <div className="flex flex-col items-center max-w-md">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-destructive font-semibold text-lg">Chat Connection Error</h3>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                {error.message || "There was a problem connecting to the chat service"}
              </p>
              
              <div className="bg-muted/30 p-4 rounded-lg w-full mb-6">
                <h4 className="text-sm font-medium mb-2">Troubleshooting Steps:</h4>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                  <li>Check your internet connection</li>
                  <li>Try refreshing the page</li>
                  <li>Click the button below to reconnect</li>
                  <li>If problems persist, try again later</li>
                </ul>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    // Log the connection status
                    console.log("%c🔍 Checking connection status before reconnect:", 'color: #FF9800; font-weight: bold;', {
                      activityId,
                      hasUser: !!user,
                      hasRealtimeDb: !!realtimeDb,
                      error: error?.message
                    });
                    
                    window.location.reload();
                  }}
                >
                  Reload Page
                </Button>
                
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => {
                    // Try to reconnect
                    const canReconnect = !!activityId && !!user && !!realtimeDb;
                    
                    console.log("%c🔌 RECONNECT ATTEMPT", 'background: #FF9800; color: white; padding: 2px 4px; border-radius: 2px; font-weight: bold;');
                    console.log("Can reconnect:", canReconnect);
                    console.log("Activity ID:", activityId);
                    console.log("User data:", user?.uid);
                    console.log("Realtime Database available:", !!realtimeDb);
                    
                    if (canReconnect) {
                      toast.info("Attempting to reconnect to chat...");
                      
                      // Use the setupChat callback for consistency
                      setupChat();
                    } else {
                      console.error("%c❌ Cannot reconnect - missing required data", 'color: #F44336; font-weight: bold;');
                      toast.error("Cannot reconnect - missing required data. Please reload the page.");
                    }
                  }}
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Reconnect
                </Button>
              </div>
            </div>
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex-grow flex items-center justify-center text-center p-6">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-primary/70" />
              </div>
              <h3 className="font-medium text-base">No messages yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Start the conversation by sending a message below</p>
              <div className="text-xs text-muted-foreground px-6 py-3 bg-muted/30 rounded-lg max-w-xs">
                Use this chat to coordinate with other participants about this activity.
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-grow p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div 
                  key={message.id}
                  className={`flex gap-2 max-w-[85%] ${isSystemMessage(message) ? 'mx-auto' : isCurrentUserMessage(message) ? 'ml-auto' : 'mr-auto'}`}
                >
                  {/* Show other user's avatar on left for their messages */}
                  {!isCurrentUserMessage(message) && !isSystemMessage(message) && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback>{getInitials(message.senderName)}</AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className="space-y-1">
                    {/* System messages don't show sender name */}
                    {!isSystemMessage(message) && (
                      <p 
                        className={`text-xs ${isCurrentUserMessage(message) ? 'text-right' : 'text-left'}`}
                      >
                        {isCurrentUserMessage(message) ? 'You' : message.senderName}
                      </p>
                    )}
                    
                    <div 
                      className={`p-3 rounded-lg ${isSystemMessage(message) 
                        ? 'bg-muted/30 text-xs text-center italic text-muted-foreground' 
                        : isCurrentUserMessage(message) 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'}`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
                    </div>
                    
                    <p className="text-xs text-muted-foreground text-right">
                      {message.timestamp ? formatTime(message.timestamp) : 'Unknown time'}
                    </p>
                  </div>
                  
                  {/* Show current user's avatar on right for their messages */}
                  {isCurrentUserMessage(message) && !isSystemMessage(message) && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback>{getInitials(user?.displayName || 'You')}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}
      </div>
      
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading || !user}
            className="flex-grow"
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={isLoading || !messageText?.trim() || sending || !user}
            size="icon"
            title="Send message"
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

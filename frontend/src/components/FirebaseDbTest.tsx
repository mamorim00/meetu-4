import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { realtimeDb } from '../utils/firebase';
import { ref, set, onValue, push } from 'firebase/database';
import { useUserGuardContext } from 'app';
import { toast } from 'sonner';
import { useChatStore } from '../utils/chatStore';

interface TestResult {
  success: boolean;
  message: string;
  timestamp: number;
}

export const FirebaseDbTest = () => {
  const { user } = useUserGuardContext();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  
  const runTest = async () => {
    setIsLoading(true);
    setResults([]);
    
    try {
      // Test 1: Check if realtimeDb is initialized
      if (!realtimeDb) {
        setResults(prev => [...prev, {
          success: false,
          message: 'Realtime Database is not initialized',
          timestamp: Date.now()
        }]);
        return;
      }
      
      setResults(prev => [...prev, {
        success: true,
        message: 'Realtime Database is initialized',
        timestamp: Date.now()
      }]);
      
      // Test 2: Check if we can get database URL
      try {
        const dbUrl = realtimeDb.app.options.databaseURL;
        setResults(prev => [...prev, {
          success: true,
          message: `Database URL: ${dbUrl}`,
          timestamp: Date.now()
        }]);
      } catch (error) {
        setResults(prev => [...prev, {
          success: false,
          message: `Failed to get database URL: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: Date.now()
        }]);
      }
      
      // Test 3: Write test data
      try {
        const testPath = `tests/db-test-${Date.now()}`;
        const testRef = ref(realtimeDb, testPath);
        const testData = {
          timestamp: Date.now(),
          userId: user?.uid || 'anonymous',
          message: 'Test message'
        };
        
        await set(testRef, testData);
        
        setResults(prev => [...prev, {
          success: true,
          message: `Successfully wrote test data to ${testPath}`,
          timestamp: Date.now()
        }]);
        
        // Test 4: Read the data back
        const snapshot = await new Promise((resolve) => {
          onValue(testRef, resolve, { onlyOnce: true });
        });
        
        const readData = snapshot.val();
        if (readData && readData.timestamp === testData.timestamp) {
          setResults(prev => [...prev, {
            success: true,
            message: `Successfully read test data from ${testPath}`,
            timestamp: Date.now()
          }]);
        } else {
          setResults(prev => [...prev, {
            success: false,
            message: `Read data does not match written data: ${JSON.stringify(readData)}`,
            timestamp: Date.now()
          }]);
        }
        
        // Test 5: Test chat paths
        try {
          // Test activity-chats path
          const chatTestPath = 'activity-chats/test-activity';
          const chatRef = ref(realtimeDb, chatTestPath);
          
          setResults(prev => [...prev, {
            success: true,
            message: `Chat path reference created: ${chatRef.toString()}`,
            timestamp: Date.now()
          }]);
          
          // Test messages path
          const messagesTestPath = 'chat-messages/test-activity';
          const messagesRef = ref(realtimeDb, messagesTestPath);
          const newMessageRef = push(messagesRef);
          
          await set(newMessageRef, {
            senderId: 'system',
            senderName: 'Test',
            text: 'Test message',
            timestamp: Date.now()
          });
          
          setResults(prev => [...prev, {
            success: true,
            message: `Message written to ${messagesTestPath}`,
            timestamp: Date.now()
          }]);
          
          // Test reading messages
          const messagesSnapshot = await new Promise((resolve) => {
            onValue(messagesRef, resolve, { onlyOnce: true });
          });
          
          const messages = messagesSnapshot.val();
          setResults(prev => [...prev, {
            success: true,
            message: `${messages ? Object.keys(messages).length : 0} messages found at ${messagesTestPath}`,
            timestamp: Date.now()
          }]);
          
        } catch (error) {
          setResults(prev => [...prev, {
            success: false,
            message: `Chat path test failed: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: Date.now()
          }]);
        }
        
      } catch (error) {
        setResults(prev => [...prev, {
          success: false,
          message: `Write/read test failed: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: Date.now()
        }]);
      }
      
    } catch (error) {
      toast.error(`Test failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Run test on mount
  useEffect(() => {
    runTest();
  }, []);
  
  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Firebase Realtime Database Test</CardTitle>
        <CardDescription>
          Testing connection and permissions to the Firebase Realtime Database
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Running tests...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result, index) => (
                <div key={index} className="flex items-start">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                  )}
                  <div className="text-sm">
                    <p className={result.success ? "text-green-700" : "text-red-700"}>
                      {result.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              
              {results.length === 0 && !isLoading && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No test results yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter>
        <div className="flex gap-2">
          <Button 
            onClick={runTest} 
            disabled={isLoading}
            className="flex-1"
          >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Running Tests
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Tests Again
            </>
          )}
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => {
              // Direct test of chat store functions
              try {
                const store = useChatStore.getState();
                toast.info(`Store functions: ${Object.keys(store).join(', ')}`);
                console.log('Chat store state:', store);
                console.log('subscribeToChat type:', typeof store.subscribeToChat);
                console.log('unsubscribeFromChat type:', typeof store.unsubscribeFromChat);
                console.log('createOrJoinActivityChat type:', typeof store.createOrJoinActivityChat);
                console.log('sendMessage type:', typeof store.sendMessage);
              } catch (error) {
                toast.error(`Store test failed: ${error instanceof Error ? error.message : String(error)}`);
              }
            }}
          >
            Test Chat Store
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
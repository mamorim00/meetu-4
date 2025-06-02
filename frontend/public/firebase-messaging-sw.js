// ── frontend/public/firebase-messaging-sw.js ──

// public/firebase-messaging-sw.js
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw'; // Import from 'sw' for service worker


// 2) Initialize Firebase in the service worker. 
//    Use the same firebaseConfig values you use in your React code:
firebase.initializeApp({
    apiKey: "AIzaSyCDmreq2cbBXfz8DjfzHo4hPmj723-DarA",
    authDomain: "meetudatabutton.firebaseapp.com",
    databaseURL: "https://meetudatabutton-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "meetudatabutton",
    storageBucket: "meetudatabutton.firebasestorage.app",
    messagingSenderId: "277235281840",
    appId: "1:277235281840:web:94db26556b18afacc7b075",
    measurementId: "G-VZCFSE58NL"
});

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/firebase-logo.png', // Path to your notification icon
    data: payload.data // Contains activityId from your Cloud Function
  };

  // Show the notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click (when user taps the notification in the browser)
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  event.notification.close(); // Close the notification

  const activityId = event.notification.data.activityId;
  if (activityId) {
    // Open the relevant chat page. Adjust this URL to match your app's routing.
    const urlToOpen = `/chats/${activityId}`;
    event.waitUntil(clients.openWindow(urlToOpen));
  } else {
    // If no specific chat, open the main app
    event.waitUntil(clients.openWindow('/'));
  }
});
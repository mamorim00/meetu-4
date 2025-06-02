// ── frontend/public/firebase-messaging-sw.js ──

// 1) Import the “compat” snippets for Firebase App and Messaging:
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');



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

// 3) Retrieve an instance of Firebase Messaging so that it can handle background messages:
const messaging = firebase.messaging();

// 4) This callback is invoked when your web app receives a push while the page is in the background or closed:
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body,
    // icon: '/logo192.png', // optional
    data: payload.data,      // so you can handle clicks if you want
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

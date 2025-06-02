// ── frontend/public/firebase-messaging-sw.js ──

// 1) Import the “compat” snippets for Firebase App and Messaging:
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');



// 2) Initialize Firebase in the service worker. 
//    Use the same firebaseConfig values you use in your React code:
firebase.initializeApp({
  apiKey: "AIzaSyDuWyFzPQGpgw8-WKMPjnHBfTTgFXe1ZkQ",
  authDomain: "meetu-23587.firebaseapp.com",
  projectId: "meetu-23587",
  storageBucket: "meetu-23587.appspot.com",
  messagingSenderId: "329099428437",
  appId: "1:329099428437:web:e8aa7f69cbfb22f1c1bcdc",
  measurementId: "G-8BVL7NC3MV",
  databaseURL: "https://meetudatabutton-default-rtdb.europe-west1.firebasedatabase.app"
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

// ── frontend/src/utils/webPush.ts ──

import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { auth, firestore, messaging } from './firebase';

// Paste your actual Public VAPID Key from Firebase Console → Project Settings → Cloud Messaging
const VAPID_KEY = 'BDOUGWZp14RuvFVQOZwoyWcH09eugymVLIYGSHMRmwkYYSWG7hzk2opKkU858BQHwPbp1of0qYPJvaqyf6pTQ_g';

export function registerWebPush() {
  // 1) When a user logs in, register for Web Push:
  onAuthStateChanged(auth, (user) => {
    if (user) {
      registerForWebPush(user);
    }
  });

  // 2) Listen for incoming foreground messages
  onMessage(messaging, (payload) => {
    console.log('📨 Foreground message received:', payload);
    // e.g. you could trigger a toast/banner here
  });
}

async function registerForWebPush(user: User) {
  try {
    // Ask browser for permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('🚫 Web notifications permission not granted.');
      return;
    }

    // Get FCM token bound to this SW
    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!currentToken) {
      console.log('⚠️ No registration token available. Is SW registered?');
      return;
    }
    console.log('🔔 Web FCM token:', currentToken);

    // Save it to Firestore at /userProfiles/{uid}/webFcmToken
    const userDocRef = doc(firestore, 'userProfiles', user.uid);
    await setDoc(userDocRef, { webFcmToken: currentToken }, { merge: true });
    console.log('✅ Saved webFcmToken to Firestore for user:', user.uid);
  } catch (err) {
    console.error('❌ Error retrieving Web FCM token or saving to Firestore:', err);
  }
}
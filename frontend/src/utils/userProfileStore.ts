import { create } from 'zustand';
import { firebaseApp } from 'app';
import { getFirestore, doc, setDoc, getDoc, onSnapshot,updateDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';

// Initialize Firestore
const db = getFirestore(firebaseApp);

// Define user profile interface
export interface UserProfile {
  userId: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  createdAt: number;
  lastLoginAt: number;
  bio?: string;
  location?: string;
  interests?: string[];
  friends?: string[];
}

// Define store state
interface UserProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
  initialized: boolean;
  
  // Methods
  initializeListener: (user: User) => () => void;
  updateProfile: (data: Partial<Omit<UserProfile, 'userId'>>) => Promise<void>;
  getProfile: () => UserProfile | null;
}

// Create store
export const useUserProfileStore = create<UserProfileState>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,
  initialized: false,
  
  // Initialize listener for real-time updates
  initializeListener: (user: User) => {
    set({ isLoading: true });
    
    // Check if user has a profile, if not create one
    const createProfileIfNeeded = async () => {
      try {
        const userDocRef = doc(db, 'userProfiles', user.uid);
        const docSnap = await getDoc(userDocRef);
    
        if (!docSnap.exists()) {
          const newProfile: UserProfile = {
            userId: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || `User-${user.uid.substring(0, 5)}`,
            email: user.email,
            photoURL: user.photoURL,
            createdAt: Date.now(),
            lastLoginAt: Date.now(),
            friends: [],
          };
    
          await setDoc(userDocRef, newProfile);
          console.log('✅ Profile created successfully:', newProfile);
        } else {
          console.log('Existing profile found for:', user.uid);
    
          const existingData = docSnap.data();
          if (!existingData.displayName && user.displayName) {
            // Log data merge for verification
            await setDoc(userDocRef, { 
              displayName: user.displayName,
              lastLoginAt: Date.now() 
            }, { merge: true });
            console.log('Profile displayName updated:', user.displayName);
          } else {
            await setDoc(userDocRef, { lastLoginAt: Date.now() }, { merge: true });
            console.log('Profile lastLoginAt updated:', Date.now());
          }
        }
      } catch (error) {
        console.error('Error in profile creation/update:', error);
        set({ error: error as Error });
      }
    };
    
    
    // Create profile immediately (don't wait for async)
    createProfileIfNeeded();
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(
      doc(db, 'userProfiles', user.uid),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const profileData = docSnapshot.data() as UserProfile;
          console.log('Profile updated from Firestore:', { 
            userId: profileData.userId,
            displayName: profileData.displayName || 'NULL'
          });
          
          set({ 
            profile: profileData,
            isLoading: false,
            initialized: true
          });
        } else {
          console.warn('No profile document exists for user:', user.uid);
          set({ 
            isLoading: false,
            initialized: true
          });
        }
      },
      (error) => {
        console.error('Error in profile listener:', error);
        set({ 
          error: error as Error,
          isLoading: false
        });
      }
    );
    
    // Return unsubscribe function
    return unsubscribe;
  },
  
  // Update user profile
  updateProfile: async (data) => {
    const { profile } = get();
    if (!profile) return;
    
    try {
      // ① optimistic local update
      set({ profile: { ...profile, ...data } });
      
      // ② Firestore write
      await setDoc(
        doc(db, 'userProfiles', profile.userId),
        data,
        { merge: true }
      );
    } catch (error) {
      console.error('Error updating profile:', error);
      set({ error: error as Error });
    }
  },
  
  // Get current profile
  getProfile: () => {
    return get().profile;
  }
}));

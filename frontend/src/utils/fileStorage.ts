import { firebaseApp } from 'app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Initialize Firebase Storage
const storage = getStorage(firebaseApp);

/**
 * Uploads a file to Firebase Storage
 * @param file The file to upload
 * @param path The path to upload the file to (including filename)
 * @returns The download URL of the uploaded file
 */
export const uploadFile = async (file: File, path: string): Promise<string> => {
  try {
    // Create a reference to the file location
    const storageRef = ref(storage, path);
    
    // Upload the file
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Uploads a profile picture and returns the download URL
 * @param userId The user ID to associate with the file
 * @param file The image file to upload
 * @returns The download URL of the uploaded image
 */
export const uploadProfilePicture = async (userId: string, file: File): Promise<string> => {
  // Create a unique filename with timestamp to avoid cache issues
  const timestamp = Date.now();
  const fileExtension = file.name.split('.').pop();
  const filename = `profile_${userId}_${timestamp}.${fileExtension}`;
  
  // Path in Firebase Storage
  const path = `profile_pictures/${filename}`;
  
  return uploadFile(file, path);
};

import { createContext, useContext } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { useState, useEffect } from "react";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    GoogleAuthProvider, 
    signInWithPopup ,
    onAuthStateChanged,
    signOut,
} from "firebase/auth";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "firebase/storage";
// 🔥 1. Import functions
import { getFunctions } from "firebase/functions";

// Destructure env variables
const {
    VITE_API_KEY,
    VITE_AUTH_DOMAIN,
    VITE_PROJECT_ID,
    VITE_STORAGE_BUCKET,
    VITE_MSG_SEND_ID,
    VITE_APP_ID
} = import.meta.env;

const firebaseConfig = {
    apiKey: VITE_API_KEY,
    authDomain: VITE_AUTH_DOMAIN,
    projectId: VITE_PROJECT_ID,
    storageBucket: VITE_STORAGE_BUCKET,
    messagingSenderId: VITE_MSG_SEND_ID,
    appId: VITE_APP_ID
};

// Initialize Firebase services
const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();
const storage = getStorage(firebaseApp);
export const db = getFirestore(firebaseApp);
// 🔥 2. Initialize functions
export const functions = getFunctions(firebaseApp);


const FirebaseContext = createContext(null);
export const useFirebase = () => useContext(FirebaseContext);

export const FirebaseProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
            console.log(" Firebase Auth state changed:", user);
            setCurrentUser(user);
            setLoading(false); 
        });
        return () => unsubscribe();
    }, []);
    
    const saveToken = (user) => {
        user.getIdToken().then((token) => {
            localStorage.setItem("authToken", token);
        }).catch((error) => {
            console.error("Error saving token:", error);
        });
    };

    const signinEmail = async (email, password) => {
        try {
            const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
            saveToken(userCredential.user);
            return userCredential;
        } catch (error) {
            console.error("Sign-in error:", error);
            throw error;
        }
    };

    const signupEmail = async (email, password) => {
        try {
            const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
            saveToken(userCredential.user);
            return userCredential;
        } catch (error) {
            console.error("Sign-up error:", error);
            throw error;
        }
    };

    const signInWithGoogle = async () => {
        try {
            const userCredential = await signInWithPopup(firebaseAuth, googleProvider);
            saveToken(userCredential.user);
            return userCredential;
        } catch (error) {
            console.error("Google sign-in error:", error);
            throw error;
        }
    };

    const signOutUser = async () => {
        try {
          await signOut(firebaseAuth);
          localStorage.removeItem("authToken");
          setCurrentUser(null);
        } catch (error) {
          console.error("Error during sign out:", error);
        }
      };

    // Upload profile image to Firestore Storage and return download URL
    const uploadProfileImage = async (userId, file) => {
        if (!file) return null;
        
        try {
            const storageRef = ref(storage, `profileImages/${userId}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            return downloadURL;
        } catch (error) {
            console.error("Error uploading profile image:", error);
            throw error;
        }
    };

    //  3. Add new function for uploading the case file PDF
    /**
     * Uploads a case file to a unique path and returns the storage path.
     * @param {string} userId - The user's ID.
     * @param {File} file - The PDF file to upload.
     * @returns {Promise<string>} - The full path in Firebase Storage (e.g., "caseFiles/userId/fileName.pdf")
     */
    const uploadCaseFileToStorage = async (userId, file) => {
        if (!file) throw new Error("No file provided");
        if (!userId) throw new Error("No user ID provided");

        // We use a unique path for this file
        const storagePath = `caseFiles/${userId}/${file.name}`;
        const storageRef = ref(storage, storagePath);

        try {
            await uploadBytes(storageRef, file);
            // We return the PATH, not the download URL,
            // so the function can access it.
            return storagePath; 
        } catch (error) {
            console.error("Error uploading case file:", error);
            throw error;
        }
    };


    return (
        <FirebaseContext.Provider 
            value={{ 
                signupEmail, 
                signInWithGoogle, 
                signinEmail, 
                uploadProfileImage, 
                currentUser, 
                signOutUser,
                loading,
                
                uploadCaseFileToStorage 
            }}
        >
            {children}
        </FirebaseContext.Provider>
    );
};
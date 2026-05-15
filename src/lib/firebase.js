import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDcp7-UIG6BD8zMsU-pAe4JWs7WDfyuEBs",
  authDomain: "blgasm.firebaseapp.com",
  projectId: "blgasm",
  storageBucket: "blgasm.firebasestorage.app",
  messagingSenderId: "401822451055",
  appId: "1:401822451055:web:cbc7371a9afd4cdd27549a",
  measurementId: "G-45XLTYFFY6",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

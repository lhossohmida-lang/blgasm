"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDcp7-UIG6BD8zMsU-pAe4JWs7WDfyuEBs",
  authDomain: "blgasm.firebaseapp.com",
  projectId: "blgasm",
  storageBucket: "blgasm.firebasestorage.app",
  messagingSenderId: "401822451055",
  appId: "1:401822451055:web:cbc7371a9afd4cdd27549a",
  measurementId: "G-45XLTYFFY6",
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

// enableFirebaseOfflinePersistence removed — we use our own IndexedDB (lib/offline/db.ts)
// Firestore's built-in persistence conflicted with our sync system

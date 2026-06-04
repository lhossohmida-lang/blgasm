"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

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

// Persistent local cache — stores data in IndexedDB automatically.
// Works offline on Web, Electron, and Android (Capacitor) with zero extra code.
// Pending writes are buffered and flushed automatically when connectivity returns.
let firestoreDb;
try {
  firestoreDb = initializeFirestore(firebaseApp, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  // Already initialised (e.g. hot-reload) — reuse the existing instance
  firestoreDb = getFirestore(firebaseApp);
}
export const db = firestoreDb;

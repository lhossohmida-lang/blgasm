"use client";

import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/firebase";

let persistencePromise: Promise<void> | null = null;

function ensureLocalPersistence() {
  persistencePromise ??= setPersistence(auth, browserLocalPersistence);
  return persistencePromise;
}

export function listenToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function loginWithEmail(email: string, password: string) {
  await ensureLocalPersistence();
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(email: string, password: string) {
  await ensureLocalPersistence();
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export async function logout() {
  return signOut(auth);
}

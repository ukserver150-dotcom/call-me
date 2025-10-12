"use client";

import { createContext, useContext } from "react";
import { FirebaseApp } from "firebase/app";
import { Auth } from "firebase/auth";
import { Firestore } from "firebase/firestore";
import { Database } from "firebase/database";
import { firebaseApp, auth, firestore, db } from "@/lib/firebase";
import { AuthProvider } from "./auth/use-auth";
import { FirestoreProvider } from "./firestore/use-firestore";
import { DatabaseProvider } from "./database/use-database";
import { UserProvider } from "./auth/use-user";

interface FirebaseContextType {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  db: Database | null;
}

const FirebaseContext = createContext<FirebaseContextType>({
  app: null,
  auth: null,
  firestore: null,
  db: null,
});

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <FirebaseContext.Provider value={{ app: firebaseApp, auth, firestore, db }}>
      <AuthProvider>
        <FirestoreProvider>
          <DatabaseProvider>
            <UserProvider>
                {children}
            </UserProvider>
          </DatabaseProvider>
        </FirestoreProvider>
      </AuthProvider>
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => useContext(FirebaseContext);

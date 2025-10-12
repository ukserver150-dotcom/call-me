"use client";

import { createContext, useContext } from "react";
import { getFirestore, Firestore } from "firebase/firestore";
import { useFirebase } from "@/firebase/provider";

const FirestoreContext = createContext<Firestore | null>(null);

export const FirestoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { app } = useFirebase();
    const firestore = app ? getFirestore(app) : null;
    return <FirestoreContext.Provider value={firestore}>{children}</FirestoreContext.Provider>;
}

export const useFirestore = () => useContext(FirestoreContext);

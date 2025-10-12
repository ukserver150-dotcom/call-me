"use client";

import { createContext, useContext } from "react";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { useFirebase } from "@/firebase/provider";

const StorageContext = createContext<FirebaseStorage | null>(null);

export const StorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { app } = useFirebase();
    const storage = app ? getStorage(app) : null;
    return <StorageContext.Provider value={storage}>{children}</StorageContext.Provider>;
}

export const useStorage = () => useContext(StorageContext);

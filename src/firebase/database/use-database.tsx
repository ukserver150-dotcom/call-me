"use client";

import { createContext, useContext } from "react";
import { getDatabase, Database } from "firebase/database";
import { useFirebase } from "@/firebase/provider";

const DatabaseContext = createContext<Database | null>(null);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { app } = useFirebase();
    const db = app ? getDatabase(app) : null;
    return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}

export const useDatabase = () => useContext(DatabaseContext);

"use client";

import { createContext, useContext } from "react";
import { getAuth, Auth } from "firebase/auth";
import { useFirebase } from "@/firebase/provider";

const AuthContext = createContext<Auth | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { app } = useFirebase();
    const auth = app ? getAuth(app) : null;
    return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

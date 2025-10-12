"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/firebase/auth/use-auth";
import { useFirestore } from "@/firebase/firestore/use-firestore";
import { type User } from "@/lib/firebase/schema";

interface UserContextType {
  user: FirebaseUser | null;
  profile: User | null;
  loading: boolean;
}

const UserContext = createContext<UserContextType>({ user: null, profile: null, loading: true });

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setUser(user);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    if (!user || !firestore) {
      if (!user) {
        setProfile(null);
        setLoading(false);
      }
      return;
    }
    
    const profileRef = doc(firestore, "users", user.uid);
    const unsubscribe = onSnapshot(profileRef, (doc) => {
      if (doc.exists()) {
        setProfile(doc.data() as User);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, firestore]);

  return (
    <UserContext.Provider value={{ user, profile, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);

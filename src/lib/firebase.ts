import { initializeApp, getApp, type FirebaseOptions } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyDyLrZ57cmxYD-hldLeqTRbXRMLLuuym7o",
  authDomain: "call-me-a4977.firebaseapp.com",
  databaseURL: "https://call-me-a4977-default-rtdb.firebaseio.com",
  projectId: "call-me-a4977",
  storageBucket: "call-me-a4977.appspot.com",
  messagingSenderId: "46724772817",
  appId: "1:46724772817:web:41fa71425f9e1579a9e6f0",
  measurementId: "G-ZC4PL7FMB3"
};

function createFirebaseApp(config: FirebaseOptions) {
  try {
    return getApp();
  } catch {
    return initializeApp(config);
  }
}

const firebaseApp = createFirebaseApp(firebaseConfig);

export const firestore = getFirestore(firebaseApp);
export const db = getDatabase(firebaseApp);

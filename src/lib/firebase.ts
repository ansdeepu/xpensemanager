import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyB8SQZ-3Rl1J6FkUV-cQSktQhF4XXPrYQY",
    authDomain: "expense-manager-sk9l2.firebaseapp.com",
    projectId: "expense-manager-sk9l2",
    storageBucket: "expense-manager-sk9l2.firebasestorage.app",
    messagingSenderId: "243573001064",
    appId: "1:243573001064:web:697931173dcdb39cac64dd"
  };

// Initialize Firebase
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export { app, auth, db };

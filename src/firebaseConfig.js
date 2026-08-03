import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD0RiXGCd-gwthIUAURdP5l23aOLDkeczM",
  authDomain: "sistema-contabil-basico-cedup.firebaseapp.com",
  projectId: "sistema-contabil-basico-cedup",
  storageBucket: "sistema-contabil-basico-cedup.firebasestorage.app",
  messagingSenderId: "133331580587",
  appId: "1:133331580587:web:1381d49a594b488a6769ee",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

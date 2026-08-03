import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ============================================================================
// COLE AQUI AS 6 CHAVES DO SEU PROJETO NO FIREBASE
// (Firebase Console → ⚙ Configurações do projeto → seus apps → app da Web →
// "SDK do Firebase" → objeto firebaseConfig). Ver Seção 4 do manual de
// operacionalização — "Checklist para iniciar um novo projeto".
// ============================================================================
const firebaseConfig = {
  apiKey: "COLE_AQUI",
  authDomain: "COLE_AQUI",
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

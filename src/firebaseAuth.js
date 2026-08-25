import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebaseConfig";

// ============================================================================
// Senha/Código de Mestre: usado em dois momentos —
// 1) No primeiro login (Google) de um Professor(a), se informado, o perfil já
//    nasce como Mestre, aprovado automaticamente.
// 2) A CADA entrada de um usuário já cadastrado como Mestre, essa senha é
//    pedida de novo (gate de acesso administrativo — ver TelaSenhaMestre em
//    App.jsx), nunca fica salva entre sessões.
// Troque este valor periodicamente e nunca compartilhe por texto/grupo aberto
// — o repositório no GitHub é público (ver Seção 8 do manual de
// operacionalização).
// ============================================================================
export const CODIGO_MESTRE = "623251@_@prof";

export function observarSessao(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function cadastrar(nome, email, senha) {
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  await updateProfile(cred.user, { displayName: nome });
  return cred.user;
}

export async function entrar(email, senha) {
  const cred = await signInWithEmailAndPassword(auth, email, senha);
  return cred.user;
}

// Login com Google (Firebase Authentication → provedor Google, habilitado no
// Console do Firebase). Na primeira vez que uma conta Google entra, ainda não
// existe perfil no Firestore — a tela de "Completar cadastro" (App.jsx) cuida
// de pedir Turma/Tipo e criar o perfil nesse caso.
export async function entrarComGoogle() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

export async function sair() {
  await signOut(auth);
}

export async function recuperarSenha(email) {
  await sendPasswordResetEmail(auth, email);
}

export function traduzErroAuth(code) {
  const mapa = {
    "auth/email-already-in-use": "Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/weak-password": "A senha precisa ter pelo menos 6 caracteres.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/too-many-requests": "Muitas tentativas seguidas. Aguarde um pouco e tente novamente.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet e tente novamente.",
    "auth/popup-closed-by-user": "A janela de login do Google foi fechada antes de concluir. Tente novamente.",
    "auth/popup-blocked": "O navegador bloqueou a janela de login do Google. Permita pop-ups para este site e tente novamente.",
    "auth/cancelled-popup-request": "Login com Google cancelado. Tente novamente.",
    "auth/account-exists-with-different-credential":
      "Já existe uma conta com este e-mail usando login por senha. Entre com e-mail e senha nesse caso.",
  };
  return mapa[code] || "Não foi possível concluir a operação. Tente novamente.";
}

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebaseConfig";

// ============================================================================
// Código de Mestre: quem se cadastra digitando este código vira Usuário
// Mestre automaticamente, com aprovação automática (sem esperar outro Mestre
// aprovar). Troque este valor periodicamente e nunca compartilhe por
// texto/grupo aberto — o repositório no GitHub é público (ver Seção 8 do
// manual de operacionalização).
// ============================================================================
export const CODIGO_MESTRE = "CEDUP-TGVQ-XJ66-DMY9";

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
  };
  return mapa[code] || "Não foi possível concluir a operação. Tente novamente.";
}

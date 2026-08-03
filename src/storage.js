import {
  doc, getDoc, setDoc, deleteDoc, collection, query,
  orderBy, startAt, endAt, getDocs, documentId,
} from "firebase/firestore";
import { db, auth } from "./firebaseConfig";

// ============================================================================
// Camada única de acesso a dados: window.storage.get/set/delete/list.
// Por baixo, tudo vive numa única coleção "kv" no Firestore (Seção 7-D/G do
// manual de operacionalização) — nunca uma lista inteira num documento só
// (Seção 7-H), para nunca repetir o bug de um cadastro apagar o outro.
//
// shared=true  -> chave visível para todo mundo logado (turmas, empresas,
//                 usuários, lançamentos — dados da "sala de aula").
// shared=false -> chave só do usuário logado no momento (uso raro aqui).
// ============================================================================

const COLECAO = "kv";

function idDoDocumento(key, shared) {
  if (shared) return key;
  const uidAtual = auth.currentUser?.uid || "anonimo";
  return `${uidAtual}__${key}`;
}

async function get(key, shared = false) {
  const ref = doc(db, COLECAO, idDoDocumento(key, shared));
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Chave não encontrada: " + key);
  const dados = snap.data();
  return { key, value: dados.value, shared };
}

async function set(key, value, shared = false) {
  const ref = doc(db, COLECAO, idDoDocumento(key, shared));
  await setDoc(ref, { value, atualizadoEm: Date.now() });
  return { key, value, shared };
}

async function del(key, shared = false) {
  const ref = doc(db, COLECAO, idDoDocumento(key, shared));
  await deleteDoc(ref);
  return { key, deleted: true, shared };
}

async function list(prefix = "", shared = false) {
  const uidAtual = auth.currentUser?.uid || "anonimo";
  const prefixado = shared ? prefix : `${uidAtual}__${prefix}`;
  const col = collection(db, COLECAO);
  const q = query(
    col,
    orderBy(documentId()),
    startAt(prefixado),
    endAt(prefixado + "\uf8ff")
  );
  const snaps = await getDocs(q);
  const keys = snaps.docs.map((d) =>
    shared ? d.id : d.id.slice(uidAtual.length + 2)
  );
  return { keys, prefix, shared };
}

const storage = { get, set, delete: del, list };

if (typeof window !== "undefined") {
  window.storage = storage;
}

export default storage;

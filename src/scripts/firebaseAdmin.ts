console.log("=== INICIO firebaseAdmin.ts ===");
// SOLO para scripts Node.js (no usar en frontend)
import dotenv from "dotenv";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import path from "path";

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.log("[firebase-admin] Usando credenciales desde FIREBASE_SERVICE_ACCOUNT_JSON");
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else if (serviceAccountPath) {
    const resolvedServiceAccountPath = path.resolve(serviceAccountPath);
    console.log("[firebase-admin] Usando credenciales en:", resolvedServiceAccountPath);
    serviceAccount = JSON.parse(readFileSync(resolvedServiceAccountPath, "utf8"));
  } else {
    throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_PATH, GOOGLE_APPLICATION_CREDENTIALS o FIREBASE_SERVICE_ACCOUNT_JSON");
  }
  console.log("[firebase-admin] Credenciales cargadas correctamente. project_id:", serviceAccount.project_id);
} catch (err) {
  console.error("[firebase-admin] ERROR cargando credenciales:", err);
  throw err;
}

try {
  initializeApp({
    credential: cert(serviceAccount),
  });
  console.log("[firebase-admin] Inicialización correcta de firebase-admin.");
} catch (err) {
  console.error("[firebase-admin] ERROR inicializando firebase-admin:", err);
  throw err;
}

export const db = getFirestore();

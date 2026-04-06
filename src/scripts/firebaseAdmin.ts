console.log("=== INICIO firebaseAdmin.ts ===");
// SOLO para scripts Node.js (no usar en frontend)
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import path from "path";

// Cargar credenciales desde archivo serviceAccountKey.json
const serviceAccountPath = path.resolve("triniglassdb-firebase-adminsdk-fbsvc-587914b003.json");
console.log("[firebase-admin] Usando credenciales en:", serviceAccountPath);
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
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

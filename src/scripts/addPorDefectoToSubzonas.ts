console.log("=== INICIO SCRIPT addPorDefectoToSubzonas.ts ===");
import { db } from "./firebaseAdmin.ts";

export async function addPorDefectoToAllSubzonas() {
  try {
    const subzonasRef = db.collection("subzonas");
    const snapshot = await subzonasRef.get();
    console.log(`[DEBUG] Documentos encontrados en 'subzonas': ${snapshot.size}`);

    if (snapshot.empty) {
      console.log("[DEBUG] No se encontraron documentos en la colección 'subzonas'.");
      return;
    }

    const batch = db.batch();

    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { por_defecto: false });
      console.log(`[DEBUG] Preparando update para subzona id: ${docSnap.id}`);
    });

    await batch.commit();
    console.log(`[DEBUG] Total de subzonas actualizadas: ${snapshot.size}`);
  } catch (err) {
    console.error("[DEBUG] ERROR actualizando la colección 'subzonas':", err);
  }
}

addPorDefectoToAllSubzonas().then(() => process.exit(0));

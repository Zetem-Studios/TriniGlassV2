console.log("=== INICIO SCRIPT addSubzonaToProductos.ts ===");
import { db } from "./firebaseAdmin.ts";

// Asignación de subzona según la lógica actual
function getSubzona(producto: any): string {
  if (typeof producto.nombre_abreviado !== "string") return "";
  const nombre = producto.nombre_abreviado.toUpperCase().trim();
  if (nombre === "DUSCHOLUX" || nombre === "VICOMAM") return "Mamparista";
  const H_KEYS = ["CENTERGLAS", "REUGLAS", "NAVAS", "MACRISAL", "DINOR"];
  if (H_KEYS.some(key => nombre.includes(key))) return "H";
  const E_KEYS = ["VALLIRANA", "ESPINOSA", "RETANA", "TANCAMENTS", "NOUTEC", "ALGE", "WINDGLASS", "ALVICAT", "FENSTER"];
  if (E_KEYS.some(key => nombre.includes(key))) return "E";
  const D_KEYS = ["OTERO", "CLEMENTE", "FORNES"];
  if (D_KEYS.some(key => nombre.includes(key))) return "D";
  const F_KEYS = ["IBERPERFIL", "VALVERDE"];
  if (F_KEYS.some(key => nombre.includes(key))) return "F";
  const C_KEYS = ["BARCELONA", "COMPANY"];
  if (C_KEYS.some(key => nombre.includes(key))) return "C";
  const B_KEYS = ["PONSETI", "ALMANSA"];
  if (B_KEYS.some(key => nombre.includes(key))) return "B";
  const A_KEYS = ["GLORIA", "VIELMAR", "GUSTAMAN", "MOLALUM", "THERMIA", "FAURA", "BUCH", "MODUL"];
  if (A_KEYS.some(key => nombre.includes(key))) return "??";
  // Si no coincide con ninguna, asignar "A" (según la última lógica aplicada)
  return "A";
}

export async function addSubzonaToAllProductos() {
  try {
    const productosRef = db.collection("productos");
    const snapshot = await productosRef.get();
    console.log(`[DEBUG] Documentos encontrados en 'productos': ${snapshot.size}`);
    if (snapshot.empty) {
      console.log("[DEBUG] No se encontraron documentos en la colección 'productos'.");
      return;
    }
    const updates: Promise<void>[] = [];
    let count = 0;
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      console.log(`[DEBUG] Documento id: ${docSnap.id}, datos:`, data);
      const subzona = getSubzona(data);
      console.log(`[DEBUG] Preparando update para id: ${docSnap.id}, nombre_abreviado: ${data.nombre_abreviado}, subzona calculada: ${subzona}`);
      updates.push(
        docSnap.ref.update({ subzona })
          .then(() => {
            console.log(`[DEBUG] ✔️  subzona actualizado para id: ${docSnap.id}`);
            count++;
          })
          .catch((err) => {
            console.error(`[DEBUG] ❌ Error actualizando id: ${docSnap.id}`, err);
          })
      );
    });
    await Promise.all(updates);
    console.log(`[DEBUG] Total de productos actualizados: ${count}`);
  } catch (err) {
    console.error("[DEBUG] ERROR accediendo a la colección 'productos':", err);
  }
}

// Ejecutar siempre que se invoque el script
addSubzonaToAllProductos().then(() => process.exit(0));

// Para ejecutar manualmente desde un script o consola
// import { addSubzonaToAllProductos } from './scripts/addSubzonaToProductos';
// addSubzonaToAllProductos();

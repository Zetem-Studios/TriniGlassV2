const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const DRY_RUN = process.argv.includes("--apply") ? false : true;
const BATCH_LIMIT = 450;

async function main() {
  console.log(DRY_RUN ? "Modo DRY-RUN (no escribe)." : "Modo APPLY (escribe cambios).");

  const snap = await db
    .collection("productos")
    .where("estado_pedido", "==", "Entregado")
    .get();

  const fantasmas = snap.docs.filter((d) => {
    const x = d.data();
    return x.zona != null || x.subzona != null || x.posicion != null;
  });

  console.log(`Entregados totales: ${snap.size}`);
  console.log(`Con posición fantasma: ${fantasmas.length}`);

  if (fantasmas.length === 0) {
    console.log("Nada que limpiar.");
    return;
  }

  console.table(
    fantasmas.slice(0, 20).map((d) => {
      const x = d.data();
      return {
        id: d.id,
        zona: x.zona ?? null,
        subzona: x.subzona ?? null,
        posicion: x.posicion ?? null,
      };
    })
  );
  if (fantasmas.length > 20) {
    console.log(`... y ${fantasmas.length - 20} más`);
  }

  if (DRY_RUN) {
    console.log("\nDRY-RUN: no se ha modificado nada. Re-ejecuta con --apply para limpiar.");
    return;
  }

  let updated = 0;
  for (let i = 0; i < fantasmas.length; i += BATCH_LIMIT) {
    const chunk = fantasmas.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    chunk.forEach((d) => {
      batch.update(d.ref, {
        zona: null,
        subzona: null,
        posicion: null,
      });
    });
    await batch.commit();
    updated += chunk.length;
    console.log(`Lote ${i / BATCH_LIMIT + 1}: ${chunk.length} actualizados (acumulado: ${updated}).`);
  }

  console.log(`\nLimpieza completada. Total actualizados: ${updated}`);
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));

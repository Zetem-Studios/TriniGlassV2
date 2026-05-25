const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DRY_RUN = !process.argv.includes("--apply");
const PAGE_SIZE = 200; // 200 docs * 2 ops = 400 ops por batch (límite Firestore: 500)
const MAX_DOCS = Number(process.env.MAX_DOCS ?? 1000);

async function main() {
  console.log(
    DRY_RUN ? "Modo DRY-RUN (no escribe)." : "Modo APPLY (mueve productos -> palets_entregados)."
  );
  console.log(`Tope por ejecución: ${MAX_DOCS} docs.`);

  let lastDoc = null;
  let leidos = 0;
  let movidos = 0;

  while (leidos < MAX_DOCS) {
    let q = db
      .collection("productos")
      .where("estado_pedido", "==", "Entregado")
      .orderBy("__name__")
      .limit(Math.min(PAGE_SIZE, MAX_DOCS - leidos));
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;
    leidos += snap.size;

    if (DRY_RUN) {
      console.log(`Página leída: ${snap.size} docs (acumulado: ${leidos})`);
      snap.docs.slice(0, 5).forEach((d) => {
        const x = d.data();
        console.log(`  - ${d.id} | cliente: ${x.apellido_cliente ?? "?"} | posicion: ${x.posicion ?? "-"}`);
      });
      if (snap.size > 5) console.log(`  ... y ${snap.size - 5} más en esta página`);
    } else {
      const batch = db.batch();
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const archiveRef = db.collection("palets_entregados").doc(docSnap.id);
        batch.set(
          archiveRef,
          {
            ...data,
            movidoDesdeProductosEn: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      movidos += snap.size;
      console.log(`Lote: ${snap.size} movidos (total: ${movidos})`);
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }

  console.log(`\nFin. Leídos: ${leidos}, movidos: ${DRY_RUN ? 0 : movidos}.`);
  if (DRY_RUN) {
    console.log("Re-ejecuta con --apply para mover de verdad.");
    console.log("Tope ajustable con MAX_DOCS=500 node cleanEntregadosFantasma.js --apply");
  }
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));

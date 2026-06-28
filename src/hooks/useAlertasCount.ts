import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const parseFecha = (fecha: unknown): Date | null => {
  if (!fecha) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = fecha as any;
  if (fecha instanceof Date) return fecha;
  if (typeof any.toDate === "function") return any.toDate();
  const parsed = Date.parse(String(fecha));
  return isNaN(parsed) ? null : new Date(parsed);
};

export function useAlertasCount() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const snapshot = await getDocs(collection(db, "productos"));
        const hoy = new Date();
        let total = 0;

        snapshot.docs.forEach((doc) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = doc.data() as any;
          const fecha = parseFecha(data.fecha_linea_pedido);
          if (!fecha) return;
          const dias = Math.floor((hoy.getTime() - fecha.getTime()) / (1000 * 60 * 60 * 24));
          if (dias > 30) total++;
        });

        setCount(total);
      } catch {
        setCount(0);
      }
    };

    fetchCount();
  }, []);

  return count;
}

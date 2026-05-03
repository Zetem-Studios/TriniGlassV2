import { useState, useEffect } from "react";
import { AlertTriangle, Clock, MapPin, User, Package } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

interface PaletAlerta {
  id: string;
  client: string;
  zone: string;
  dimensions: string;
  weight: string;
  daysInStorage: number;
  fechaPedido: string;
}

const parseFecha = (fecha: unknown): Date | null => {
  if (!fecha) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = fecha as any;
  if (fecha instanceof Date) return fecha;
  if (typeof any.toDate === "function") return any.toDate();
  const parsed = Date.parse(String(fecha));
  return isNaN(parsed) ? null : new Date(parsed);
};

export default function Alertas() {
  const [alertas, setAlertas] = useState<PaletAlerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlertas = async () => {
      try {
        const snapshot = await getDocs(collection(db, "productos"));
        const hoy = new Date();
        const resultado: PaletAlerta[] = [];

        snapshot.docs.forEach((doc) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = doc.data() as any;
          const fechaPedido = parseFecha(data.fecha_linea_pedido);
          if (!fechaPedido) return;

          const daysInStorage = Math.max(
            0,
            Math.floor((hoy.getTime() - fechaPedido.getTime()) / (1000 * 60 * 60 * 24))
          );

          if (daysInStorage > 30) {
            resultado.push({
              id: data.codigo_barra || data.numero_linea_pedido || doc.id,
              client: data.apellido_cliente || data.nombre_abreviado || "Cliente desconocido",
              zone: data.subzona ? String(data.subzona) : "Sin zona",
              dimensions: `${data.altura || 0} x ${data.longitud || 0} mm`,
              weight: `${data.peso_total_kg || 0} kg`,
              daysInStorage,
              fechaPedido: fechaPedido.toLocaleDateString("es-ES"),
            });
          }
        });

        // Ordenar por días en almacén descendente (más crítico primero)
        resultado.sort((a, b) => b.daysInStorage - a.daysInStorage);
        setAlertas(resultado);
      } catch (err) {
        console.error("Error cargando alertas:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlertas();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Alertas del Sistema</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Palets con más de 30 días en almacén que requieren atención.
        </p>
      </div>

      {/* BANNER RESUMEN */}
      {!loading && alertas.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-red-400">
              {alertas.length} palet{alertas.length !== 1 ? "s" : ""} en estado crítico
            </p>
            <p className="text-sm text-slate-400">
              Llevan más de 30 días almacenados sin salida registrada.
            </p>
          </div>
        </div>
      )}

      {/* TABLA */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
                <th className="p-4 font-medium text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5"><Package size={14} /> ID / Código</div>
                </th>
                <th className="p-4 font-medium text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5"><User size={14} /> Cliente</div>
                </th>
                <th className="p-4 font-medium text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5"><MapPin size={14} /> Zona</div>
                </th>
                <th className="p-4 font-medium text-slate-500 dark:text-slate-400">Dimensiones / Peso</th>
                <th className="p-4 font-medium text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5"><Clock size={14} /> Fecha entrada</div>
                </th>
                <th className="p-4 font-medium text-slate-500 dark:text-slate-400 text-right">Días en almacén</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500 dark:text-slate-400">
                    Cargando alertas...
                  </td>
                </tr>
              ) : alertas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-emerald-100 dark:bg-emerald-900/20 rounded-full">
                        <AlertTriangle size={24} className="text-emerald-500" />
                      </div>
                      <p className="font-medium text-slate-900 dark:text-white">Sin alertas activas</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Todos los palets llevan menos de 30 días en almacén.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                alertas.map((alerta) => (
                  <tr
                    key={alerta.id}
                    className="hover:bg-red-50/40 dark:hover:bg-red-900/10 transition-colors"
                  >
                    <td className="p-4 font-medium text-slate-900 dark:text-white">{alerta.id}</td>
                    <td className="p-4 text-slate-700 dark:text-slate-300">{alerta.client}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {alerta.zone}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                      <div>{alerta.dimensions}</div>
                      <div className="text-slate-400 dark:text-slate-500">{alerta.weight}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{alerta.fechaPedido}</td>
                    <td className="p-4 text-right">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border border-red-200 dark:border-red-500/30">
                        <Clock size={11} />
                        {alerta.daysInStorage} días
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && alertas.length > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-sm text-slate-500 dark:text-slate-400">
            {alertas.length} palet{alertas.length !== 1 ? "s" : ""} con prioridad alta
          </div>
        )}
      </div>
    </div>
  );
}

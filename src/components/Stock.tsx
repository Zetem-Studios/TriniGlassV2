import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { 
  Search, Filter, Plus, Eye, Edit, Copy, AlertCircle,
  ChevronUp
} from "lucide-react";
import { 
  collection, getDocs, query, where, orderBy, limit, Timestamp, 
  addDoc, updateDoc, doc 
} from "firebase/firestore";
import { db } from "../firebase";
import { 
  Button, Input, Select, Card, Badge, Table, Modal, useToast 
} from "./ui";
import { formatDate } from "../lib/utils";
import type { Column, SelectOption } from "./ui";

// Límite máximo de resultados por query en Firestore
const MAX_FIRESTORE_RESULTS = 200;

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => setDebouncedValue(value), delay);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, delay]);

  return debouncedValue;
};

interface Palet {
  id: string;
  docId: string;
  type: string;
  dimensions: string;
  client: string;
  date: string;
  location: string;
  status: string;
  zone?: string;
  codigo_barra?: string;
  codificador?: string;
  numero_linea_pedido?: string;
  referencia_linea_pedido?: string;
}

interface ServerFilters {
  status: string;
  zone: string;
  codificador: string;
  codigo_barra: string;
  numero_linea_pedido: string;
  referencia_linea_pedido: string;
  dateFrom: string;
  dateTo: string;
}

interface ClientFilters {
  client: string;
  type: string;
  widthMin: string;
  widthMax: string;
  heightMin: string;
  heightMax: string;
  thicknessMin: string;
  thicknessMax: string;
}

const EMPTY_PALET: Palet = {
  id: "",
  docId: "",
  type: "",
  dimensions: "0x0x0",
  client: "",
  date: "",
  location: "",
  status: "Pendiente",
  zone: "",
  codigo_barra: "",
  codificador: "",
  numero_linea_pedido: "",
  referencia_linea_pedido: "",
};

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "Todos los estados" },
  { value: "Para verificar", label: "Para verificar" },
  { value: "Codificada", label: "Codificada" },
  { value: "Producción", label: "Producción" },
  { value: "Producida", label: "Producida" },
  { value: "Bloqueada", label: "Bloqueada" },
];

const PALET_STATUS_OPTIONS: SelectOption[] = [
  { value: "Almacenado", label: "Almacenado" },
  { value: "Reservado", label: "Reservado" },
  { value: "Pendiente", label: "Pendiente" },
  { value: "Listo para carga", label: "Listo para carga" },
];

const ROWS_PER_PAGE_OPTIONS: SelectOption[] = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
];

const parseDimensions = (dimensions: string) => {
  const parts = dimensions.split("x").map((p) => Number(p.trim()) || 0);
  return {
    width: parts[0] || 0,
    height: parts[1] || 0,
    thickness: parts[2] || 0,
  };
};

const parseFirestoreDateToISO = (value: unknown): string => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  const anyValue = value as { toDate?: () => Date };
  if (anyValue?.toDate && typeof anyValue.toDate === "function") {
    return anyValue.toDate().toISOString().split("T")[0];
  }
  if (typeof value === "string") {
    return value.includes("/") ? value.split("/").reverse().join("-") : value;
  }
  return "";
};

const parseDateForFirestore = (dateValue: string) => {
  if (!dateValue) return Timestamp.now();
  const parsedDate = new Date(dateValue);
  return Number.isNaN(parsedDate.getTime()) ? Timestamp.now() : Timestamp.fromDate(parsedDate);
};

const mapPaletToFirestore = (palet: Palet) => {
  const { width, height, thickness } = parseDimensions(palet.dimensions);
  const dateTimestamp = parseDateForFirestore(palet.date);

  return {
    descripcion_producido_longitud: palet.type || "Sin descripción",
    apellido_cliente: palet.client || "Cliente desconocido",
    fecha_linea_pedido: dateTimestamp,
    fecha_entrega: dateTimestamp,
    subzona: palet.location || palet.zone || null,
    estado_pedido: palet.status || "Pendiente",
    codificador: palet.codificador || null,
    codigo_barra: palet.codigo_barra || null,
    numero_linea_pedido: palet.numero_linea_pedido || palet.id || null,
    referencia_linea_pedido: palet.referencia_linea_pedido || null,
    longitud: width,
    altura: height,
    peso_pieza_kg: thickness,
  };
};

const getStatusBadgeVariant = (status: string): "success" | "warning" | "info" | "neutral" => {
  switch (status) {
    case "Almacenado": return "success";
    case "Pendiente": return "warning";
    case "Reservado": return "info";
    default: return "neutral";
  }
};

export default function Stock() {
  const { addToast } = useToast();
  
  const [inventory, setInventory] = useState<Palet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const [hitLimit, setHitLimit] = useState(false);

  const [serverFilters, setServerFilters] = useState<ServerFilters>({

    status: "",
    zone: "",
    codificador: "",
    codigo_barra: "",
    numero_linea_pedido: "",
    referencia_linea_pedido: "",
    dateFrom: "",
    dateTo: "",
  });

  const [clientFilters, setClientFilters] = useState<ClientFilters>({
    client: "",
    type: "",
    widthMin: "",
    widthMax: "",
    heightMin: "",
    heightMax: "",
      thicknessMin: "",
      thicknessMax: "",
  });

  const [isViewMode, setIsViewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const debouncedServerFilters = useDebounce(JSON.stringify(serverFilters), 400);
  const debouncedClient = useDebounce(clientFilters.client, 400);
  const debouncedType = useDebounce(clientFilters.type, 400);

  // Panel lateral de edición
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedPalet, setSelectedPalet] = useState<Palet | null>(null);

  // Paginado
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchStock = useCallback(async () => {
    const filters = JSON.parse(debouncedServerFilters) as ServerFilters;
    if (inventory.length === 0) {
      setLoading(true);
    }
    try {
      const conditions: ReturnType<typeof where>[] = [];

      if (filters.dateFrom) {
        conditions.push(where("fecha_linea_pedido", ">=", Timestamp.fromDate(new Date(filters.dateFrom))));
      }

      if (filters.dateTo) {
        conditions.push(where("fecha_linea_pedido", "<=", Timestamp.fromDate(new Date(filters.dateTo))));
      }

      if (filters.status) {
        conditions.push(where("estado_pedido", "==", filters.status));
      }

      if (filters.zone) {
        conditions.push(where("subzona", "==", filters.zone));
      }

      if (filters.codificador) {
        conditions.push(where("codificador", "==", filters.codificador));
      }

      if (filters.codigo_barra) {
        conditions.push(where("codigo_barra", "==", filters.codigo_barra));
      }

      if (filters.numero_linea_pedido) {
        conditions.push(where("numero_linea_pedido", "==", filters.numero_linea_pedido));
      }

      if (filters.referencia_linea_pedido) {
        conditions.push(where("referencia_linea_pedido", "==", filters.referencia_linea_pedido));
      }

      const productosQuery = query(
        collection(db, "productos"),
        ...conditions,
        orderBy("fecha_linea_pedido", "desc"),
        limit(MAX_FIRESTORE_RESULTS)
      );

      const querySnapshot = await getDocs(productosQuery);
      setHitLimit(querySnapshot.size >= MAX_FIRESTORE_RESULTS);

      const firestoreInventory: Palet[] = querySnapshot.docs.map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        const dateValue = data.fecha_entrega || data.fecha_linea_pedido || data.infos_entrega || "";
        const dateString = parseFirestoreDateToISO(dateValue);
        const ancho = Number(data.longitud ?? 0);
        const alto = Number(data.altura ?? 0);
        const grosor = Number(data.peso_pieza_kg ?? 0);
        const locationValue = data.subzona ? String(data.subzona) : "Sin zona";
        const estado = (data.estado_pedido as string) || (data.estado_linea_pdd as string) || "Pendiente";

        return {
          id: (data.numero_linea_pedido as string) || doc.id,
          docId: doc.id,
          type: (data.descripcion_producido_longitud as string) || (data.estado_linea_pdd as string) || "Sin descripción",
          dimensions: `${ancho || alto || 0}x${alto || 0}x${grosor || 0}`,
          client: (data.apellido_cliente as string) || (data.nombre_abreviado as string) || "Cliente desconocido",
          date: dateString,
          location: locationValue,
          status: estado,
          zone: data.subzona ? String(data.subzona) : "",
          codigo_barra: data.codigo_barra ? String(data.codigo_barra) : undefined,
          codificador: data.codificador ? String(data.codificador) : undefined,
          numero_linea_pedido: data.numero_linea_pedido ? String(data.numero_linea_pedido) : undefined,
          referencia_linea_pedido: data.referencia_linea_pedido ? String(data.referencia_linea_pedido) : undefined,
        };
      });

      setInventory(firestoreInventory);
    } catch (error) {
      console.error("Error cargando inventario desde Firestore:", error);
      if (inventory.length === 0) {
        setInventory([]);
      }
      addToast({ type: "error", title: "Error", message: "No se pudo cargar el inventario. Reintentando..." });
    } finally {
      setLoading(false);
    }
  }, [debouncedServerFilters, addToast]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const openPaletPanel = useCallback((palet: Palet | null, viewMode = false) => {
    setSelectedPalet(palet);
    setIsPanelOpen(true);
    setIsViewMode(viewMode);
    setActionError(null);
    setInfoMessage(null);
  }, []);

  const handleNewPalet = useCallback(() => {
    openPaletPanel({ ...EMPTY_PALET });
  }, [openPaletPanel]);

  const handleViewPalet = useCallback((palet: Palet) => {
    openPaletPanel(palet, true);
  }, [openPaletPanel]);

  const handleEditPalet = useCallback((palet: Palet) => {
    openPaletPanel(palet, false);
  }, [openPaletPanel]);

  const updateSelectedPaletField = useCallback((key: keyof Palet, value: string) => {
    setSelectedPalet((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const handleSavePalet = useCallback(async () => {
    if (!selectedPalet) return;
    setSaving(true);
    setActionError(null);

    try {
      const errors: string[] = [];
      if (!selectedPalet.client.trim()) errors.push("Cliente");
      if (!selectedPalet.type.trim()) errors.push("Tipo de material");
      if (!selectedPalet.dimensions.trim() || selectedPalet.dimensions === "0x0x0") errors.push("Dimensiones");

      if (errors.length > 0) {
        setActionError(`Campos obligatorios: ${errors.join(", ")}`);
        setSaving(false);
        return;
      }

      const paletToSave = { ...selectedPalet };
      const firestoreData = mapPaletToFirestore(paletToSave);

      if (paletToSave.docId) {
        await updateDoc(doc(db, "productos", paletToSave.docId), firestoreData);
      } else {
        const productRef = await addDoc(collection(db, "productos"), firestoreData);
        if (!paletToSave.numero_linea_pedido) {
          await updateDoc(productRef, { numero_linea_pedido: productRef.id });
          paletToSave.numero_linea_pedido = productRef.id;
        }
        paletToSave.docId = productRef.id;
        paletToSave.id = paletToSave.numero_linea_pedido || productRef.id;
        setSelectedPalet(paletToSave);
      }

      setInventory((prev) => {
        const exists = prev.some((p) => p.docId === paletToSave.docId);
        if (exists) {
          return prev.map((p) => (p.docId === paletToSave.docId ? { ...p, ...paletToSave } : p));
        }
        return [paletToSave, ...prev];
      });

      setIsPanelOpen(false);
      setSelectedPalet(null);
      addToast({ type: "success", title: "Guardado", message: paletToSave.docId ? "Palet actualizado" : "Palet creado" });
    } catch (error) {
      console.error("Error guardando palet:", error);
      setActionError("Error guardando cambios. Revisa la consola o intenta de nuevo.");
      addToast({ type: "error", title: "Error", message: "No se pudo guardar el palet" });
    } finally {
      setSaving(false);
    }
  }, [selectedPalet, addToast]);

  const handleCopyId = useCallback(async (palet: Palet) => {
    const textToCopy = palet.id || palet.docId;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setInfoMessage("ID copiado al portapapeles");
      setActionError(null);
      addToast({ type: "success", title: "Copiado", message: "ID copiado al portapapeles" });
    } catch {
      setActionError(null);
      window.prompt("Copia manualmente el ID:", textToCopy);
    }
  }, [addToast]);

  const handleMarkAsErroneous = useCallback(async () => {
    if (!selectedPalet?.docId) return;
    if (!window.confirm("¿Estás seguro de marcar este palet como erróneo?")) return;
    setSaving(true);
    setActionError(null);
    setInfoMessage(null);

    try {
      await updateDoc(doc(db, "productos", selectedPalet.docId), {
        estado_pedido: "Erróneo",
      });
      setSelectedPalet((prev) => (prev ? { ...prev, status: "Erróneo" } : prev));
      setInventory((prev) => prev.map((p) => (p.docId === selectedPalet.docId ? { ...p, status: "Erróneo" } : p)));
      setInfoMessage("Palet marcado como erróneo");
      addToast({ type: "success", title: "Actualizado", message: "Palet marcado como erróneo" });
    } catch (error) {
      console.error("Error marcando palet erróneo:", error);
      setActionError("No se pudo marcar el palet como erróneo.");
      addToast({ type: "error", title: "Error", message: "No se pudo marcar como erróneo" });
    } finally {
      setSaving(false);
    }
  }, [selectedPalet, addToast]);

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedPalet(null);
    setIsViewMode(false);
  }, []);

  const updateServerFilter = useCallback((key: keyof ServerFilters, value: string) => {
    setServerFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const updateClientFilter = useCallback((key: keyof ClientFilters, value: string) => {
    setClientFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setServerFilters({
      status: "",
      zone: "",
      codificador: "",
      codigo_barra: "",
      numero_linea_pedido: "",
      referencia_linea_pedido: "",
      dateFrom: "",
      dateTo: "",
    });
    setClientFilters({
      client: "",
      type: "",
      widthMin: "",
      widthMax: "",
      heightMin: "",
      heightMax: "",
      thicknessMin: "",
      thicknessMax: "",
    });
    setSearchTerm("");
    setCurrentPage(1);
  }, []);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const search = debouncedSearch.toLowerCase().trim();
      const matchesSearch =
        item.id.toLowerCase().includes(search) ||
        item.client.toLowerCase().includes(search) ||
        item.type.toLowerCase().includes(search) ||
        item.codigo_barra?.toLowerCase().includes(search) ||
        item.codificador?.toLowerCase().includes(search) ||
        item.numero_linea_pedido?.toLowerCase().includes(search) ||
        item.referencia_linea_pedido?.toLowerCase().includes(search);

      const matchesClient =
        debouncedClient === "" ||
        item.client.toLowerCase().includes(debouncedClient.toLowerCase());

      const matchesType =
        debouncedType === "" ||
        item.type.toLowerCase().includes(debouncedType.toLowerCase());

      const { width, height, thickness } = parseDimensions(item.dimensions);
      const matchesWidthMin = clientFilters.widthMin === "" || width >= Number(clientFilters.widthMin);
      const matchesWidthMax = clientFilters.widthMax === "" || width <= Number(clientFilters.widthMax);
      const matchesHeightMin = clientFilters.heightMin === "" || height >= Number(clientFilters.heightMin);
      const matchesHeightMax = clientFilters.heightMax === "" || height <= Number(clientFilters.heightMax);
      const matchesThicknessMin = clientFilters.thicknessMin === "" || thickness >= Number(clientFilters.thicknessMin);
      const matchesThicknessMax = clientFilters.thicknessMax === "" || thickness <= Number(clientFilters.thicknessMax);

      return (
        matchesSearch &&
        matchesClient &&
        matchesType &&
        matchesWidthMin &&
        matchesWidthMax &&
        matchesHeightMin &&
        matchesHeightMax &&
        matchesThicknessMin &&
        matchesThicknessMax
      );
    });
  }, [debouncedSearch, debouncedClient, debouncedType, clientFilters, inventory]);

  const totalPages = Math.max(1, Math.ceil(filteredInventory.length / rowsPerPage));
  
  const paginatedInventory = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredInventory.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredInventory, currentPage, rowsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, debouncedClient, debouncedType]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Columnas de la tabla
  const columns = useMemo<Column<Palet>[]>(() => [
    {
      key: "id",
      header: "ID Palet",
      className: "font-medium",
      width: "120px",
    },
    {
      key: "type",
      header: "Tipo / Dimensiones",
      render: (item) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-200">{item.type}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{item.dimensions} mm</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {item.codigo_barra ? `Código: ${item.codigo_barra}` : "Sin código"}
          </div>
        </div>
      ),
    },
    {
      key: "client",
      header: "Cliente",
      render: (item) => item.client,
    },
    {
      key: "location",
      header: "Ubicación",
      render: (item) => item.location,
    },
    {
      key: "date",
      header: "Fecha",
      align: "right",
      width: "120px",
      render: (item) => <span className="text-xs tabular-nums whitespace-nowrap">{formatDate(item.date)}</span>,
    },
    {
      key: "status",
      header: "Estado",
      align: "center",
      width: "130px",
      render: (item) => (
        <Badge variant={getStatusBadgeVariant(item.status)} size="md">
          {item.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Acciones",
      align: "right",
      width: "100px",
      render: (item) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleViewPalet(item)} aria-label="Ver detalle">
            <Eye size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleEditPalet(item)} aria-label="Editar palet">
            <Edit size={16} />
          </Button>
        </div>
      ),
    },
  ], []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 h-full flex flex-col">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Inventario de Vidrio</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gestión de palets y bloques almacenados.</p>
        </div>
        <Button onClick={handleNewPalet} leftIcon={<Plus size={18} />}>
          Nuevo Palet
        </Button>
      </div>

      {/* CONTENEDOR PRINCIPAL */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* BARRA SUPERIOR DE BÚSQUEDA */}
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              placeholder="Buscar por ID, cliente o tipo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={showFilters ? <ChevronUp size={18} /> : <Filter size={18} />}
          >
            {showFilters ? "Ocultar filtros" : "Filtros Avanzados"}
          </Button>
        </div>

        {/* PANEL DE FILTROS COMPLETOS */}
        {showFilters && (
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              <Input
                label="Cliente"
                placeholder="Ej. Construcciones S.A."
                value={clientFilters.client}
                onChange={(e) => updateClientFilter("client", e.target.value)}
              />
              <Input
                label="Tipo de vidrio"
                placeholder="Ej. Vidrio Templado"
                value={clientFilters.type}
                onChange={(e) => updateClientFilter("type", e.target.value)}
              />
              <Select
                label="Estado"
                options={STATUS_OPTIONS}
                value={serverFilters.status}
                onChange={(e) => updateServerFilter("status", e.target.value)}
              />
              <Input
                label="Zona del almacén"
                placeholder="Ej: A, B, H, D..."
                value={serverFilters.zone}
                onChange={(e) => updateServerFilter("zone", e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Ancho (mm) - Min"
                  type="number"
                  placeholder="Min"
                  value={clientFilters.widthMin}
                  onChange={(e) => updateClientFilter("widthMin", e.target.value)}
                />
                <Input
                  label="Ancho (mm) - Max"
                  type="number"
                  placeholder="Max"
                  value={clientFilters.widthMax}
                  onChange={(e) => updateClientFilter("widthMax", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Alto (mm) - Min"
                  type="number"
                  placeholder="Min"
                  value={clientFilters.heightMin}
                  onChange={(e) => updateClientFilter("heightMin", e.target.value)}
                />
                <Input
                  label="Alto (mm) - Max"
                  type="number"
                  placeholder="Max"
                  value={clientFilters.heightMax}
                  onChange={(e) => updateClientFilter("heightMax", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Grosor (mm) - Min"
                  type="number"
                  placeholder="Min"
                  value={clientFilters.thicknessMin}
                  onChange={(e) => updateClientFilter("thicknessMin", e.target.value)}
                />
                <Input
                  label="Grosor (mm) - Max"
                  type="number"
                  placeholder="Max"
                  value={clientFilters.thicknessMax}
                  onChange={(e) => updateClientFilter("thicknessMax", e.target.value)}
                />
              </div>
              <Input
                label="Fecha desde"
                type="date"
                value={serverFilters.dateFrom}
                onChange={(e) => updateServerFilter("dateFrom", e.target.value)}
              />
              <Input
                label="Fecha hasta"
                type="date"
                value={serverFilters.dateTo}
                onChange={(e) => updateServerFilter("dateTo", e.target.value)}
              />
            </div>

            {hitLimit && (
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg mt-4">
                <AlertCircle size={18} className="text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                    Límite de {MAX_FIRESTORE_RESULTS} resultados alcanzado
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                    Aplica filtros más específicos para ver otros resultados.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            </div>
          </div>
        )}

        {/* TABLA DE RESULTADOS */}
        <div className="overflow-x-auto flex-1 min-h-0">
          <Table
            columns={columns}
            data={paginatedInventory}
            keyExtractor={(item) => item.docId}
            loading={loading}
            emptyMessage="No se han encontrado resultados"
            emptyIcon={<Filter size={24} className="text-slate-400 dark:text-slate-500" />}
            onRowClick={handleViewPalet}
            striped
            hoverable
          />
        </div>

        {/* PIE DE TABLA */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span>Mostrando {filteredInventory.length} resultado{filteredInventory.length !== 1 && "s"}</span>
            <span>• Página {currentPage} de {totalPages}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span>Mostrar</span>
              <Select
                options={ROWS_PER_PAGE_OPTIONS}
                value={String(rowsPerPage)}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="w-auto"
              />
            </label>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage <= 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage >= totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* PANEL LATERAL DE EDICIÓN */}
      <Modal
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
        title={isViewMode ? "Ver Palet" : selectedPalet?.docId ? "Editar Palet" : "Crear Palet"}
        description={selectedPalet?.id || selectedPalet?.docId || "Nuevo palet"}
        size="md"
      >
        {selectedPalet && (
          <div className="space-y-5">
            <Input
              label="Cliente asignado"
              value={selectedPalet.client}
              disabled={isViewMode}
              onChange={(e) => updateSelectedPaletField("client", e.target.value)}
            />
            <Input
              label="Tipo de material"
              value={selectedPalet.type}
              disabled={isViewMode}
              onChange={(e) => updateSelectedPaletField("type", e.target.value)}
            />
            <Input
              label="Código de barras"
              value={selectedPalet.codigo_barra || ""}
              disabled={isViewMode}
              onChange={(e) => updateSelectedPaletField("codigo_barra", e.target.value)}
            />
            <Input
              label="Codificador"
              value={selectedPalet.codificador || ""}
              disabled={isViewMode}
              onChange={(e) => updateSelectedPaletField("codificador", e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Nº de línea"
                value={selectedPalet.numero_linea_pedido}
                disabled={isViewMode}
                onChange={(e) => updateSelectedPaletField("numero_linea_pedido", e.target.value)}
              />
              <Input
                label="Referencia"
                value={selectedPalet.referencia_linea_pedido}
                disabled={isViewMode}
                onChange={(e) => updateSelectedPaletField("referencia_linea_pedido", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Fecha"
                type="date"
                value={selectedPalet.date}
                disabled={isViewMode}
                onChange={(e) => updateSelectedPaletField("date", e.target.value)}
              />
              <Input
                label="Dimensiones"
                value={selectedPalet.dimensions}
                disabled={isViewMode}
                onChange={(e) => updateSelectedPaletField("dimensions", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Ubicación"
                value={selectedPalet.location}
                disabled={isViewMode}
                onChange={(e) => updateSelectedPaletField("location", e.target.value)}
              />
              <Input
                label="Zona"
                value={selectedPalet.zone || ""}
                disabled={isViewMode}
                onChange={(e) => updateSelectedPaletField("zone", e.target.value)}
              />
            </div>
            <Select
              label="Estado del palet"
              options={PALET_STATUS_OPTIONS}
              value={selectedPalet.status}
              onChange={(e) => updateSelectedPaletField("status", e.target.value)}
              disabled={isViewMode}
            />
            {selectedPalet?.docId && (
              <div className="pt-4 mt-6 border-t border-slate-200/80 dark:border-slate-800/80 space-y-3">
                {!isViewMode && (
                  <Button
                    variant="outline"
                    onClick={handleMarkAsErroneous}
                    disabled={saving}
                    leftIcon={<AlertCircle size={18} />}
                    className="w-full"
                  >
                    Marcar como palet erróneo
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => handleCopyId(selectedPalet)}
                  leftIcon={<Copy size={18} />}
                  className="w-full"
                >
                  Copiar ID
                </Button>
              </div>
            )}
          </div>
        )}

        {actionError && (
          <div className="p-4 text-sm text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300" role="alert">
            {actionError}
          </div>
        )}
        {infoMessage && (
          <div className="p-4 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300" role="status">
            {infoMessage}
          </div>
        )}

        <div slot="footer" className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClosePanel}>
            Cancelar
          </Button>
          {!isViewMode && (
            <Button
              onClick={handleSavePalet}
              disabled={saving}
              loading={saving}
            >
              {selectedPalet?.docId ? "Guardar Cambios" : "Crear Palet"}
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}
import { useRef, useCallback, useState, useMemo } from 'react';
import { Download, Check, FileText, ArrowLeft, Euro, CreditCard, Zap, Shield, Truck, Smartphone, Globe, Bell, BarChart3, Code, BookOpen, HeadphonesIcon, DollarSign, Building2, Package, QrCode, Database, RefreshCw, Users, Crown, Rocket, Clock, Server, Lock, GraduationCap, TrendingUp, Mail, Phone, Hash, Settings } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useNavigate } from 'react-router-dom';

// ---- Datos del proveedor y del documento (fuente única) ----
const PROVEEDOR = {
  empresa: 'TriniGlass',
  email: 'rauljayza@gmail.com',
  telefono: '+34 644 932 060',
  web: 'triniglass.app',
};
const VALIDEZ_DIAS = 30;
const IVA_RATE = 0.21; // IVA general España

const allFeatures = [
  { category: 'Núcleo del Sistema', items: [
    'Dashboard ejecutivo con 9 KPIs en tiempo real',
    '6 gráficos interactivos (Recharts): ocupación, distribución, prioridades, tipos de vidrio, entregas, top camiones',
    'Modo oscuro / claro con persistencia',
    'Soporte multidispositivo: desktop, tablet y móvil',
    'PWA instalable con soporte offline',
    'Actualizaciones en tiempo real via Firestore',
  ]},
  { category: 'Gestión de Inventario', items: [
    'Gestión completa de palets con todos los datos',
    'Búsqueda global con autocompletado y debounce',
    'Filtros avanzados: fechas, estados, zona, cliente, tipo de vidrio, dimensiones',
    'Paginación configurable (10/20/50 resultados)',
    'Edición lateral de palets con selector de ubicación',
    'Códigos de barras y referencia de pedido',
  ]},
  { category: 'Mapa Visual del Almacén', items: [
    'Mapa interactivo en canvas con zonas y subzonas',
    'Visualización de ocupación con código de colores',
    'Tarjetas de palet con información completa',
    'Búsqueda visual por posición en el almacén',
    'Panel lateral con detalle completo del palet',
    'Acciones: mover, liberar espacio, eliminar palet',
    'Sistema de coordenadas: zona > subzona > fila > columna',
  ]},
  { category: 'Escáner Móvil QR', items: [
    'Escáner QR / código de barras con cámara en tiempo real',
    'Detección automática de dispositivo móvil',
    'Recomendación automática de ubicación via motor de reglas',
    'Verificación y actualización de ubicación',
    'Estados de palet: encontrado, no encontrado, en tránsito, entregado',
    'Búsqueda difusa con normalización de código',
    'Interfaz optimizada para móvil con botones contextuales',
  ]},
  { category: 'Gestión de Flota de Camiones', items: [
    'Gestión completa de flota con tarjetas visuales',
    'Estados: disponible, en ruta, no disponible, mantenimiento',
    'Filtros por estado, búsqueda por matrícula, conductor y tipo',
    'CRUD completo de camiones',
    'Carga de camiones con drag & drop',
    'Cálculo automático de carga por peso y volumen',
    'Planificación de rutas con paradas múltiples',
    'Confirmación de ruta y estados de entrega',
  ]},
  { category: 'Alertas y Notificaciones', items: [
    'Alertas de prioridad por tiempo en almacén',
    'Alertas de ubicación incorrecta',
    'Filtrado por severidad',
    'Historial completo de alertas',
    'Marcar como resuelto',
    'Contador de alertas en el menú principal',
  ]},
  { category: 'Panel de Administración', items: [
    'Gestión completa de usuarios con 3 roles (operario, encargado, admin)',
    'Creación, edición, activación/desactivación de usuarios',
    'Gestión de zonas y subzonas con capacidades',
    'Editor de reglas de asignación automática',
    'Gestor de diseños de mapa personalizados',
    'Exportación de datos',
  ]},
  { category: 'Motor de Reglas y Automatización', items: [
    'Reglas de asignación con condiciones y acciones',
    'Prioridad ordenable, clonación y eliminación',
    'Modos de aplicación: palets nuevos, existentes o ambos',
    'Asignación automática por cliente, tipo de vidrio, dimensiones',
    'Algoritmo de mejor ubicación por cercanía y agrupación',
    'Regla por defecto y restauración de valores iniciales',
  ]},
];

const packs = [
  {
    id: 'starter',
    name: 'Starter',
    desc: 'Perfecto para pequeñas empresas. App completa con hasta 3 usuarios.',
    icon: Package,
    color: 'emerald',
    monthly: 49,
    annual: 490,
    once: 990,
    maintenance: 198,
    setup: 490,
    includedUsers: 3,
    extraUserPrice: 15,
    support: 'Soporte por email',
    responseTime: '< 24 h laborables',
    sla: '99.5%',
    popular: false,
  },
  {
    id: 'business',
    name: 'Business',
    desc: 'La opción más equilibrada. App completa con hasta 10 usuarios.',
    icon: Building2,
    color: 'blue',
    monthly: 149,
    annual: 1490,
    once: 2990,
    maintenance: 598,
    setup: 990,
    includedUsers: 10,
    extraUserPrice: 12,
    support: 'Soporte email + chat',
    responseTime: '< 8 h laborables',
    sla: '99.9%',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    desc: 'Para empresas en crecimiento. App completa con hasta 25 usuarios.',
    icon: Shield,
    color: 'purple',
    monthly: 399,
    annual: 3990,
    once: 7990,
    maintenance: 1598,
    setup: 1990,
    includedUsers: 25,
    extraUserPrice: 10,
    support: 'Soporte prioritario 24/7',
    responseTime: '< 4 h',
    sla: '99.99%',
    popular: false,
  },
  {
    id: 'unlimited',
    name: 'Ilimitado',
    desc: 'Solución sin límites. App completa con usuarios ilimitados.',
    icon: Crown,
    color: 'orange',
    monthly: 799,
    annual: 7990,
    once: 15990,
    maintenance: 3198,
    setup: 2990,
    includedUsers: null,
    extraUserPrice: null,
    support: 'Soporte dedicado 24/7',
    responseTime: '< 1 h',
    sla: '99.99%',
    popular: false,
  },
];

// ---- Implantación / puesta en marcha (incluida en la cuota de setup de cada plan) ----
const implantacion = [
  { icon: Server, title: 'Configuración e instalación', desc: 'Despliegue del sistema en la nube (Firebase), configuración de dominio, certificados SSL y parámetros iniciales.' },
  { icon: Database, title: 'Migración de datos', desc: 'Importación de tu inventario, zonas, camiones y usuarios actuales desde Excel/CSV o tu sistema previo.' },
  { icon: Settings, title: 'Personalización inicial', desc: 'Carga del mapa del almacén, definición de zonas/subzonas y reglas de asignación según tu operativa real.' },
  { icon: GraduationCap, title: 'Formación del equipo', desc: 'Sesión de onboarding para operarios, encargados y administradores, con material de referencia incluido.' },
];

// ---- Cronograma de implantación ----
const cronograma = [
  { fase: 'Fase 1', title: 'Kick-off y análisis', dur: 'Semana 1', desc: 'Reunión inicial, recogida de requisitos y datos, definición del mapa de almacén.' },
  { fase: 'Fase 2', title: 'Configuración y migración', dur: 'Semanas 2-3', desc: 'Despliegue, importación de datos, configuración de zonas, reglas y usuarios.' },
  { fase: 'Fase 3', title: 'Formación y pruebas', dur: 'Semana 4', desc: 'Formación del equipo, pruebas con datos reales y ajustes finales.' },
  { fase: 'Fase 4', title: 'Puesta en producción', dur: 'Semana 5', desc: 'Arranque en producción con soporte reforzado durante las primeras semanas.' },
];

// ---- Ejemplo económico (plan Business anual + implantación) ----
const ejemploPack = packs.find((p) => p.id === 'business')!;
const ejemploBase = ejemploPack.annual + ejemploPack.setup;
const ejemploIva = Math.round(ejemploBase * IVA_RATE * 100) / 100;
const ejemploTotal = ejemploBase + ejemploIva;
const eur = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---- Seguridad e infraestructura ----
const seguridad = [
  { icon: Lock, title: 'Cifrado y RGPD', desc: 'Datos cifrados en tránsito (HTTPS/TLS) y en reposo. Tratamiento conforme al RGPD, con NDA disponible.' },
  { icon: Server, title: 'Infraestructura cloud', desc: 'Alojado en Google Firebase con alta disponibilidad, escalado automático y replicación de datos.' },
  { icon: RefreshCw, title: 'Copias de seguridad', desc: 'Backups automáticos diarios con retención y posibilidad de restauración punto a punto.' },
  { icon: Shield, title: 'Control de acceso', desc: 'Autenticación segura y permisos por rol (operario, encargado, administrador) para cada función.' },
];

const addons = [
  { name: 'Integración ERP (SAP, Odoo, etc.)', desc: 'Conexión bidireccional con los principales ERPs del mercado para sincronizar inventario, pedidos y clientes.', icon: Database, once: 2490, monthly: 99 },
  { name: 'App Android / iOS nativa', desc: 'Versión nativa para Google Play y App Store con todas las funcionalidades, rendimiento óptimo y acceso al hardware del dispositivo.', icon: Smartphone, once: 4990, monthly: 199 },
  { name: 'GPS Tracking en tiempo real', desc: 'Seguimiento GPS de camiones en ruta con geocercas, historial de rutas y tiempo estimado de llegada.', icon: Truck, once: 990, monthly: 49 },
  { name: 'Módulo de facturación', desc: 'Generación automática de facturas, albaranes y documentos fiscales desde la app.', icon: FileText, once: 1490, monthly: 69 },
  { name: 'API pública REST', desc: 'Acceso a API documentada para integraciones de terceros, webhooks y automatizaciones personalizadas.', icon: Code, once: 990, monthly: 49 },
  { name: 'Informes PDF avanzados', desc: 'Reportes personalizados exportables con gráficos, filtros y programación de informes.', icon: BarChart3, once: 490, monthly: 29 },
  { name: 'Notificaciones Push', desc: 'Notificaciones push en tiempo real para alertas, cambios de estado y eventos importantes.', icon: Bell, once: 290, monthly: 19 },
  { name: 'Multi-idioma (EN, FR, PT)', desc: 'Soporte multilingüe completo con inglés, francés y portugués además del español.', icon: Globe, once: 1490, monthly: 59 },
  { name: 'Branding / Whitelabel', desc: 'Personalización completa con tu logo, colores corporativos, dominio propio y eliminación de marcas.', icon: Zap, once: 990, monthly: 39 },
  { name: 'Soporte Premium 24/7', desc: 'Atención telefónica y chat dedicado con tiempo de respuesta inferior a 1 hora.', icon: HeadphonesIcon, once: null, monthly: 199 },
  { name: 'Capacitación presencial', desc: 'Formación in-situ para todo tu equipo con material didáctico y seguimiento.', icon: BookOpen, once: 990, monthly: null },
  { name: 'Scanner por lotes', desc: 'Escaneo masivo de palets para inventarios rápidos y carga/descarga exprés.', icon: QrCode, once: 490, monthly: 29 },
];

const paymentDescriptions = [
  { label: 'Pago Mensual', desc: 'Sin permanencia. Cancela cuando quieras. Ideal para empezar sin compromiso.', icon: CreditCard },
  { label: 'Pago Anual', desc: 'Ahorra el equivalente a 2 meses. Facturación anual con el mismo servicio.', icon: CalendarIcon },
  { label: 'Pago Único', desc: 'Licencia perpetua. Pagas una vez y usas para siempre. Incluye el primer año de actualizaciones.', icon: DollarSign },
  { label: 'Único + Mantenimiento', desc: 'Pago único + 20% anual para soporte prioritario, actualizaciones y asistencia técnica.', icon: RefreshCw },
];

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'popular' }) {
  const colors = {
    default: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    popular: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}

function PlanCard({ pack }: { pack: typeof packs[0] }) {
  const colorMap: Record<string, { bg: string; text: string; border: string; ring: string }> = {
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/50', ring: 'ring-emerald-500' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800/50', ring: 'ring-blue-500' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800/50', ring: 'ring-purple-500' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800/50', ring: 'ring-orange-500' },
  };
  const c = colorMap[pack.color];

  return (
    <div
      id={`plan-${pack.id}`}
      className={`relative flex flex-col rounded-2xl border-2 ${
        pack.popular ? 'border-blue-400 dark:border-blue-500 shadow-xl shadow-blue-500/10 dark:shadow-blue-500/5' : 'border-slate-200 dark:border-slate-800'
      } bg-white dark:bg-slate-900 overflow-hidden transition-all duration-200 hover:shadow-lg`}
    >
      {pack.popular && (
        <div className="absolute top-0 inset-x-0">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-semibold text-center py-1.5 tracking-wide">
            MÁS POPULAR
          </div>
        </div>
      )}

      <div className={`p-6 ${pack.popular ? 'pt-10' : ''}`}>
        <div className={`w-12 h-12 ${c.bg} rounded-xl flex items-center justify-center mb-4`}>
          <pack.icon className={`w-6 h-6 ${c.text}`} />
        </div>

        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{pack.name}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 mb-4">{pack.desc}</p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          <Badge>{pack.includedUsers !== null ? `Hasta ${pack.includedUsers} usuarios` : 'Usuarios ilimitados'}</Badge>
          <Badge>{pack.support}</Badge>
        </div>

        <div className="space-y-3 mb-6">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{pack.monthly} €</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">/mes</span>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">{pack.annual} €</span>/año (ahorras {pack.monthly * 2} €)
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">{pack.once} €</span> pago único
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">{pack.maintenance} €</span>/año mantenimiento
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">+{pack.setup} €</span> implantación (única)
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mb-4 text-xs">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Server size={13} className={`${c.text} shrink-0`} />
            <span>SLA garantizado <strong className="text-slate-900 dark:text-white">{pack.sla}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Clock size={13} className={`${c.text} shrink-0`} />
            <span>Respuesta soporte <strong className="text-slate-900 dark:text-white">{pack.responseTime}</strong></span>
          </div>
        </div>

        {pack.extraUserPrice !== null && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800/50 rounded-lg px-4 py-2.5 mb-4">
            <p className="text-xs text-amber-800 dark:text-amber-200">
              <strong>Usuario adicional:</strong> +{pack.extraUserPrice} €/usuario/mes
            </p>
          </div>
        )}
      </div>

      <div className="px-6 pb-6 mt-auto">
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">App completa incluida</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Check size={14} className="text-emerald-500 shrink-0" />
              <span className="text-xs text-slate-600 dark:text-slate-300">Todas las funcionalidades</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check size={14} className="text-emerald-500 shrink-0" />
              <span className="text-xs text-slate-600 dark:text-slate-300">Sin limitaciones de características</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Check size={14} className="text-emerald-500 shrink-0" />
              <span className="text-xs text-slate-600 dark:text-slate-300">Actualizaciones incluidas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Presupuesto() {
  const navigate = useNavigate();
  const pdfRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');

  // Nº de presupuesto y fechas derivadas (fuente única, estable por render)
  const docInfo = useMemo(() => {
    const now = new Date();
    const validez = new Date(now);
    validez.setDate(validez.getDate() + VALIDEZ_DIAS);
    const num = `${PROVEEDOR.empresa.slice(0, 2).toUpperCase()}-${now.getFullYear()}-${String(
      Math.floor((now.getTime() / 1000) % 100000),
    ).padStart(5, '0')}`;
    const fmt = (d: Date) => d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    return { num, fecha: fmt(now), validez: fmt(validez) };
  }, []);

  const generatePDF = useCallback(async () => {
    if (!pdfRef.current) return;
    setGenerating(true);
    setProgress('Preparando documento...');

    // Forzar tema claro durante la captura para que el PDF sea siempre legible
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    if (wasDark) root.classList.remove('dark');

    try {
      const element = pdfRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: element.scrollWidth,
        height: element.scrollHeight,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      setProgress('Generando PDF...');
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = 297;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`${docInfo.num}-Presupuesto-TriniGlassV2.pdf`);
      setProgress('¡PDF descargado!');
    } catch (err) {
      console.error('Error generating PDF:', err);
      setProgress('Error al generar PDF');
    } finally {
      if (wasDark) root.classList.add('dark');
    }

    setTimeout(() => {
      setGenerating(false);
      setProgress('');
    }, 1500);
  }, [docInfo.num]);

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => void navigate(-1)}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              <ArrowLeft size={16} />
              Volver
            </button>
            <button
              onClick={() => void generatePDF()}
              disabled={generating}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200 ${
                generating
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-brand-600 hover:bg-brand-700 active:scale-95 shadow-sm hover:shadow-md'
              }`}
            >
              <Download size={16} className={generating ? 'animate-bounce' : ''} />
              {generating ? progress : 'Descargar PDF'}
            </button>
          </div>
        </div>
      </div>

      <div ref={pdfRef} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Portada */}
        <div className="text-center mb-10 pt-8 pb-10 border-b border-slate-200 dark:border-slate-800">
          <div className="w-20 h-20 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-brand-500/20">
            <span className="text-white text-2xl font-bold">TG</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
            TriniGlass <span className="text-brand-600">V2</span>
          </h1>
          <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
            Sistema integral de gestión de almacén y flota de camiones
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-sm text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1.5"><FileText size={14} /> Presupuesto comercial</span>
            <span className="flex items-center gap-1.5"><RefreshCw size={14} /> Validez: {VALIDEZ_DIAS} días</span>
            <span className="flex items-center gap-1.5">v2.0</span>
          </div>
        </div>

        {/* Datos del presupuesto: proveedor / cliente */}
        <div className="mb-16 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Presupuesto para</p>
            <div className="space-y-1.5 text-sm">
              <p className="font-semibold text-slate-900 dark:text-white">[ Nombre de la empresa ]</p>
              <p className="text-slate-500 dark:text-slate-400">[ Persona de contacto ]</p>
              <p className="text-slate-500 dark:text-slate-400">[ CIF · Dirección ]</p>
              <p className="text-slate-500 dark:text-slate-400">[ Email · Teléfono ]</p>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Datos del presupuesto</p>
            <div className="space-y-1.5 text-sm">
              <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><Hash size={14} className="text-brand-600 shrink-0" /> Nº <strong className="text-slate-900 dark:text-white">{docInfo.num}</strong></p>
              <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><CalendarIcon className="w-3.5 h-3.5 text-brand-600 shrink-0" /> Emisión: {docInfo.fecha}</p>
              <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><Clock size={14} className="text-brand-600 shrink-0" /> Válido hasta: {docInfo.validez}</p>
              <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><Building2 size={14} className="text-brand-600 shrink-0" /> Proveedor: <strong className="text-slate-900 dark:text-white">{PROVEEDOR.empresa}</strong></p>
            </div>
          </div>
        </div>

        {/* Resumen ejecutivo */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Resumen Ejecutivo</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
            TriniGlass V2 es una aplicación web progresiva (PWA) moderna y completa para la gestión integral de almacenes
            de vidrio y flotas de camiones. Desarrollada con <strong>React 19, TypeScript y Firebase</strong>, ofrece
            una experiencia de usuario rápida, intuitiva y accesible desde cualquier dispositivo.
          </p>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
            El sistema incluye dashboard ejecutivo con KPIs y gráficos en tiempo real, mapa visual interactivo del almacén,
            escáner QR para móvil, gestión completa de flota de camiones con planificación de rutas, motor de reglas de
            asignación automática, sistema de alertas, panel de administración con gestión de usuarios, roles y mucho más.
          </p>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Todos los planes incluyen <strong>la aplicación completa sin limitaciones de funcionalidad</strong>.
            La diferencia entre planes es el número de licencias de usuario incluidas y el nivel de soporte.
            Se pueden añadir usuarios adicionales en cualquier momento.
          </p>
        </div>

        {/* Planes de precios */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-brand-50 dark:bg-brand-500/10 p-2.5 rounded-lg">
              <Euro className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Planes de Precios</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Todos los planes incluyen la aplicación completa. Solo cambian las licencias de usuario y el soporte.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {packs.map((pack) => (
              <PlanCard key={pack.id} pack={pack} />
            ))}
          </div>
        </div>

        {/* Lista completa de características */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-lg">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Funcionalidades Incluidas en Todos los Planes</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">La aplicación se entrega completa sin limitaciones de características</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {allFeatures.map((section) => (
              <div
                key={section.category}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"
              >
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-3">{section.category}</h3>
                <div className="space-y-2">
                  {section.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-600 dark:text-slate-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sección de licencias de usuario */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-lg">
              <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Licencias de Usuario</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Añade usuarios adicionales a tu plan en cualquier momento</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">Plan</th>
                  <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">Usuarios incluidos</th>
                  <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">Precio usuario adicional</th>
                  <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">Ejemplo: 5 usuarios extra</th>
                </tr>
              </thead>
              <tbody>
                {packs.map((pack) => {
                  const extraTotal = pack.extraUserPrice !== null ? pack.extraUserPrice * 5 : '—';
                  return (
                    <tr key={pack.id} className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${pack.popular ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}>
                      <td className="py-4 px-4">
                        <span className="font-medium text-slate-900 dark:text-white">{pack.name}</span>
                        {pack.popular && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-medium">★ Popular</span>}
                      </td>
                      <td className="text-center py-4 px-4 text-slate-700 dark:text-slate-300">
                        {pack.includedUsers !== null ? `${pack.includedUsers} usuarios` : 'Ilimitados'}
                      </td>
                      <td className="text-center py-4 px-4 font-semibold text-slate-900 dark:text-white">
                        {pack.extraUserPrice !== null ? `${pack.extraUserPrice} €/usuario/mes` : '—'}
                      </td>
                      <td className="text-center py-4 px-4 text-slate-700 dark:text-slate-300">
                        {typeof extraTotal === 'number' ? `+${extraTotal} €/mes` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800/50 rounded-xl">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>🔑 Ejemplo práctico:</strong> Si contratas el plan Business (149 €/mes con 10 usuarios incluidos)
              y necesitas 3 usuarios adicionales, pagarías <strong>149 € + (3 × 12 €) = 185 €/mes</strong>.
              Si luego necesitas más, añades los que quieras sin permanencia.
            </p>
          </div>
        </div>

        {/* Modalidades de pago */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-lg">
              <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Modalidades de Pago</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Elige la forma de pago que mejor se adapte a tu negocio</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {paymentDescriptions.map((p, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center mb-3">
                  <p.icon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">{p.label}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>

          {/* Tabla comparativa */}
          <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">Plan</th>
                  <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">Mensual</th>
                  <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">Anual</th>
                  <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">Pago Único</th>
                  <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">Único + Mantenimiento/año</th>
                  <th className="text-center py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">Implantación</th>
                </tr>
              </thead>
              <tbody>
                {packs.map((pack) => (
                  <tr key={pack.id} className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${pack.popular ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''}`}>
                    <td className="py-4 px-4">
                      <span className="font-medium text-slate-900 dark:text-white">{pack.name}</span>
                      {pack.popular && <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-medium">★ Popular</span>}
                    </td>
                    <td className="text-center py-4 px-4 font-semibold text-slate-900 dark:text-white">{pack.monthly} €/mes</td>
                    <td className="text-center py-4 px-4 font-semibold text-emerald-600">{pack.annual} €/año</td>
                    <td className="text-center py-4 px-4 font-semibold text-slate-900 dark:text-white">{pack.once} €</td>
                    <td className="text-center py-4 px-4 text-slate-700 dark:text-slate-300">{pack.once} € + {pack.maintenance} €/año</td>
                    <td className="text-center py-4 px-4 text-slate-700 dark:text-slate-300">{pack.setup} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-800/50 rounded-xl">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>💡 Ahorro anual:</strong> Los planes anuales incluyen 2 meses gratis respecto al pago mensual.
              El pago único incluye el primer año de actualizaciones y soporte. El mantenimiento anual (20% del pago único)
              cubre soporte prioritario, actualizaciones mayores y asistencia técnica continua.
            </p>
          </div>

          {/* Resumen económico de ejemplo con IVA */}
          <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              <h3 className="font-bold text-slate-900 dark:text-white">Resumen económico de ejemplo</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Plan <strong>{ejemploPack.name}</strong> en modalidad anual, con implantación incluida — primer año.
            </p>
            <div className="max-w-md ml-auto space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Suscripción anual {ejemploPack.name}</span>
                <span>{eur(ejemploPack.annual)} €</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Implantación y puesta en marcha</span>
                <span>{eur(ejemploPack.setup)} €</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5 text-slate-700 dark:text-slate-200 font-medium">
                <span>Base imponible</span>
                <span>{eur(ejemploBase)} €</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>IVA (21%)</span>
                <span>{eur(ejemploIva)} €</span>
              </div>
              <div className="flex justify-between border-t-2 border-slate-200 dark:border-slate-700 pt-2.5 text-lg font-bold text-slate-900 dark:text-white">
                <span>Total primer año</span>
                <span>{eur(ejemploTotal)} €</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
              A partir del segundo año solo se renueva la suscripción anual ({eur(ejemploPack.annual)} € + IVA). Ejemplo orientativo; el total final depende del plan, usuarios adicionales y add-ons contratados.
            </p>
          </div>
        </div>

        {/* Implantación y puesta en marcha */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-brand-50 dark:bg-brand-500/10 p-2.5 rounded-lg">
              <Rocket className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Implantación y Puesta en Marcha</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Incluida en la cuota de implantación de cada plan. Nos encargamos de todo para que arranques sin fricción.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {implantacion.map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <div className="w-10 h-10 bg-brand-50 dark:bg-brand-500/10 rounded-lg flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Cronograma */}
          <h3 className="font-semibold text-slate-900 dark:text-white mt-8 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-brand-600 dark:text-brand-400" /> Cronograma estimado: ~5 semanas
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cronograma.map((c, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">{c.fase}</span>
                <h4 className="font-semibold text-slate-900 dark:text-white text-sm mt-1">{c.title}</h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{c.dur}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Seguridad e infraestructura */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-lg">
              <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Seguridad e Infraestructura</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Tus datos protegidos y disponibles, con cumplimiento normativo.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {seguridad.map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                  <item.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add-ons */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-purple-50 dark:bg-purple-500/10 p-2.5 rounded-lg">
              <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Mejoras Opcionales (Add-ons)</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Funcionalidades adicionales que se pueden añadir a cualquier plan</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {addons.map((addon, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors group">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-50 dark:bg-purple-500/10 rounded-lg flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <addon.icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{addon.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{addon.desc}</p>
                    <div className="flex items-center gap-3 mt-3">
                      {addon.once !== null && (
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{addon.once.toLocaleString()} € <span className="text-xs font-normal text-slate-400">una vez</span></span>
                      )}
                      {addon.monthly !== null && (
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{addon.monthly} € <span className="text-xs font-normal text-slate-400">/mes</span></span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Términos */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg">
              <FileText className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Términos y Condiciones</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: 'Licencia de uso', desc: 'El software se concede en licencia de uso. No se transfiere la propiedad intelectual. El código fuente permanece como propiedad del desarrollador.' },
              { title: 'Licencias de usuario', desc: 'Cada plan incluye un número determinado de usuarios. Los usuarios adicionales se facturan mensualmente según la tarifa del plan contratado. Se pueden añadir o eliminar en cualquier momento.' },
              { title: 'Actualizaciones', desc: 'Los planes mensuales y anuales incluyen todas las actualizaciones durante el período de suscripción. El pago único incluye 1 año de actualizaciones.' },
              { title: 'Soporte técnico', desc: 'El nivel de soporte varía según el plan. El soporte por email tiene un tiempo de respuesta máximo de 24h laborables. El soporte premium 24/7 responde en menos de 1h.' },
              { title: 'Cancelación', desc: 'Los planes mensuales y anuales pueden cancelarse en cualquier momento. No se realizan reembolsos parciales en planes anuales ya facturados.' },
              { title: 'Garantía', desc: 'Los planes anuales y de pago único incluyen una garantía de satisfacción de 30 días con reembolso completo.' },
              { title: 'Confidencialidad', desc: 'Todos los datos del cliente se tratan con absoluta confidencialidad. Se firmará NDA si es necesario. Cumplimiento con RGPD.' },
              { title: 'Personalización', desc: 'Las modificaciones y personalizaciones no incluidas en el plan contratado se facturarán como mejoras opcionales (add-ons).' },
            ].map((term, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">{term.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{term.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contacto */}
        <div className="mb-16 bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-8 sm:p-12 text-center text-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">¿Listo para empezar?</h2>
          <p className="text-brand-100 max-w-xl mx-auto mb-6">
            Solicita una demo gratuita de 14 días sin compromiso. Te ayudaremos a configurar TriniGlass V2
            para tu negocio y resolveremos todas tus dudas.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2.5">
              <Mail size={15} className="opacity-80" /> <strong>{PROVEEDOR.email}</strong>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2.5">
              <Phone size={15} className="opacity-80" /> <strong>{PROVEEDOR.telefono}</strong>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2.5">
              <Globe size={15} className="opacity-80" /> <strong>{PROVEEDOR.web}</strong>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-6 pb-12 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            TriniGlass V2 — Presupuesto {docInfo.num}, emitido el {docInfo.fecha}.
            Todos los precios se expresan sin IVA salvo donde se indique. Válido hasta el {docInfo.validez}.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Este documento es confidencial y está dirigido exclusivamente al destinatario.
          </p>
        </div>
      </div>
    </div>
  );
}

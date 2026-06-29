import {
  Package,
  BoxIcon,
  Warehouse as WarehouseIcon,
  Clock,
  AlertTriangle,
  Weight,
  Layers,
  Truck,
  Route,
  PackageCheck,
  Gauge as GaugeIcon,
  Timer,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useMemo } from 'react';
import { KpiCard } from './ui/KpiCard';
import { useWarehouseStats } from '../hooks/useWarehouseStats';
import { useFleetStats } from '../hooks/useFleetStats';

const CHART_COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Resumen() {
  const { stats, loading, error } = useWarehouseStats();
  const { stats: fleet, loading: fleetLoading, error: fleetError } = useFleetStats();

  // Datos para gráfico de barras (ocupación por zona)
  const barChartData = useMemo(() => stats?.zonas.map(zona => ({
    name: zona.zoneName,
    ocupados: zona.occupied,
    libres: Math.max(0, zona.total - zona.occupied),
    total: zona.total,
  })) ?? [], [stats]);

  // Datos para gráfico circular (distribución de ocupación)
  const pieChartData = useMemo(() => stats?.zonas
    .filter(zona => zona.occupied > 0)
    .map(zona => ({
      name: zona.zoneName,
      value: zona.occupied,
    })) ?? [], [stats]);

  // Datos para gráfico de prioridades
  const priorityData = useMemo(() => stats ? [
    { name: 'Alta', value: stats.prioridadAlta, color: '#ef4444' },
    { name: 'Media', value: stats.prioridadMedia, color: '#f59e0b' },
    { name: 'Normal', value: stats.prioridadNormal, color: '#10b981' },
  ].filter(d => d.value > 0) : [], [stats]);

  // Datos para gráfico de tipos de vidrio
  const glassTypeData = useMemo(() => stats ? [
    { name: 'Vidrio Simple', value: stats.vidrioSimple, color: '#06b6d4' },
    { name: 'Doble Acristalamiento', value: stats.dobleAcristalamiento, color: '#8b5cf6' },
  ].filter(d => d.value > 0) : [], [stats]);

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  const chartCardClass = "bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800/80 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150";

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-500 to-brand-300 dark:from-brand-400 dark:to-brand-600 rounded-full" />
        <div className="pl-4">
          <h1 className="text-2xl font-bold tracking-tight mb-1">
            <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">Panel de Control</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Resumen del estado actual del almacén y flota
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Palets Ocupados"
          value={stats?.paletsOcupados ?? '-'}
          subtitle={`de ${stats?.totalPalets ?? '-'} disponibles`}
          icon={<Package className="w-5 h-5" />}
          color="cyan"
          loading={loading}
        />
        <KpiCard
          title="Palets Libres"
          value={stats?.paletsLibres ?? '-'}
          subtitle={`${stats?.ocupacionPorcentaje ?? 0}% de ocupación`}
          icon={<BoxIcon className="w-5 h-5" />}
          color="green"
          loading={loading}
        />
        <KpiCard
          title="Días Promedio"
          value={stats?.diasPromedioAlmacen ?? '-'}
          subtitle="en almacén"
          icon={<Clock className="w-5 h-5" />}
          color="amber"
          loading={loading}
        />
        <KpiCard
          title="Prioridad Alta"
          value={stats?.prioridadAlta ?? '-'}
          subtitle="más de 30 días"
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
          loading={loading}
        />
      </div>

      {/* Segunda fila de KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          title="Peso Total"
          value={`${stats?.pesoTotalKg?.toLocaleString('es-ES') ?? '-'} kg`}
          subtitle="en el almacén"
          icon={<Weight className="w-5 h-5" />}
          color="purple"
          loading={loading}
        />
        <KpiCard
          title="Vidrio Simple"
          value={stats?.vidrioSimple ?? '-'}
          subtitle="unidades"
          icon={<Layers className="w-5 h-5" />}
          color="cyan"
          loading={loading}
        />
        <KpiCard
          title="Doble Acristalamiento"
          value={stats?.dobleAcristalamiento ?? '-'}
          subtitle="unidades"
          icon={<WarehouseIcon className="w-5 h-5" />}
          color="blue"
          loading={loading}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de barras - Ocupación por zona */}
        <div className={chartCardClass}>
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white mb-4">
            Ocupación por Zona
          </h3>
          {loading ? (
            <div className="h-[300px] animate-shimmer rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="ocupados" name="Ocupados" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="libres" name="Libres" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Gráfico circular - Distribución por zona */}
        <div className={chartCardClass}>
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white mb-4">
            Distribución de Palets
          </h3>
          {loading ? (
            <div className="h-[300px] animate-shimmer rounded-lg" />
          ) : pieChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent = 0 }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieChartData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500 dark:text-slate-400">
              No hay datos disponibles
            </div>
          )}
        </div>
      </div>

      {/* Segunda fila de gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de prioridades */}
        <div className={chartCardClass}>
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white mb-4">
            Distribución por Prioridad
          </h3>
          {loading ? (
            <div className="h-[250px] animate-shimmer rounded-lg" />
          ) : priorityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={priorityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {priorityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-500 dark:text-slate-400">
              No hay datos disponibles
            </div>
          )}
        </div>

        {/* Gráfico de tipos de vidrio */}
        <div className={chartCardClass}>
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white mb-4">
            Tipos de Vidrio
          </h3>
          {loading ? (
            <div className="h-[250px] animate-shimmer rounded-lg" />
          ) : glassTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={glassTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {glassTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-slate-500 dark:text-slate-400">
              No hay datos disponibles
            </div>
          )}
        </div>
      </div>

      {/* Sección Flota */}
      <div className="relative pt-4">
        <div className="absolute left-0 top-4 bottom-0 w-1 bg-gradient-to-b from-brand-500 to-brand-300 dark:from-brand-400 dark:to-brand-600 rounded-full" />
        <div className="pl-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 mb-1">
            <Truck className="w-5 h-5 text-brand-500" />
            Gestión de flota
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Camiones, rutas y entregas en vivo
          </p>
        </div>
      </div>

      {fleetError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>{fleetError}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Camiones disponibles"
          value={fleet?.camionesDisponibles ?? '-'}
          subtitle={`de ${fleet?.totalCamiones ?? '-'} en flota`}
          icon={<Truck className="w-5 h-5" />}
          color="green"
          loading={fleetLoading}
        />
        <KpiCard
          title="En ruta"
          value={fleet?.camionesEnRuta ?? '-'}
          subtitle={`${fleet?.rutasEnCurso ?? 0} ruta${fleet?.rutasEnCurso === 1 ? '' : 's'} en curso`}
          icon={<Route className="w-5 h-5" />}
          color="blue"
          loading={fleetLoading}
        />
        <KpiCard
          title="No disponibles"
          value={fleet?.camionesNoDisponibles ?? '-'}
          subtitle={`${fleet?.camionesMantenimiento ?? 0} en mantenimiento`}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
          loading={fleetLoading}
        />
        <KpiCard
          title="Palets en carga"
          value={fleet?.paletsEnCarga ?? '-'}
          subtitle="cargados pendientes de salida"
          icon={<Package className="w-5 h-5" />}
          color="amber"
          loading={fleetLoading}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Entregados hoy"
          value={fleet?.paletsEntregadosHoy ?? '-'}
          subtitle={`${fleet?.paletsEntregadosUltimos7Dias ?? 0} en los últimos 7 días`}
          icon={<PackageCheck className="w-5 h-5" />}
          color="cyan"
          loading={fleetLoading}
        />
        <KpiCard
          title="Rutas finalizadas"
          value={fleet?.rutasFinalizadasUltimos7Dias ?? '-'}
          subtitle={`últimos 7 días · ${fleet?.rutasFinalizadasTotal ?? 0} total`}
          icon={<Route className="w-5 h-5" />}
          color="purple"
          loading={fleetLoading}
        />
        <KpiCard
          title="Duración media de ruta"
          value={
            fleet
              ? fleet.duracionMediaMinutos > 0
                ? `${fleet.duracionMediaMinutos} min`
                : '-'
              : '-'
          }
          subtitle="rutas finalizadas"
          icon={<Timer className="w-5 h-5" />}
          color="amber"
          loading={fleetLoading}
        />
        <KpiCard
          title="Utilización media"
          value={
            fleet && fleet.utilizacionMediaPesoPct > 0
              ? `${fleet.utilizacionMediaPesoPct}%`
              : '-'
          }
          subtitle="peso medio sobre capacidad"
          icon={<GaugeIcon className="w-5 h-5" />}
          color="blue"
          loading={fleetLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entregas por día (últimos 7 días) */}
        <div className={chartCardClass}>
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white mb-4">
            Entregas por día (últimos 7 días)
          </h3>
          {fleetLoading ? (
            <div className="h-65 animate-shimmer rounded-lg" />
          ) : fleet && fleet.entregasPorDia.some(d => d.entregas > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={fleet.entregasPorDia} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="entregas" name="Palets entregados" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-65 flex items-center justify-center text-slate-500 dark:text-slate-400">
              Sin entregas en los últimos 7 días
            </div>
          )}
        </div>

        {/* Top camiones por entregas */}
        <div className={chartCardClass}>
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white mb-4">
            Camiones con más entregas
          </h3>
          {fleetLoading ? (
            <div className="h-65 animate-shimmer rounded-lg" />
          ) : fleet && fleet.topCamiones.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={fleet.topCamiones}
                layout="vertical"
                margin={{ top: 10, right: 10, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis type="number" allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis dataKey="matricula" type="category" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Bar dataKey="entregas" name="Palets entregados" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-65 flex items-center justify-center text-slate-500 dark:text-slate-400">
              Aún no hay entregas registradas
            </div>
          )}
        </div>
      </div>

      {/* Tabla de resumen por zonas */}
      <div className={chartCardClass}>
        <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white mb-4">
          Estado por Zona
        </h3>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-12 animate-shimmer rounded-md" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800/80">
                  <th className="text-left py-2.5 px-5 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Zona
                  </th>
                  <th className="text-center py-2.5 px-4 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Ocupados
                  </th>
                  <th className="text-center py-2.5 px-4 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Capacidad
                  </th>
                  <th className="text-center py-2.5 px-4 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Ocupación
                  </th>
                  <th className="text-left py-2.5 px-5 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {stats?.zonas.map((zona) => {
                  const statusColor =
                    zona.percentage >= 90
                      ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                      : zona.percentage >= 70
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400';

                  const statusText =
                    zona.percentage >= 90
                      ? 'Crítico'
                      : zona.percentage >= 70
                      ? 'Alto'
                      : 'Normal';

                  return (
                    <tr key={zona.zoneId}>
                      <td className="py-3 px-5 font-medium text-slate-900 dark:text-white">
                        {zona.zoneName}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-700 dark:text-slate-300 tabular-nums">
                        {zona.occupied}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-700 dark:text-slate-300 tabular-nums">
                        {zona.total}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                zona.percentage >= 90
                                  ? 'bg-red-500'
                                  : zona.percentage >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${zona.percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums w-9 text-right">
                            {zona.percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${statusColor}`}>
                          {statusText}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

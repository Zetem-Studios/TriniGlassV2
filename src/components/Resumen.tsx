import {
  Package,
  BoxIcon,
  Warehouse as WarehouseIcon,
  Clock,
  AlertTriangle,
  Weight,
  Layers,
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
import KpiCard from './KpiCard';
import { useWarehouseStats } from '../useWarehouseStats';

const CHART_COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Resumen() {
  const { stats, loading, error } = useWarehouseStats();

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

  // Datos para gráfico de barras (ocupación por zona)
  const barChartData = stats?.zonas.map(zona => ({
    name: zona.zoneName,
    ocupados: zona.occupied,
    libres: Math.max(0, zona.total - zona.occupied),
    total: zona.total,
  })) || [];

  // Datos para gráfico circular (distribución de ocupación)
  const pieChartData = stats?.zonas
    .filter(zona => zona.occupied > 0)
    .map(zona => ({
      name: zona.zoneName,
      value: zona.occupied,
    })) || [];

  // Datos para gráfico de prioridades
  const priorityData = stats ? [
    { name: 'Alta', value: stats.prioridadAlta, color: '#ef4444' },
    { name: 'Media', value: stats.prioridadMedia, color: '#f59e0b' },
    { name: 'Normal', value: stats.prioridadNormal, color: '#10b981' },
  ].filter(d => d.value > 0) : [];

  // Datos para gráfico de tipos de vidrio
  const glassTypeData = stats ? [
    { name: 'Vidrio Simple', value: stats.vidrioSimple, color: '#06b6d4' },
    { name: 'Doble Acristalamiento', value: stats.dobleAcristalamiento, color: '#8b5cf6' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Panel de Control
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Resumen del estado actual del almacén
        </p>
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Ocupación por Zona
          </h3>
          {loading ? (
            <div className="h-[300px] animate-pulse bg-slate-100 dark:bg-slate-700 rounded-xl" />
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Distribución de Palets
          </h3>
          {loading ? (
            <div className="h-[300px] animate-pulse bg-slate-100 dark:bg-slate-700 rounded-xl" />
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
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Distribución por Prioridad
          </h3>
          {loading ? (
            <div className="h-[250px] animate-pulse bg-slate-100 dark:bg-slate-700 rounded-xl" />
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Tipos de Vidrio
          </h3>
          {loading ? (
            <div className="h-[250px] animate-pulse bg-slate-100 dark:bg-slate-700 rounded-xl" />
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

      {/* Tabla de resumen por zonas */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Estado por Zona
        </h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-12 animate-pulse bg-slate-100 dark:bg-slate-700 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Zona
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Ocupados
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Capacidad
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Ocupación
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats?.zonas.map((zona, index) => {
                  const statusColor =
                    zona.percentage >= 90
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : zona.percentage >= 70
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';

                  const statusText =
                    zona.percentage >= 90
                      ? 'Crítico'
                      : zona.percentage >= 70
                      ? 'Alto'
                      : 'Normal';

                  return (
                    <tr
                      key={zona.zoneId}
                      className={`border-b border-slate-100 dark:border-slate-700/50 ${
                        index % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-800/50' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        {zona.zoneName}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-700 dark:text-slate-300">
                        {zona.occupied}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-700 dark:text-slate-300">
                        {zona.total}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
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
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {zona.percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}>
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

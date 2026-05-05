import React, { useState } from 'react';
import Warehouse from './Warehouse';
import Warehouse2 from './Warehouse2';
import WarehouseComparison from './WarehouseComparison';
import { 
  Home, 
  Layers, 
  Settings, 
  GitBranch, 
  BarChart3,
  Eye,
  Code
} from 'lucide-react';

type ViewMode = 'warehouse' | 'warehouse2' | 'comparison';

export default function AppWithNavigation() {
  const [currentView, setCurrentView] = useState<ViewMode>('warehouse');

  const renderContent = () => {
    switch (currentView) {
      case 'warehouse':
        return <Warehouse />;
      case 'warehouse2':
        return <Warehouse2 />;
      case 'comparison':
        return <WarehouseComparison />;
      default:
        return <Warehouse />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con Navegación */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo y Título */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">TG</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">TriniGlass</h1>
                  <p className="text-sm text-gray-500">Sistema de Gestión de Almacén</p>
                </div>
              </div>
            </div>

            {/* Navegación Principal */}
            <nav className="flex space-x-1">
              {/* Selector de Componentes */}
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg px-3 py-2">
                <Layers className="w-4 h-4 text-gray-600" />
                <select 
                  value={currentView} 
                  onChange={(e) => setCurrentView(e.target.value as ViewMode)}
                  className="bg-transparent border-none text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                >
                  <option value="warehouse">Warehouse Original</option>
                  <option value="warehouse2">Warehouse 2.0 (Dinámico)</option>
                  <option value="comparison">Comparación</option>
                </select>
              </div>

              {/* Separador */}
              <div className="h-6 w-px bg-gray-300"></div>

              {/* Enlaces Rápidos */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentView('warehouse')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentView === 'warehouse' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Home className="w-4 h-4" />
                  <span>Original</span>
                </button>

                <button
                  onClick={() => setCurrentView('warehouse2')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentView === 'warehouse2' 
                      ? 'bg-green-600 text-white' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <GitBranch className="w-4 h-4" />
                  <span>Dinámico</span>
                </button>

                <button
                  onClick={() => setCurrentView('comparison')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentView === 'comparison' 
                      ? 'bg-purple-600 text-white' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>Comparar</span>
                </button>
              </div>

              {/* Configuración */}
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto py-6">
        {/* Indicador de Vista Actual */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Vista Actual: <strong className="text-blue-600">
                  {currentView === 'warehouse' && 'Warehouse Original (Hardcodeado)'}
                  {currentView === 'warehouse2' && 'Warehouse 2.0 (Dinámico)'}
                  {currentView === 'comparison' && 'Comparación'}
                </strong>
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Code className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-blue-700">
                {currentView === 'warehouse' && 'Estable - Producción'}
                {currentView === 'warehouse2' && 'Flexible - Desarrollo'}
                {currentView === 'comparison' && 'Análisis - Comparación'}
              </span>
            </div>
          </div>
        </div>

        {/* Renderizado del Componente Seleccionado */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
          {renderContent()}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              © 2024 TriniGlass. Todos los derechos reservados.
            </div>
            <div className="flex items-center space-x-4">
              <span>Modo:</span>
              <span className={`font-medium ${
                currentView === 'warehouse' ? 'text-blue-600' : 
                currentView === 'warehouse2' ? 'text-green-600' : 
                'text-purple-600'
              }`}>
                {currentView === 'warehouse' && 'Producción'}
                {currentView === 'warehouse2' && 'Desarrollo'}
                {currentView === 'comparison' && 'Comparación'}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

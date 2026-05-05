import React from 'react';
import Warehouse from './Warehouse';
import Warehouse2 from './Warehouse2';

export default function WarehouseComparison() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">Comparación de Componentes Warehouse</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Warehouse Original (Hardcodeado) */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">Warehouse.tsx (Original - Hardcodeado)</h2>
            <div className="border-2 border-blue-200 rounded-lg overflow-hidden" style={{ height: '600px' }}>
              <Warehouse />
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p className="font-semibold">Características:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Zonas hardcodeadas en el código</li>
                <li>Reglas de asignación fijas</li>
                <li>Configuración estática</li>
                <li>Funcionalidad completa pero poco flexible</li>
              </ul>
            </div>
          </div>

          {/* Warehouse2 (Dinámico) */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-xl font-semibold mb-4 text-green-600">Warehouse2.tsx (Nuevo - Dinámico)</h2>
            <div className="border-2 border-green-200 rounded-lg overflow-hidden" style={{ height: '600px' }}>
              <Warehouse2 />
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p className="font-semibold">Características:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Zonas cargadas dinámicamente desde Firebase</li>
                <li>Reglas de asignación configurables</li>
                <li>Diseños de mapa desde base de datos</li>
                <li>Completamente dinámico y flexible</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Panel de Control */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-center">Panel de Control</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600 mb-2">Para desarrollo:</p>
              <p className="text-xs bg-blue-100 text-blue-800 px-3 py-2 rounded">
                Usa <strong>Warehouse.tsx</strong> para estabilidad
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Para producción:</p>
              <p className="text-xs bg-green-100 text-green-800 px-3 py-2 rounded">
                Usa <strong>Warehouse2.tsx</strong> para flexibilidad
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Para pruebas:</p>
              <p className="text-xs bg-purple-100 text-purple-800 px-3 py-2 rounded">
                Usa esta <strong>vista comparativa</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

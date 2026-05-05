import React, { useState } from 'react';
import Warehouse from './Warehouse';
import Warehouse2 from './Warehouse2';

export default function SimpleSwitcher() {
  const [showOriginal, setShowOriginal] = useState(true);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4 text-center">Selector de Componentes</h1>
          
          <div className="flex justify-center space-x-4 mb-6">
            <button
              onClick={() => setShowOriginal(true)}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                showOriginal 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Warehouse Original
            </button>
            
            <button
              onClick={() => setShowOriginal(false)}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                !showOriginal 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Warehouse 2.0 (Dinámico)
            </button>
          </div>

          <div className="text-center mb-4">
            <span className="text-sm text-gray-600">
              Vista actual: <strong className="text-lg">
                {showOriginal ? '🔵 Warehouse Original' : '🟢 Warehouse 2.0'}
              </strong>
            </span>
          </div>

          {/* Componente seleccionado */}
          <div className="border-2 border-gray-300 rounded-lg overflow-hidden" style={{ height: '600px' }}>
            {showOriginal ? <Warehouse /> : <Warehouse2 />}
          </div>

          {/* Instrucciones */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold mb-2 text-blue-900">Instrucciones:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Click en los botones para cambiar entre componentes</li>
              <li>• Warehouse Original: versión hardcodeada (estable)</li>
              <li>• Warehouse 2.0: versión dinámica (flexible)</li>
              <li>• Ambos componentes tienen la misma interfaz visual</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

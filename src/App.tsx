import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Stock from './components/Stock';
import Warehouse from './components/Warehouse';
import Resumen from './components/Resumen';
import Login from './components/Login';
import AddUser from "./components/AddUser";
import Camiones from './components/Camiones';
import CargaCamion from './components/CargaCamion';
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleRoute } from "./components/RoleRoute";
import Configuracion from "./components/Configuracion";
import MobileScanner from "./components/Scanner";
import CanvasGridTest from "./components/CanvasGridTest";

const Alertas = () => (
  <div>
    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Alertas del Sistema</h1>
    <p className="text-slate-600 dark:text-slate-400">Panel de notificaciones.</p>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Resumen />} />
          <Route path="add-user" element={<RoleRoute requiredRol="admin"><AddUser /></RoleRoute>} />
          <Route path="inventario" element={<Stock />} />
          <Route path="almacen" element={<Warehouse />} />
          <Route path="scanner" element={<MobileScanner />} />
          <Route path="camiones" element={<Camiones />} />
          <Route path="camiones/cargar" element={<CargaCamion />} />
          <Route path="camiones/cargar/:matricula" element={<CargaCamion />} />
          <Route path="alertas" element={<Alertas />} />
          <Route path="canvas-test" element={<CanvasGridTest />} />
          <Route
            path="configuracion"
            element={
              <RoleRoute requiredRol="admin">
                <div className="p-8">
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Configuración general</h1>
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-lg">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Herramientas de Desarrollo</h2>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div>
                          <h3 className="font-medium text-blue-900 dark:text-blue-100">Editor de Mapas</h3>
                          <p className="text-sm text-blue-700 dark:text-blue-300">Crea y edita diseños de almacenamiento personalizados</p>
                        </div>
                        <a 
                          href="/canvas-test" 
                          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                        >
                          Abrir Editor
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </RoleRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
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
          <Route path="camiones" element={<Camiones />} />
          <Route path="camiones/cargar" element={<CargaCamion />} />
          <Route path="camiones/cargar/:matricula" element={<CargaCamion />} />
          <Route path="alertas" element={<Alertas />} />
          <Route
            path="configuracion"
            element={<RoleRoute requiredRol="admin"><Configuracion /></RoleRoute>}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}


export default App;
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Stock from './components/Stock';
import Warehouse from './components/Warehouse';
import Resumen from './components/Resumen';
import Login from './components/Login';
import AddUser from "./components/AddUser";
import Alertas from "./components/Alertas";
import Camiones from './components/Camiones';
import CargaCamion from './components/CargaCamion';
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleRoute } from "./components/RoleRoute";
import Configuracion from "./components/Configuracion";
import GestionUsuarios from "./components/GestionUsuarios";
import MobileScanner from "./components/Scanner";
import CanvasGridTest from "./components/CanvasGridTest";


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
                <Configuracion />
              </RoleRoute>
            }
          />
          <Route
            path="configuracion/usuarios"
            element={
              <RoleRoute requiredRol="admin">
                <GestionUsuarios />
              </RoleRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
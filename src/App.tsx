import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Stock from './components/Stock'; 
import Warehouse from './components/Warehouse';
import Resumen from './components/Resumen';
import Login from './components/Login';
import  AddUser  from "./components/AddUser";
import { ProtectedRoute } from "./components/ProtectedRoute";
import MobileScanner from "./components/Scanner";

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
          <Route path="add-user" element={<AddUser />} />
          <Route path="inventario" element={<Stock />} />
          <Route path="almacen" element={<Warehouse />} />
          <Route path="scanner" element={<MobileScanner />} />
          <Route path="alertas" element={<Alertas />} />
          <Route
            path="configuracion"
            element={<div className="text-slate-900 dark:text-white">Configuración general</div>}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
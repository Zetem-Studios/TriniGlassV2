import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Stock from './components/Stock'; 
import Warehouse from './components/Warehouse';
import Resumen from './components/Resumen';
import Login from './components/Login';
import AddUser from "./components/AddUser";
import Alertas from "./components/Alertas";
import { ProtectedRoute } from "./components/ProtectedRoute";

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
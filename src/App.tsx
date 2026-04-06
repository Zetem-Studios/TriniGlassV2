import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Stock from './components/Stock'; 
import Warehouse from './components/Warehouse';
import Resumen from './components/Resumen';

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
        <Route path="/" element={<Layout />}>
          {/* Rutas conectadas con los enlaces de tu nuevo menú */}
          <Route index element={<Resumen />} />
          <Route path="inventario" element={<Stock />} />
          <Route path="almacen" element={<Warehouse />} />
          <Route path="alertas" element={<Alertas />} />
          <Route path="configuracion" element={<div className="text-slate-900 dark:text-white">Configuración general</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Building2, Bell, Settings, Sun, Moon, Menu, X } from 'lucide-react';

export default function Layout() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Resumen", pill: null },
    { to: "/inventario", icon: Package, label: "Inventario", pill: { text: "98", type: "grey" } },
    { to: "/almacen", icon: Building2, label: "Almacén", pill: null },
    { to: "/alertas", icon: Bell, label: "Alertas", pill: { text: "3", type: "red" } },
    { to: "/configuracion", icon: Settings, label: "Configuración", pill: null },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-400 font-sans transition-colors duration-300">
      
      {/* Overlay para cerrar el menú en móvil */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Izquierdo */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-950 flex flex-col border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 transform md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-slate-900 dark:text-white font-bold text-xl">Navas Fleet</h1>
          {/* Botón de cierre en móvil */}
          <button 
            className="md:hidden text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3.5 p-3.5 rounded-xl transition-colors ${
                  isActive 
                    ? 'text-blue-700 bg-blue-50 dark:text-white dark:bg-blue-600/20' 
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon 
                    size={20} 
                    className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} 
                  />
                  <span className="flex-1">{item.label}</span>
                  {item.pill && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      item.pill.type === 'red' 
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' 
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200'
                    }`}>
                      {item.pill.text}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        
        {/* Header Superior */}
        <header className="h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 md:px-6 transition-colors duration-300">
          <button 
            className="md:hidden text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mr-4"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={24} />
          </button>
          
          <div className="flex items-center gap-4 ml-auto">
            
            {/* Botón Mágico de Tema */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Cambiar tema"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 hidden sm:block">Usuario</span>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-blue-50 font-bold border-2 border-transparent dark:border-slate-800">
              U
            </div>
          </div>
        </header>

        {/* Área donde se renderizarán las vistas */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet /> 
        </main>
      </div>
    </div>
  );
}
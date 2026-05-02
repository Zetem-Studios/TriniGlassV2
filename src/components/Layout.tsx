import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Building2, Bell, Settings, Sun, Moon, Menu, UserPlus, Truck, PackageOpen } from 'lucide-react';

import { useAuth } from '../context/useAuth';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function Layout() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { user, rol } = useAuth();
  const isAdmin = rol === "admin";

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión", error);
    }
  };

  const allNavItems = [
    { to: "/add-user", icon: UserPlus, label: "Añadir usuario", pill: null, adminOnly: true },
    { to: "/", icon: LayoutDashboard, label: "Resumen", pill: null, adminOnly: false },
    { to: "/inventario", icon: Package, label: "Inventario", pill: { text: "98", type: "grey" }, adminOnly: false },
    { to: "/almacen", icon: Building2, label: "Almacén", pill: null, adminOnly: false },
    { to: "/camiones", icon: Truck, label: "Flota", pill: null, adminOnly: false },
    { to: "/camiones/cargar", icon: PackageOpen, label: "Carga camión", pill: null, adminOnly: false },
    { to: "/alertas", icon: Bell, label: "Alertas", pill: { text: "3", type: "red" }, adminOnly: false },
    { to: "/configuracion", icon: Settings, label: "Configuración", pill: null, adminOnly: true },
  ];

  const navItems = allNavItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-400 font-sans transition-colors duration-300">
      
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-950 flex flex-col hidden md:flex border-r border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="h-16 flex items-center p-6 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-slate-900 dark:text-white font-bold text-xl">Navas Fleet</h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
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

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 transition-colors duration-300">
          
          <button className="md:hidden text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <Menu size={24} />
          </button>
          
          <div className="flex items-center gap-4 ml-auto">
            
            {/* Tema */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* 🔥 USUARIO REAL */}
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {user?.email || "Usuario"}
            </span>

            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-blue-50 font-bold border-2 border-transparent dark:border-slate-800">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>

            {/* 🔥 LOGOUT */}
            {user && (
              <button
                onClick={handleLogout}
                className="text-sm text-red-400 hover:text-red-500"
              >
                Logout
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet /> 
        </main>
      </div>
    </div>
  );
}
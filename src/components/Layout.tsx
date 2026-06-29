import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';

import { LayoutDashboard, Package, Building2, Bell, Settings, Sun, Moon, Menu, UserPlus, Truck, PackageOpen, X, LogOut, FileText } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useAlertasCount } from '../hooks/useAlertasCount';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

const THEME_KEY = 'triniglass-theme';

function getInitialDarkMode(): boolean {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  // Sin preferencia guardada: respetar el sistema (por defecto oscuro)
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? false : true;
  }
  return true;
}

export default function Layout() {
  const [isDarkMode, setIsDarkMode] = useState(getInitialDarkMode);
  const { user, rol } = useAuth();
  const isAdmin = rol === "admin";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const alertasCount = useAlertasCount();

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, isDarkMode ? 'dark' : 'light');
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
    { to: "/inventario", icon: Package, label: "Inventario", pill: null, adminOnly: false },
    { to: "/almacen", icon: Building2, label: "Almacén", pill: null, adminOnly: false },
    { to: "/camiones", icon: Truck, label: "Flota", pill: null, adminOnly: false },
    { to: "/camiones/cargar", icon: PackageOpen, label: "Carga camión", pill: null, adminOnly: false },
    { to: "/alertas", icon: Bell, label: "Alertas", pill: alertasCount > 0 ? { text: String(alertasCount), type: "red" } : null, adminOnly: false },
    { to: "/configuracion", icon: Settings, label: "Configuración", pill: null, adminOnly: true },
    { to: "/presupuesto", icon: FileText, label: "Presupuesto", pill: null, adminOnly: true },
  ];

  const navItems = allNavItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-400 transition-colors duration-150">
      {/* Sidebar desktop */}
      <aside className="w-60 bg-white dark:bg-slate-900 flex-col hidden md:flex border-r border-slate-200/80 dark:border-slate-800/80 transition-colors duration-150">
        <div className="h-16 flex items-center px-5 border-b border-slate-200/80 dark:border-slate-800/80">
          <h1 className="font-bold text-lg tracking-tight">
            <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">Trini</span>
            <span className="text-slate-900 dark:text-white">Glass</span>
          </h1>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
                  isActive
                    ? 'text-brand-700 bg-brand-50 dark:text-white dark:bg-brand-600/15'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60'
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    size={18}
                    className={isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'}
                  />
                  <span className="flex-1 font-medium">{item.label}</span>

                  {item.pill && (
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                      item.pill.type === 'red'
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
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

      {/* Sidebar móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden animate-fade-in">
          <div className="w-60 bg-white dark:bg-slate-900 flex flex-col h-full border-r border-slate-200/80 dark:border-slate-800/80 shadow-xl animate-slide-in">
            <div className="h-16 flex items-center px-5 border-b border-slate-200/80 dark:border-slate-800/80 justify-between">
              <h1 className="font-bold text-lg tracking-tight">
                <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">Trini</span>
                <span className="text-slate-900 dark:text-white">Glass</span>
              </h1>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Cerrar menú"
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
                      isActive
                        ? 'text-brand-700 bg-brand-50 dark:text-white dark:bg-brand-600/15'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/60'
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        size={18}
                        className={isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500'}
                      />
                      <span className="flex-1 font-medium">{item.label}</span>
                      {item.pill && (
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                          item.pill.type === 'red'
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {item.pill.text}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between px-6 shadow-xs transition-colors duration-150">
          <button
            className="md:hidden p-1.5 -ml-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              aria-label={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 rounded-md transition-all duration-300"
            >
              <span className={`block transition-transform duration-500 ${isDarkMode ? 'rotate-0' : 'rotate-90'}`}>
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </span>
            </button>
            <div className="hidden sm:flex items-center gap-2.5 ml-2 pl-3 border-l border-slate-200 dark:border-slate-800">
              <div className="w-7 h-7 bg-brand-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                {user?.email?.charAt(0).toUpperCase() ?? "U"}
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 max-w-[180px] truncate">
                {user?.email ?? "Usuario"}
              </span>
            </div>
            {user && (
              <button
                onClick={() => void handleLogout()}
                aria-label="Cerrar sesión"
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/30 rounded-md transition-colors"
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

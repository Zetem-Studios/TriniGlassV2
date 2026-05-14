//import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>TriniGlass - Test Version</h1>
      <p>Esta es una versión de prueba para aislar el problema.</p>
      <p>Si puedes ver esto, el servidor está funcionando correctamente.</p>
      <div style={{ 
        marginTop: '20px', 
        padding: '10px', 
        backgroundColor: '#f0f0f0', 
        borderRadius: '5px' 
      }}>
        <h2>Estado del Sistema:</h2>
        <ul>
          <li>✅ Servidor React: Funcionando</li>
          <li>✅ Vite: Funcionando</li>
          <li>✅ Router: Funcionando</li>
          <li>❓ Firebase: Desactivado para prueba</li>
        </ul>
      </div>
    </div>
  );
}

export default App;

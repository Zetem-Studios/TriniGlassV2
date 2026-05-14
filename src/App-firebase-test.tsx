import { useState, useEffect } from 'react';

function App() {
  const [firebaseStatus, setFirebaseStatus] = useState('Inicializando...');
  const [error, setError] = useState('');

  useEffect(() => {
    const testFirebase = async () => {
      try {
        setFirebaseStatus('Cargando variables de entorno...');
        
        // Test environment variables
        const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
        const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
        const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
        
        if (!apiKey || !authDomain || !projectId) {
          setError('Variables de entorno faltantes');
          setFirebaseStatus('❌ Error: Variables de entorno');
          return;
        }
        
        setFirebaseStatus('Variables de entorno OK');
        
        // Test Firebase initialization
        setFirebaseStatus('Inicializando Firebase...');
        const { initializeApp } = await import('firebase/app');
        
        const firebaseConfig = {
          apiKey,
          authDomain,
          projectId,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
        };
        
        const app = initializeApp(firebaseConfig);
        setFirebaseStatus('✅ Firebase inicializado correctamente');
        
        // Test Auth
        setFirebaseStatus('Probando Auth...');
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth(app);
        console.log('Auth initialized:', auth);
        setFirebaseStatus('✅ Auth inicializado');
        
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setFirebaseStatus('❌ Error en Firebase');
      }
    };
    
    testFirebase();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>TriniGlass - Firebase Test</h1>
      
      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: '#f0f0f0', 
        borderRadius: '5px' 
      }}>
        <h2>Estado de Firebase:</h2>
        <p><strong>{firebaseStatus}</strong></p>
        {error && (
          <div style={{ 
            marginTop: '10px', 
            padding: '10px', 
            backgroundColor: '#ffebee', 
            borderRadius: '5px',
            color: '#c62828'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h3>Variables de Entorno Detectadas:</h3>
        <ul>
          <li>VITE_FIREBASE_API_KEY: {import.meta.env.VITE_FIREBASE_API_KEY ? '✅' : '❌'}</li>
          <li>VITE_FIREBASE_AUTH_DOMAIN: {import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? '✅' : '❌'}</li>
          <li>VITE_FIREBASE_PROJECT_ID: {import.meta.env.VITE_FIREBASE_PROJECT_ID ? '✅' : '❌'}</li>
          <li>VITE_FIREBASE_STORAGE_BUCKET: {import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ? '✅' : '❌'}</li>
          <li>VITE_FIREBASE_MESSAGING_SENDER_ID: {import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ? '✅' : '❌'}</li>
          <li>VITE_FIREBASE_APP_ID: {import.meta.env.VITE_FIREBASE_APP_ID ? '✅' : '❌'}</li>
        </ul>
      </div>
    </div>
  );
}

export default App;

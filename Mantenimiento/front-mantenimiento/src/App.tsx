import { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css'; // Importante para los íconos
import Navbar from './components/Navbar';
import Login from './components/Login';
import Register from './components/Register';
import ReportList from './components/ReportList';
import ReportForm from './components/ReportForm';
import { type User } from './types';

// Definimos las posibles vistas
type ViewState = 'login' | 'register' | 'list' | 'form';

function App() {
  const [view, setView] = useState<ViewState>('login');
  const [user, setUser] = useState<User | null>(null);

  // Al cargar, verificar si hay sesión
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (storedUser && token) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      // Redirección inicial basada en rol
      if (parsedUser.role === '1') {
        setView('list');
      } else {
        setView('form');
      }
    }
  }, []);

  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
    if (userData.role === '1') {
      setView('list');
    } else {
      setView('form');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setView('login');
  };

  // Renderizado Condicional (Routing Manual)
  const renderContent = () => {
    switch (view) {
      case 'login':
        return <Login onLoginSuccess={handleLoginSuccess} onGoToRegister={() => setView('register')} />;
      
      case 'register':
        return <Register onGoToLogin={() => setView('login')} />;
      
      case 'list':
        // Protección simple: si no es admin, mandar al form
        if (user?.role !== '1') return <ReportForm isAdmin={false} />;
        return <ReportList onCreateNew={() => setView('form')} />;
      
      case 'form':
        return (
            <ReportForm 
                isAdmin={user?.role === '1'} 
                onBack={() => setView('list')} 
            />
        );
        
      default:
        return <Login onLoginSuccess={handleLoginSuccess} onGoToRegister={() => setView('register')} />;
    }
  };

  return (
    <>
      {user && <Navbar user={user} onLogout={handleLogout} />}
      {renderContent()}
    </>
  );
}

export default App;
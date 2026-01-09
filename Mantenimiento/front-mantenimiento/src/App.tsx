import { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css'; 
import Navbar from './components/Navbar';
import Login from './components/Login';
import Register from './components/Register';
import ReportList from './components/ReportList';
import ReportForm from './components/ReportForm';
import { type User } from './types';

type ViewState = 'login' | 'register' | 'list' | 'form';

function App() {
  const [view, setView] = useState<ViewState>('login');
  const [user, setUser] = useState<User | null>(null);
  // Estado para saber qué ID estamos editando (null = creando nuevo)
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (storedUser && token) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
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

  // Función para iniciar edición desde la lista
  const handleEditReport = (id: string) => {
    setEditingId(id);
    setView('form');
  };

  const handleCreateNew = () => {
    setEditingId(null);
    setView('form');
  };

  const renderContent = () => {
    switch (view) {
      case 'login':
        return <Login onLoginSuccess={handleLoginSuccess} onGoToRegister={() => setView('register')} />;
      
      case 'register':
        return <Register onGoToLogin={() => setView('login')} />;
      
      case 'list':
        if (user?.role !== '1') return <ReportForm isAdmin={false} />;
        return <ReportList onCreateNew={handleCreateNew} onEdit={handleEditReport} />;
      
      case 'form':
        return (
            <ReportForm 
                isAdmin={user?.role === '1'} 
                reportId={editingId} // Pasamos el ID (si existe)
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
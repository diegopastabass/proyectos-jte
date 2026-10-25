import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BsGridFill, BsListUl, BsSortAlphaDown, BsSortAlphaDownAlt, BsSearch, BsBoxArrowUpRight } from 'react-icons/bs';
import clientsData from './data/clients.json';
import { Client } from './types';
import logoJte from './assets/logoJte.png';
import './App.css';

function App() {
  const [clients] = useState<Client[]>(clientsData);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredAndSortedClients = useMemo(() => {
    let result = clients.filter(client => 
      client.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    result = result.sort((a, b) => {
      const compareResult = a.name.localeCompare(b.name);
      return sortOrder === 'asc' ? compareResult : -compareResult;
    });

    return result;
  }, [clients, searchTerm, sortOrder]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
  };

  return (
    <div className="container py-5">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="row mb-5 align-items-center"
      >
        <div className="col-md-5 mb-4 mb-md-0">
          <img src={logoJte} alt="Logo JTE" className="mb-2" style={{ maxHeight: '60px' }} />
          <p className="text-muted mb-0 fs-5">Gestión y Acceso de Clientes</p>
        </div>
        
        <div className="col-md-7">
          <div className="d-flex gap-3 justify-content-md-end flex-wrap">
            <div className="position-relative flex-grow-1" style={{ maxWidth: '350px' }}>
              <BsSearch className="position-absolute top-50 translate-middle-y ms-3 text-muted" />
              <input 
                type="text" 
                className="form-control form-control-lg ps-5 rounded-pill shadow-sm border-0" 
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="btn-group shadow-sm rounded-pill bg-white">
              <button 
                className={`btn btn-outline-primary border-0 rounded-start-pill px-3 ${sortOrder === 'asc' ? 'active' : ''}`}
                onClick={() => setSortOrder('asc')}
                title="Ordenar A-Z"
              >
                <BsSortAlphaDown size={20} />
              </button>
              <button 
                className={`btn btn-outline-primary border-0 rounded-end-pill px-3 ${sortOrder === 'desc' ? 'active' : ''}`}
                onClick={() => setSortOrder('desc')}
                title="Ordenar Z-A"
              >
                <BsSortAlphaDownAlt size={20} />
              </button>
            </div>

            <div className="btn-group shadow-sm rounded-pill bg-white">
              <button 
                className={`btn btn-outline-secondary border-0 rounded-start-pill px-3 ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Vista Cuadrícula"
              >
                <BsGridFill size={18} />
              </button>
              <button 
                className={`btn btn-outline-secondary border-0 rounded-end-pill px-3 ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="Vista Lista"
              >
                <BsListUl size={18} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className={viewMode === 'grid' ? 'row g-4' : 'd-flex flex-column gap-3'}
      >
        <AnimatePresence mode='popLayout'>
          {filteredAndSortedClients.length > 0 ? (
            filteredAndSortedClients.map(client => (
              <motion.div
                key={client.id}
                variants={itemVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                layout
                className={viewMode === 'grid' ? 'col-12 col-sm-6 col-md-4 col-lg-3' : 'w-100'}
              >
                <div className={`card h-100 border-0 shadow-sm client-card ${viewMode === 'list' ? 'flex-row align-items-center p-3' : 'p-4 d-flex flex-column'}`}>
                  <div className={`rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold fs-3 mx-auto ${viewMode === 'list' ? 'mb-0 mx-0 me-4' : 'mb-4'}`} style={{ width: '70px', height: '70px', flexShrink: 0 }}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className={`flex-grow-1 ${viewMode === 'list' ? 'text-start' : 'text-center mb-4'}`}>
                    <h5 className="fw-bold mb-2 fs-4 text-dark">{client.name}</h5>
                    <a 
                      href={`https://jteanalytics.cl/${client.slug}/`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-decoration-none text-muted d-inline-flex align-items-center gap-2 hover-primary"
                    >
                      jteanalytics.cl/{client.slug} <BsBoxArrowUpRight size={14} />
                    </a>
                  </div>
                  <div className={viewMode === 'list' ? 'ms-auto' : 'mt-auto w-100'}>
                    <a 
                      href={`https://jteanalytics.cl/${client.slug}/`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={`btn btn-primary rounded-pill fw-medium ${viewMode === 'list' ? 'px-4' : 'w-100 py-2'}`}
                    >
                      Abrir Aplicativo
                    </a>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="col-12 text-center py-5"
            >
              <div className="text-muted fs-4">No se encontraron clientes con "{searchTerm}"</div>
              <p className="text-muted mt-2">Intenta usar otros términos de búsqueda.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default App;

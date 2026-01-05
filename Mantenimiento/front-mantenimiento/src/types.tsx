export interface Material {
  description: string;
  quantity: number;
  cost: number;
}

export interface ReportData {
  startDate: string;
  endDate: string;
  type: 'Mantención Preventiva' | 'Atención de Falla';
  client: {
    name: string;
    address: string;
    equipment: string;
  };
  contact: {
    name: string;
    phone: string;
    email: string;
  };
  ticket: {
    number: string;
    date: string;
  };
  status: 'Sin Resolver' | 'Parcialmente Resuelto' | 'Resuelto';
  description: string;
  solutions: string[];
  observations: string[];
  materials: Material[]; // Array
  techName: string;
  clientSigner: string;
}

export const initialData: ReportData = {
  startDate: new Date().toISOString().slice(0, 16),
  endDate: new Date().toISOString().slice(0, 16),
  type: 'Atención de Falla',
  client: { name: '', address: '', equipment: '' },
  contact: { name: '', phone: '', email: '' },
  ticket: { 
    number: Math.floor(Math.random() * 90000 + 10000).toString(), 
    date: new Date().toISOString().split('T')[0] 
  },
  status: 'Resuelto',
  description: '',
  solutions: [''],
  observations: [''],
  materials: [], // Inicializado vacío para que sea opcional
  techName: '',
  clientSigner: ''
};
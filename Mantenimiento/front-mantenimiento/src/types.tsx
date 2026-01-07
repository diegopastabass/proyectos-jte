export interface Material {
  description: string;
  quantity: number;
  cost: number;
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
  materials: [],
  techName: '',
  clientSigner: '',
  techSignature: '',
  clientSignature: '',
  isApproved: false,
};

export interface User {
  email: string;
  fullName: string;
  role: '0' | '1';
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface ReportSummary {
  id: string;
  clientName: string;
  ticketNumber: string;
  createdAt: string;
  status: string;
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
    materials: Material[];
    techName: string;
    clientSigner: string;
    techSignature?: string;
    clientSignature?: string;
    isApproved: boolean;
}

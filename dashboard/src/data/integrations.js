const mockTime = 'Not checked';

export const integrations = [
  { id: 'shear-kutz', name: 'Shear Kutz', metric: '4 mock tasks', category: 'Business' },
  { id: 'quantum-gamer-tech', name: 'Quantum Gamer Tech', metric: '2 mock milestones', category: 'Business' },
  { id: 'legacy-bot', name: 'Legacy Bot', metric: 'Standby', category: 'Project' },
  { id: 'wisetouch', name: 'Wisetouch Interiors', metric: '3 mock leads', category: 'Business' },
  { id: 'flyy-city', name: 'Flyy City Barbershop', metric: 'Planning', category: 'Business' },
  { id: 'github', name: 'GitHub', metric: 'No repository data', category: 'Service' },
  { id: 'railway', name: 'Railway', metric: 'No deployment data', category: 'Service' },
  { id: 'discord', name: 'Discord', metric: 'No server data', category: 'Service' },
  { id: 'calendar', name: 'Calendar', metric: 'No event data', category: 'Service' },
].map((integration) => ({
  ...integration,
  status: 'Not connected',
  dataMode: 'Mock data',
  lastChecked: mockTime,
}));

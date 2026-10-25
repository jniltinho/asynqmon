// Theme registry: the single list read by Settings, the theme switcher in main.js and the theme tests. The first
// one is the default. Every id but "default" has a block in themes/*.css (:root[data-theme='id']).
export const themes = [
  { id: 'default', label: 'Default', scheme: 'light' },
  { id: 'admanager', label: 'ADManager', scheme: 'light' },
  { id: 'breeze', label: 'Breeze', scheme: 'light' },
  { id: 'breeze-dark', label: 'Breeze (dark)', scheme: 'dark' },
  { id: 'violet', label: 'Violet', scheme: 'light' },
  { id: 'violet-dark', label: 'Violet (dark)', scheme: 'dark' },
  { id: 'aurora', label: 'Aurora', scheme: 'light' },
  { id: 'aurora-dark', label: 'Aurora (dark)', scheme: 'dark' },
  { id: 'crystal', label: 'Crystal', scheme: 'light' },
  { id: 'crystal-dark', label: 'Crystal (dark)', scheme: 'dark' },
  { id: 'cone', label: 'Cone (dark)', scheme: 'dark' },
  { id: 'classic-blue', label: 'Classic blue (XP)', scheme: 'light' },
  { id: 'classic-gray', label: 'Classic gray (98)', scheme: 'light' },
  { id: 'graphite', label: 'Graphite (dark)', scheme: 'dark' },
  { id: 'grafana', label: 'Grafana (dark)', scheme: 'dark' },
  { id: 'rabbitmq', label: 'RabbitMQ', scheme: 'light' },
  { id: 'matrix', label: 'Matrix (dark)', scheme: 'dark' },
  { id: 'winamp', label: 'Winamp (dark)', scheme: 'dark' },
  { id: 'pink-panther', label: 'Pink Panther', scheme: 'light' },
  { id: 'high-contrast', label: 'High contrast (dark)', scheme: 'dark' },
]

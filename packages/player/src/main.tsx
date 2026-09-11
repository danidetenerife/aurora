import ReactDOM from 'react-dom/client';

import '@aurora/tailwind-config';
import '@aurora/themes';
import '@aurora/i18n';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}
const root = ReactDOM.createRoot(rootElement);

try {
  const { initPlayerApp } = await import('./initPlayerApp');
  await initPlayerApp(root);
} catch (error) {
  console.error('Fatal initialization error:', error);
}

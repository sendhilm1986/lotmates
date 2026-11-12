// The session resolves inside sdk.js before anything renders.
import { sdk } from '@/services/sdk';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from '@/store';
import App from './App';
import './index.css';

void sdk;
createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <App />
  </Provider>
);

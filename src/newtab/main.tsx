import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/tokens.css';

const root = document.getElementById('root')!;
createRoot(root).render(<App />);

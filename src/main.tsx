import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './global.css';

// Layout components
import AppLayout from './app/_layout';

// Pages
import Historique from './app/historique';
import Tickets from './app/tickets';

// Tabs
import TabLayout from './app/(tabs)/_layout';
import Dashboard from './app/(tabs)/index';
import PointsDeVente from './app/(tabs)/points-de-vente';
import Collectes from './app/(tabs)/collectes';
import Plus from './app/(tabs)/plus';

// Auth
import Login from './app/(auth)/login';

// Detail page
import PointDeVenteDetail from './app/points-de-vente/[id]';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="points-de-vente" element={<PointsDeVente />} />
          <Route path="collectes" element={<Collectes />} />
          <Route path="plus" element={<Plus />} />
          <Route path="historique" element={<Historique />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="points-de-vente/:id" element={<PointDeVenteDetail />} />
        </Route>
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
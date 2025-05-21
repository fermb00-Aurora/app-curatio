import React from 'react';
import Sidebar from './Sidebar';

function Dashboard() {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 p-10">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <p>Welcome to the Business Analytics Dashboard. Use the sidebar to navigate.</p>
      </div>
    </div>
  );
}

export default Dashboard; 
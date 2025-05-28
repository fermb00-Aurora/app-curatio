import React from 'react';
import Sidebar from './Sidebar';

function Inventory() {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 p-10">
        <h1 className="text-3xl font-bold mb-6">Inventory Data</h1>
        <p>Here you will see the analytics and visualizations for inventory data.</p>
        {/* Chart.js integration will go here */}
      </div>
    </div>
  );
}

export default Inventory; 
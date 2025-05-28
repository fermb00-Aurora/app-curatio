import React from 'react';
import { Link } from 'react-router-dom';

function Sidebar() {
  return (
    <div className="bg-blue-600 text-white w-64 p-5 h-full">
      <h2 className="text-2xl font-bold mb-6">Navigation</h2>
      <ul className="space-y-3">
        <li>
          <Link to="/upload" className="block p-2 hover:bg-blue-700 rounded">Upload</Link>
        </li>
        <li>
          <Link to="/sales" className="block p-2 hover:bg-blue-700 rounded">Sales</Link>
        </li>
        <li>
          <Link to="/inventory" className="block p-2 hover:bg-blue-700 rounded">Inventory</Link>
        </li>
        <li>
          <Link to="/profile" className="block p-2 hover:bg-blue-700 rounded">Profile</Link>
        </li>
      </ul>
    </div>
  );
}

export default Sidebar; 
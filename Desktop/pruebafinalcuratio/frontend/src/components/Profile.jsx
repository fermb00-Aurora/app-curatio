import React from 'react';
import Sidebar from './Sidebar';

function Profile() {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 p-10">
        <h1 className="text-3xl font-bold mb-6">User Profile</h1>
        <p>Manage your account settings and view your upload history here.</p>
      </div>
    </div>
  );
}

export default Profile; 
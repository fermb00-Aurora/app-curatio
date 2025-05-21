import React from 'react';
import { clearAllData } from '../utils/clearData';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export const Settings = () => {
  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      const success = await clearAllData();
      if (success) {
        toast({
          title: 'Success',
          description: 'All data has been cleared successfully.',
        });
      } else {
        toast({
          title: 'Error',
          description: 'There was an error clearing the data.',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* ... existing settings ... */}
      
      <div className="border-t pt-4">
        <h3 className="text-lg font-medium text-red-600">Danger Zone</h3>
        <p className="text-sm text-gray-500 mb-4">
          These actions are irreversible. Please be careful.
        </p>
        <Button
          variant="destructive"
          onClick={handleClearData}
        >
          Clear All Data
        </Button>
      </div>
    </div>
  );
}; 
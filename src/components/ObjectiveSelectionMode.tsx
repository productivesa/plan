import React from 'react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { Target, FileSearch, ArrowRight } from 'lucide-react';

interface ObjectiveSelectionModeProps {
  onSelectMode: (mode: 'default' | 'custom') => void;
}

const ObjectiveSelectionMode: React.FC<ObjectiveSelectionModeProps> = ({ onSelectMode }) => {
  const { t } = useLanguage();

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
        Strategic Objective Selection
      </h2>
      <p className="text-gray-600 mb-8 text-center">
        Choose how you would like to select strategic objectives for your plan
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Default Objectives */}
        <div 
          onClick={() => onSelectMode('default')}
          className="bg-white p-6 rounded-lg border-2 border-green-200 hover:border-green-500 shadow-sm cursor-pointer transition-colors flex flex-col items-center text-center"
        >
          <div className="bg-green-100 p-4 rounded-full mb-4">
            <Target className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Default Objective</h3>
          <p className="text-sm text-gray-500 mb-4">
            Select from the default strategic objectives that have been defined by the organization.
          </p>
          <button className="mt-auto inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700">
            Choose Default
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </div>

        {/* Custom Objectives */}
        <div 
          onClick={() => onSelectMode('custom')}
          className="bg-white p-6 rounded-lg border-2 border-blue-200 hover:border-blue-500 shadow-sm cursor-pointer transition-colors flex flex-col items-center text-center"
        >
          <div className="bg-blue-100 p-4 rounded-full mb-4">
            <FileSearch className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Custom Objectives</h3>
          <p className="text-sm text-gray-500 mb-4">
            Create your own custom plan by selecting and weighting strategic objectives yourself.
          </p>
          <button className="mt-auto inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
            Create Custom
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>You can change your selection at any time before submitting the plan.</p>
      </div>
    </div>
  );
};

export default ObjectiveSelectionMode;
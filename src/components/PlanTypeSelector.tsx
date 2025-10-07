import React from 'react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { Building2, Users, User } from 'lucide-react';
import type { PlanType } from '../types/plan';

interface PlanTypeSelectorProps {
  onSelectPlanType: (type: PlanType) => void;
}

const PlanTypeSelector: React.FC<PlanTypeSelectorProps> = ({ onSelectPlanType }) => {
  const { t } = useLanguage();

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
        {t('planning.selectPlanType')}
      </h2>
      <p className="text-gray-600 mb-8 text-center">
        Choose the type of plan you would like to create
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LEO/EO Plan - Fully implemented */}
        <div 
          onClick={() => onSelectPlanType('LEO/EO Plan')}
          className="bg-white p-6 rounded-lg border-2 border-green-200 hover:border-green-500 shadow-sm cursor-pointer transition-colors flex flex-col items-center text-center"
        >
          <div className="bg-green-100 p-4 rounded-full mb-4">
            <Building2 className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('planning.planTypeLEO')}</h3>
          <p className="text-sm text-gray-500">
            Create a plan for Lead Executive Office or Executive Office level
          </p>
        </div>

        {/* Desk/Team Plan - Coming Soon */}
        <div 
          onClick={() => onSelectPlanType('Desk/Team Plan')}
          className="bg-gray-50 p-6 rounded-lg border-2 border-gray-200 shadow-sm flex flex-col items-center text-center relative"
        >
          <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-10">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              Coming Soon
            </span>
          </div>
          <div className="bg-blue-100 p-4 rounded-full mb-4">
            <Users className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('planning.planTypeTeamDesk')}</h3>
          <p className="text-sm text-gray-500">
            Create a plan for Desk or Team level
          </p>
        </div>

        {/* Individual Plan - Coming Soon */}
        <div 
          onClick={() => onSelectPlanType('Individual Plan')}
          className="bg-gray-50 p-6 rounded-lg border-2 border-gray-200 shadow-sm flex flex-col items-center text-center relative"
        >
          <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-10">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              Coming Soon
            </span>
          </div>
          <div className="bg-purple-100 p-4 rounded-full mb-4">
            <User className="h-8 w-8 text-purple-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('planning.planTypeIndividual')}</h3>
          <p className="text-sm text-gray-500">
            Create a plan for individual level activities
          </p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          Note: Currently, only LEO/EO Plan is fully implemented. Other plan types will be available in future updates.
        </p>
      </div>
    </div>
  );
};

export default PlanTypeSelector;
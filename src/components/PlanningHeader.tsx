import React from 'react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { Calendar, Building2, User, FileType } from 'lucide-react';
import { PlanType } from '../types/plan';

interface PlanningHeaderProps {
  organizationName: string;
  fromDate: string;
  toDate: string;
  plannerName: string;
  planType: PlanType;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  onPlanTypeChange: (type: PlanType) => void;
}

const PlanningHeader: React.FC<PlanningHeaderProps> = ({
  organizationName,
  fromDate,
  toDate,
  plannerName,
  planType,
  onFromDateChange,
  onToDateChange,
  onPlanTypeChange,
}) => {
  const { t } = useLanguage();

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-500" />
              {t('planning.organization')}
            </div>
          </label>
          <div className="mt-1 block w-full px-3 py-2 text-base border border-gray-300 rounded-md bg-gray-50">
            {organizationName}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500" />
              {t('planning.plannerName')}
            </div>
          </label>
          <div className="mt-1 block w-full px-3 py-2 text-base border border-gray-300 rounded-md bg-gray-50">
            {plannerName}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <div className="flex items-center gap-2">
              <FileType className="h-4 w-4 text-gray-500" />
              {t('planning.type')}
            </div>
          </label>
          <select
            value={planType}
            onChange={(e) => onPlanTypeChange(e.target.value as PlanType)}
            className="mt-1 block w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="LEO/EO Plan">LEO/EO Plan</option>
            <option value="Desk/Team Plan">Desk/Team Plan</option>
            <option value="Individual Plan">Individual Plan</option>
          </select>
        </div>

        <div>
          <label htmlFor="from-date" className="block text-sm font-medium text-gray-700 mb-1">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              {t('planning.fromDate')}
            </div>
          </label>
          <input
            type="date"
            id="from-date"
            value={fromDate}
            onChange={(e) => onFromDateChange(e.target.value)}
            className="mt-1 block w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="to-date" className="block text-sm font-medium text-gray-700 mb-1">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              {t('planning.toDate')}
            </div>
          </label>
          <input
            type="date"
            id="to-date"
            value={toDate}
            onChange={(e) => onToDateChange(e.target.value)}
            min={fromDate}
            className="mt-1 block w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
};

export default PlanningHeader;
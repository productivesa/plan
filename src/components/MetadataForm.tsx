import React from 'react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { Organization } from '../types/organization';

interface MetadataFormProps {
  organization: Organization;
}

const MetadataForm: React.FC<MetadataFormProps> = ({ organization }) => {
  const { t } = useLanguage();

  // Format core values as a list
  const coreValuesList = organization.core_values || [];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">{organization.name}</h3>
        <p className="text-sm text-gray-600 mb-2">{organization.type.replace('_', ' ')}</p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">{t('dashboard.vision')}</h3>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          {organization.vision ? (
            <p className="text-gray-800">{organization.vision}</p>
          ) : (
            <p className="text-gray-500 italic">No vision statement available</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">{t('dashboard.mission')}</h3>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          {organization.mission ? (
            <p className="text-gray-800">{organization.mission}</p>
          ) : (
            <p className="text-gray-500 italic">No mission statement available</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">{t('dashboard.coreValues')}</h3>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          {coreValuesList.length > 0 ? (
            <ul className="list-disc list-inside space-y-1">
              {coreValuesList.map((value, index) => (
                <li key={index} className="text-gray-800">{value}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 italic">No core values defined</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MetadataForm;
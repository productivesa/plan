import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calculator, Edit, Trash2, AlertCircle } from 'lucide-react';
import { costingAssumptions } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { CostingAssumption } from '../types/costing';
import { ACTIVITY_TYPES, TRAINING_LOCATIONS } from '../types/plan';

interface CostingAssumptionsListProps {
  onEdit: (assumption: CostingAssumption) => void;
}

const CostingAssumptionsList: React.FC<CostingAssumptionsListProps> = ({ onEdit }) => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const { data: assumptionsList, isLoading } = useQuery({
    queryKey: ['costing-assumptions'],
    queryFn: () => costingAssumptions.getAll()
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => costingAssumptions.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costing-assumptions'] });
    }
  });

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this cost assumption?')) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete assumption:', error);
      }
    }
  };

  const getLocationLabel = (value: string) => {
    return TRAINING_LOCATIONS.find(loc => loc.value === value)?.label || value;
  };

  const getActivityTypeLabel = (value: string) => {
    return ACTIVITY_TYPES.find(type => type.value === value)?.label || value;
  };

  if (isLoading) {
    return <div className="text-center p-4">{t('common.loading')}</div>;
  }

  if (!assumptionsList?.data || assumptionsList.data.length === 0) {
    return (
      <div className="text-center p-8 bg-white rounded-lg shadow-sm border border-gray-200">
        <Calculator className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Cost Assumptions</h3>
        <p className="text-gray-500">No costing assumptions have been defined yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Activity Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cost Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount (ETB)
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {assumptionsList.data.map((assumption: CostingAssumption) => (
              <tr key={assumption.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {getActivityTypeLabel(assumption.activity_type)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {getLocationLabel(assumption.location)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {assumption.cost_type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {assumption.amount.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => onEdit(assumption)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(assumption.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-center text-red-700">
          <AlertCircle className="h-5 w-5 mr-2" />
          Failed to delete assumption. Please try again.
        </div>
      )}
    </div>
  );
};

export default CostingAssumptionsList;
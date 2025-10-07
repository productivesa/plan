import React from 'react';
import { DollarSign, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { MainActivity } from '../types/plan';

interface ActivityBudgetDetailsProps {
  activity: MainActivity;
  onBack: () => void;
  onEdit: () => void;
  isReadOnly?: boolean;
}

const ActivityBudgetDetails: React.FC<ActivityBudgetDetailsProps> = ({
  activity,
  onBack,
  onEdit,
  isReadOnly = false
}) => {
  const { t } = useLanguage();

  if (!activity.budget) {
    return null;
  }

  const {
    estimated_cost_with_tool,
    estimated_cost_without_tool,
    government_treasury,
    sdg_funding,
    partners_funding,
    other_funding
  } = activity.budget;

  // Calculate totals
  const totalRequiredBudget = Math.max(estimated_cost_with_tool, estimated_cost_without_tool);
  const totalAvailableBudget = government_treasury + sdg_funding + partners_funding + other_funding;
  const budgetGap = totalRequiredBudget - totalAvailableBudget;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          Back to Activities
        </button>
        {!isReadOnly && (
          <button
            onClick={onEdit}
            className="px-4 py-2 text-blue-600 hover:text-blue-800"
          >
            Edit Budget
          </button>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <DollarSign className="h-6 w-6 mr-2 text-green-600" />
          Budget Details for {activity.name}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Required Budget Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Required Budget</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">With Tool:</span>
              <span className="font-medium">${estimated_cost_with_tool.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Without Tool:</span>
              <span className="font-medium">${estimated_cost_without_tool.toLocaleString()}</span>
            </div>
            <div className="pt-2 border-t border-gray-200">
              <div className="flex justify-between">
                <span className="font-medium text-gray-900">Total Required:</span>
                <span className="font-bold text-gray-900">${totalRequiredBudget.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Available Budget Section */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Available Budget</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Government Treasury:</span>
              <span className="font-medium">$ETB {government_treasury.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">SDG Funding:</span>
              <span className="font-medium">$ETB {sdg_funding.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Partners Funding:</span>
              <span className="font-medium">$ETB {partners_funding.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Other Funding:</span>
              <span className="font-medium">$ETB {other_funding.toLocaleString()}</span>
            </div>
            <div className="pt-2 border-t border-gray-200">
              <div className="flex justify-between">
                <span className="font-medium text-gray-900">Total Available:</span>
                <span className="font-bold text-gray-900">$ETB {totalAvailableBudget.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Budget Gap Summary */}
      <div className={`mt-6 p-4 rounded-lg ${budgetGap > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Budget Gap</h3>
          <span className={`text-xl font-bold ${budgetGap > 0 ? 'text-red-600' : 'text-green-600'}`}>
            $ETB {Math.abs(budgetGap).toLocaleString()}
          </span>
        </div>
        <p className={`mt-2 text-sm ${budgetGap > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {budgetGap > 0
            ? 'There is a funding gap. Additional funding sources may be needed.'
            : 'The budget is fully funded.'}
        </p>
      </div>
    </div>
  );
};

export default ActivityBudgetDetails;
import React from 'react';
import { DollarSign, Edit, Lock } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { ActivityBudget } from '../types/plan';

interface ActivityBudgetSummaryProps {
  budget: ActivityBudget;
  onEdit: () => void;
  isReadOnly?: boolean;
}

const ActivityBudgetSummary: React.FC<ActivityBudgetSummaryProps> = ({ budget, onEdit, isReadOnly = false }) => {
  const { t } = useLanguage();
  
  // Calculate totals
  const totalRequiredBudget = Math.max(budget.estimated_cost_with_tool, budget.estimated_cost_without_tool);
  const totalAvailableBudget = budget.government_treasury + budget.sdg_funding + budget.partners_funding + budget.other_funding;
  const budgetGap = totalRequiredBudget - totalAvailableBudget;

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <DollarSign className="h-5 w-5 mr-1 text-blue-600" />
          {t('planning.budget.budgetSummary')}
        </h3>
        {isReadOnly ? (
          <div className="flex items-center text-gray-500 text-sm">
            <Lock className="h-4 w-4 mr-1" />
            {t('planning.permissions.readOnly')}
          </div>
        ) : (
          <button
            onClick={onEdit}
            className="p-1 text-blue-600 hover:text-blue-800 flex items-center text-sm"
          >
            <Edit className="h-4 w-4 mr-1" />
            {t('planning.budget.editBudget')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-50 p-3 rounded-md">
          <h4 className="text-sm font-medium text-gray-700 mb-2">{t('planning.budget.requiredBudget')}</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">{t('planning.budget.estimatedCostWithTool')}:</span>
              <span className="text-sm font-medium">${budget.estimated_cost_with_tool.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">{t('planning.budget.estimatedCostWithoutTool')}:</span>
              <span className="text-sm font-medium">${budget.estimated_cost_without_tool.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700">{t('planning.budget.totalRequired')}:</span>
              <span className="text-sm font-bold">${totalRequiredBudget.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-md">
          <h4 className="text-sm font-medium text-gray-700 mb-2">{t('planning.budget.availableBudget')}</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">{t('planning.budget.governmentTreasury')}:</span>
              <span className="text-sm font-medium">${budget.government_treasury.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">{t('planning.budget.sdgFunding')}:</span>
              <span className="text-sm font-medium">${budget.sdg_funding.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">{t('planning.budget.partnersFunding')}:</span>
              <span className="text-sm font-medium">${budget.partners_funding.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">{t('planning.budget.otherFunding')}:</span>
              <span className="text-sm font-medium">${budget.other_funding.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-700">{t('planning.budget.totalAvailable')}:</span>
              <span className="text-sm font-bold">${totalAvailableBudget.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={`p-3 rounded-md ${budgetGap > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
        <div className="flex justify-between items-center">
          <span className={`text-sm font-medium ${budgetGap > 0 ? 'text-red-700' : 'text-green-700'}`}>
            {t('planning.budget.budgetGap')}:
          </span>
          <span className={`text-lg font-bold ${budgetGap > 0 ? 'text-red-700' : 'text-green-700'}`}>
            ${Math.abs(budgetGap).toLocaleString()}
          </span>
        </div>
        <p className={`text-xs mt-1 ${budgetGap > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {budgetGap > 0 
            ? t('planning.budget.budgetGapWarning')
            : t('planning.budget.budgetFullyFunded')}
        </p>
      </div>
    </div>
  );
};

export default ActivityBudgetSummary;
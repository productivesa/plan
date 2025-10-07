import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { Loader, ArrowLeft, DollarSign, AlertCircle, Info, Plus, Trash2, Users, CheckCircle } from 'lucide-react';
import type { MainActivity, ActivityType, BudgetCalculationType } from '../types/plan';

interface ActivityBudgetFormProps {
  activity: MainActivity;
  budgetCalculationType?: BudgetCalculationType;
  activityType?: ActivityType | null;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
  costingToolData?: any;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const ActivityBudgetForm: React.FC<ActivityBudgetFormProps> = ({
  activity,
  budgetCalculationType = 'WITHOUT_TOOL',
  activityType,
  onSubmit,
  initialData,
  costingToolData,
  onCancel,
  isSubmitting = false
}) => {
  const { t } = useLanguage();
  const [partners, setPartners] = useState<{name: string, amount: number}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isBudgetSubmitting, setIsBudgetSubmitting] = useState(false);
  const [initialRender, setInitialRender] = useState(true); // Added missing state
  
  // Use costing tool data if available, otherwise fall back to initialData
  const effectiveInitialData = costingToolData || initialData;
  
  console.log("ActivityBudgetForm data sources:", {
    costingToolData: costingToolData ? 'available' : 'none',
    initialData: initialData ? 'available' : 'none',
    effectiveData: effectiveInitialData ? 'using' : 'none'
  });
  
  const effectiveEstimatedCost = budgetCalculationType === 'WITH_TOOL' 
    ? (effectiveInitialData?.totalBudget || effectiveInitialData?.estimated_cost_with_tool || 0) 
    : (effectiveInitialData?.estimated_cost_without_tool || 0);
  
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<any>({
    defaultValues: {
      activity: activity.id,
      budget_calculation_type: budgetCalculationType,
      activity_type: activityType,
      estimated_cost_with_tool: effectiveInitialData?.totalBudget || effectiveInitialData?.estimated_cost_with_tool || 0,
      estimated_cost_without_tool: effectiveInitialData?.estimated_cost_without_tool || 0,
      government_treasury: effectiveInitialData?.government_treasury || 0,
      sdg_funding: effectiveInitialData?.sdg_funding || 0,
      partners_funding: effectiveInitialData?.partners_funding || 0,
      other_funding: effectiveInitialData?.other_funding || 0,
      training_details: effectiveInitialData?.training_details,
      meeting_workshop_details: effectiveInitialData?.meeting_workshop_details,
      procurement_details: effectiveInitialData?.procurement_details,
      printing_details: effectiveInitialData?.printing_details,
      supervision_details: effectiveInitialData?.supervision_details
    }
  });

  // Watch values for calculations
  const governmentTreasury = Number(watch('government_treasury')) || 0;
  const sdgFunding = Number(watch('sdg_funding')) || 0;
  const partnersFunding = Number(watch('partners_funding')) || 0;
  const otherFunding = Number(watch('other_funding')) || 0;
  const withToolCost = Number(watch('estimated_cost_with_tool')) || 0;
  const withoutToolCost = Number(watch('estimated_cost_without_tool')) || 0;

  // Calculate partners funding from partners array
  const calculatedPartnersFunding = partners.reduce((sum, partner) => {
    return sum + (Number(partner.amount) || 0);
  }, 0);

  // Update the form field whenever partners change
  useEffect(() => {
    setValue('partners_funding', calculatedPartnersFunding);
  }, [calculatedPartnersFunding, setValue]);

  // Make sure the correct estimated cost is set on initial render
  useEffect(() => {
    if (initialRender) {
      if (budgetCalculationType === 'WITH_TOOL' && initialData?.estimated_cost_with_tool) {
        console.log('Setting initial WITH_TOOL cost (initialData.estimated_cost_with_tool):', initialData.estimated_cost_with_tool);
        setValue('estimated_cost_with_tool', initialData.estimated_cost_with_tool, { shouldValidate: true, shouldDirty: true });
      } else if (budgetCalculationType === 'WITH_TOOL' && initialData?.totalBudget) {
        console.log('Setting initial WITH_TOOL cost from totalBudget:', initialData.totalBudget);
        setValue('estimated_cost_with_tool', initialData.totalBudget, { shouldValidate: true, shouldDirty: true });
      } else if (budgetCalculationType === 'WITH_TOOL') {
        // Last resort: check if there's any budget value we can use
        const possibleBudgetValue = initialData?.estimated_cost || 
                                    initialData?.training_details?.totalBudget || 
                                    initialData?.meeting_workshop_details?.totalBudget ||
                                    initialData?.printing_details?.totalBudget ||
                                    initialData?.procurement_details?.totalBudget ||
                                    initialData?.supervision_details?.totalBudget;
        
        if (possibleBudgetValue && possibleBudgetValue > 0) {
          console.log('Setting initial WITH_TOOL cost from alternative source:', possibleBudgetValue);
          setValue('estimated_cost_with_tool', possibleBudgetValue, { shouldValidate: true, shouldDirty: true });
        }
      }
      
      if (budgetCalculationType === 'WITHOUT_TOOL' && initialData?.estimated_cost_without_tool) {
        console.log('Setting initial WITHOUT_TOOL cost (initialData.estimated_cost_without_tool):', initialData.estimated_cost_without_tool);
        setValue('estimated_cost_without_tool', initialData.estimated_cost_without_tool, { shouldValidate: true, shouldDirty: true });
      }
      
      setInitialRender(false);
    }
  }, [initialRender, budgetCalculationType, initialData, setValue]); // Fixed dependencies

  // Initialize partners if they exist in the initial data
  useEffect(() => {
    if (effectiveInitialData?.partners_list && Array.isArray(effectiveInitialData.partners_list) && effectiveInitialData.partners_list.length > 0) {
      setPartners(effectiveInitialData.partners_list);
    } else if (effectiveInitialData?.partners_funding && Number(effectiveInitialData.partners_funding) > 0) {
      // If we have partners_funding but no partners_list, create a default entry
      setPartners([
        { name: 'Partners Funding', amount: Number(effectiveInitialData.partners_funding) }
      ]);
    } else {
      // Set default partners if none exist
      setPartners([
        { name: 'WHO', amount: 0 },
        { name: 'UNICEF', amount: 0 },
        { name: 'USAID', amount: 0 }
      ]);
    }
  }, [effectiveInitialData]);

  // Calculate totals
  // Make sure we have valid numeric values
  const totalFunding = (governmentTreasury || 0) + (sdgFunding || 0) + 
                        (calculatedPartnersFunding || 0) + (otherFunding || 0);
  
  // Calculate estimated cost based on budget type, ensuring we get a positive number
  const estimatedCost = budgetCalculationType === 'WITH_TOOL' 
    ? Math.max(withToolCost || 0, effectiveInitialData?.totalBudget || 0, effectiveInitialData?.estimated_cost_with_tool || 0)
    : Math.max(withoutToolCost || 0, effectiveInitialData?.estimated_cost_without_tool || 0);
              
  const fundingGap = Math.max(0, estimatedCost - totalFunding);

  console.log("Budget calculations:", {
    budgetCalculationType,
    effectiveEstimatedCost,
    totalFunding,
    fundingGap,
    partners: partners.length
  });

  const handleFormSubmit = async (data: any) => {
    try {
      setError(null);
      setIsBudgetSubmitting(true);

      // Validate estimated cost
      if (estimatedCost <= 0) {
        setError(`Estimated cost must be greater than 0. Please use the costing tool or enter a valid amount.`);
        setIsBudgetSubmitting(false);
        return;
      }

      // Calculate total partners funding
      let totalPartnersFunding = 0;
      partners.forEach(partner => {
        totalPartnersFunding += Number(partner.amount) || 0;
      });

      // Update the partners funding field with calculated value
      data.partners_funding = calculatedPartnersFunding;
      
      // Store the partners list in the budget data
      data.partners_list = partners;
      
      // Validate total funding against estimated cost
      const updatedTotalFunding = Number(data.government_treasury || 0) +
                                Number(data.sdg_funding || 0) +
                                calculatedPartnersFunding +
                                Number(data.other_funding || 0);
                                
      if (updatedTotalFunding > estimatedCost) {
        setError('Total funding cannot exceed estimated cost');
        setIsBudgetSubmitting(false);
        return;
      }

      // Prepare budget data for SubActivity model (new structure)
      const budgetData = {
        main_activity: activity.id,
        name: costingToolData?.description || data.name || `${activityType} Activity`,
        activity_type: activityType || 'Other',
        description: costingToolData?.description || data.description || '',
        
        // Budget calculation details
        budget_calculation_type: budgetCalculationType,
        estimated_cost_with_tool: Number(budgetCalculationType === 'WITH_TOOL' ? (costingToolData?.totalBudget || estimatedCost) : 0),
        estimated_cost_without_tool: Number(budgetCalculationType === 'WITHOUT_TOOL' ? estimatedCost : 0),
        
        // Funding sources
        government_treasury: Number(data.government_treasury || 0),
        sdg_funding: Number(data.sdg_funding || 0),
        partners_funding: Number(calculatedPartnersFunding),
        other_funding: Number(data.other_funding || 0),
        
        // Store tool-specific details
        partners_details: partners.length > 0 ? { partners_list: partners.filter(p => p.name && p.amount > 0) } : null,
        training_details: costingToolData?.training_details || data.training_details || initialData?.training_details,
        meeting_workshop_details: costingToolData?.meeting_workshop_details || data.meeting_workshop_details || initialData?.meeting_workshop_details,
        procurement_details: costingToolData?.procurement_details || data.procurement_details || initialData?.procurement_details,
        printing_details: costingToolData?.printing_details || data.printing_details || initialData?.printing_details,
        supervision_details: costingToolData?.supervision_details || data.supervision_details || initialData?.supervision_details
      };

      console.log("Submitting SubActivity budget data:", budgetData);

      // Submit budget data to parent component for saving
      await onSubmit(budgetData);
      
      console.log('Sub-activity budget saved successfully');
    } catch (error: any) {
      console.error('Error submitting budget form:', error);
      setError(error.message || 'Failed to save budget');
      setIsBudgetSubmitting(false);
    }
  };
  
  console.log('ActivityBudgetForm render with:', {
    budgetCalculationType,
    withToolCost,
    withoutToolCost,
    estimatedCost,
    initialData: initialData ? 
      `ID: ${initialData.id}, WITH_TOOL: ${initialData.estimated_cost_with_tool}, WITHOUT_TOOL: ${initialData.estimated_cost_without_tool}` : 
      'None'
  });
  
  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-h-[75vh] overflow-y-auto p-2 pb-20">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center text-gray-600 hover:text-gray-900"
          disabled={isSubmitting || isBudgetSubmitting}
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          Back
        </button>
        <div className="text-sm text-gray-500">
          Activity: {activity.name}
        </div>
      </div>

      {/* Store budget calculation type */}
      <input
        type="hidden"
        {...register('budget_calculation_type')}
        value={budgetCalculationType}
      />

      {/* Activity Type Display */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="text-sm font-medium text-blue-700 mb-4">Activity Information</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-blue-600">
            Activity Type
          </span>
          <span className="text-lg font-semibold text-blue-800">
            {activityType || 'Not specified'}
          </span>
        </div>
        {/* Store activity type as hidden input */}
        <input
          type="hidden"
          {...register('activity_type')}
          value={activityType || ''}
        />
      </div>

      {/* Estimated Cost Section */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Estimated Cost</h3>
        
        {budgetCalculationType === 'WITH_TOOL' ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">
                {activityType ? `Calculated using ${activityType} costing tool` : 'Calculated using costing tool'}
              </span>
              <span className="text-2xl font-bold text-green-600" data-testid="budget-amount">
                ${Number(effectiveEstimatedCost).toLocaleString()}
              </span>
            </div>
            <input
              type="hidden"
              {...register('estimated_cost_with_tool')}
              value={effectiveEstimatedCost}
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Manual Cost Estimation
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('estimated_cost_without_tool', {
                  required: 'This field is required',
                  min: { value: 0, message: 'Value must be positive' },
                  valueAsNumber: true
                })}
                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                placeholder="0.00"
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  console.log('Manual cost input changed to:', value);
                  setValue('estimated_cost_without_tool', value, { shouldValidate: true, shouldDirty: true });
                }}
              />
            </div>
            {errors.estimated_cost_without_tool && (
              <p className="mt-1 text-sm text-red-600">{errors.estimated_cost_without_tool.message}</p>
            )}
          </div>
        )}
      </div>

      {/* Funding Sources Section */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Funding Sources</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Government Treasury
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                step="0.01"
                {...register('government_treasury', {
                  required: 'This field is required',
                  min: { value: 0, message: 'Value must be positive' },
                  valueAsNumber: true
                })}
                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              SDG Funding
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                step="0.01"
                {...register('sdg_funding', {
                  required: 'This field is required',
                  min: { value: 0, message: 'Value must be positive' },
                  valueAsNumber: true
                })}
                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                placeholder="0.00"
              />
            </div>
          </div>

              {/* Partners funding section */}
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700 flex items-center">
                    <Users className="h-4 w-4 mr-1 text-blue-500" />
                    Partners Funding (Channels 2 & 3)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const updatedPartners = [...partners, { name: '', amount: 0 }];
                      let totalPartnersFunding = 0;
                      partners.forEach(partner => {
                        totalPartnersFunding += Number(partner.amount) || 0;
                      });
                      setPartners(updatedPartners);
                      // Force update the form field immediately
                      setValue('partners_funding', totalPartnersFunding);
                    }}
                    className="px-2 py-1 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50 flex items-center"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Partner
                  </button>
                </div>
                
                {/* Default Partners or Added Partners */}
                <div className="mt-2 space-y-3">
                  {partners.map((partner, index) => (
                    <div key={index} className="flex space-x-2 items-center">
                      <input
                        type="text"
                        value={partner.name}
                        onChange={(e) => {
                          const updatedPartners = [...partners];
                          updatedPartners[index].name = e.target.value;
                          setPartners(updatedPartners);
                        }}
                        placeholder="Partner name"
                        className="block w-1/2 px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                      <div className="relative rounded-md shadow-sm w-1/3">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={partner.amount}
                          onChange={(e) => {
                            const updatedPartners = [...partners];
                            updatedPartners[index].amount = Number(e.target.value);
                            setPartners(updatedPartners);
                            // Calculate and update total immediately
                            const newTotal = updatedPartners.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                            setValue('partners_funding', newTotal);
                          }}
                          className="block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updatedPartners = [...partners];
                          updatedPartners.splice(index, 1);
                          setPartners(updatedPartners);
                        }}
                        className="p-2 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Partners Total */}
                <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-sm">
                  <span className="font-medium text-gray-700">Total Partners Funding:</span>
                  <span className="font-medium text-blue-600">
                    ${calculatedPartnersFunding.toLocaleString()}
                  </span>
                </div>
                
                {/* Hidden field to store total partners funding */}
                <input
                  type="hidden"
                  {...register('partners_funding')}
                  value={calculatedPartnersFunding}
                />
              </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Other Funding
            </label>
            <div className="mt-1 relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 sm:text-sm">$</span>
              </div>
              <input
                type="number"
                step="0.01"
                {...register('other_funding', {
                  required: 'This field is required',
                  min: { value: 0, message: 'Value must be positive' },
                  valueAsNumber: true
                })}
                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Budget Summary */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-4">Budget Summary</h3>

        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-gray-700">Calculation Method:</h4>
          <span className="text-sm font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded">
            {budgetCalculationType === 'WITH_TOOL' ? 'Using Costing Tool' : 'Manual Entry'}
          </span>
          {budgetCalculationType === 'WITH_TOOL' && (
            <span className="text-sm font-medium bg-green-100 text-green-800 px-2 py-1 rounded ml-2">
              Activity Type: {activityType || 'Not specified'}
            </span>
          )}
        </div>

        {/* Debug Information - for troubleshooting only */}
        <div className="mb-4 text-xs text-gray-400 bg-gray-100 p-2 rounded">
          <div>Internal Values (Debug):</div>
          <div>budget_calculation_type: {budgetCalculationType}</div>
          <div>activity_type: {activityType}</div>
          <div>estimated_cost_with_tool: {initialData?.estimated_cost_with_tool || 0}</div>
          <div>estimated_cost_without_tool: {initialData?.estimated_cost_without_tool || 0}</div>
          <div>initial_with_tool: {initialData?.estimated_cost_with_tool || 'N/A'}</div> 
          <div>initial_totalBudget: {initialData?.totalBudget || initialData?.training_details?.totalBudget || 'N/A'}</div>
          <div>training_details_totalBudget: {initialData?.training_details?.totalBudget || 'N/A'}</div>
          <div>effective_estimated_cost: {estimatedCost}</div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Estimated Cost:</span>
            <span className="font-medium">${estimatedCost.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total Funding:</span>
            <span className="font-medium">${(governmentTreasury + sdgFunding + calculatedPartnersFunding + otherFunding).toLocaleString()}</span>
          </div>
          <div className="border-t border-gray-200 pt-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Funding Gap:</span>
              <span className={`font-medium ${fundingGap > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ${Math.abs(fundingGap).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {fundingGap > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-700">
              Additional funding of ${fundingGap.toLocaleString()} is needed
            </p>
          </div>
        )}

        {fundingGap < 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2">
            <Info className="h-5 w-5 text-amber-500" />
            <p className="text-sm text-amber-700">
              Total funding exceeds estimated cost by ${Math.abs(fundingGap).toLocaleString()}
            </p>
          </div>
        )}

        {fundingGap === 0 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <p className="text-sm text-green-700">
              Budget is fully funded
            </p>
          </div>
        )}

        {/* Detailed funding breakdown */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Funding Breakdown</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Government Treasury:</span>
              <span className="font-medium">${Number(governmentTreasury).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">SDG Funding:</span>
              <span className="font-medium">${Number(sdgFunding).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Partners Funding ({partners.length}):</span>
              <span className="font-medium">${calculatedPartnersFunding.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Other Funding:</span>
              <span className="font-medium">${Number(otherFunding).toLocaleString()}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total Available Funding:</span>
                <span className="font-medium text-blue-600">
                  ${(Number(governmentTreasury) + 
                    Number(sdgFunding) + 
                    calculatedPartnersFunding + 
                    Number(otherFunding)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting || isBudgetSubmitting}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || isBudgetSubmitting || totalFunding > estimatedCost}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isSubmitting || isBudgetSubmitting ? (
            <span className="flex items-center">
              <Loader className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </span>
          ) : (
            'Save Sub-Activity'
          )}
        </button>
      </div>
    </form>
  );
};

export default ActivityBudgetForm;
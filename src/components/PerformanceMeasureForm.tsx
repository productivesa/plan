import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { Loader, Info, Calendar, AlertCircle } from 'lucide-react';
import type { PerformanceMeasure, TargetType } from '../types/plan';
import { TARGET_TYPES, MONTHS, QUARTERS, Month, Quarter } from '../types/plan';

interface PerformanceMeasureFormProps {
  initiativeId: string;
  currentTotal: number;
  onSubmit: (data: Partial<PerformanceMeasure>) => Promise<void>;
  initialData?: PerformanceMeasure | null;
  onCancel: () => void;
}

const PerformanceMeasureForm: React.FC<PerformanceMeasureFormProps> = ({
  initiativeId,
  currentTotal,
  onSubmit,
  initialData,
  onCancel
}) => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initiativeWeight, setInitiativeWeight] = useState(100); // Default fallback value
  // Determine initial period type based on existing data
  const [periodType, setPeriodType] = useState<'months' | 'quarters'>(
    initialData?.selected_quarters?.length ? 'quarters' : 'months'
  );
  
  // Fetch initiative data to get its weight
  useEffect(() => {
    const fetchInitiativeData = async () => {
      try {
        const response = await fetch(`/api/strategic-initiatives/${initiativeId}/`);
        if (!response.ok) throw new Error('Failed to fetch initiative');
        const data = await response.json();
        if (data && data.weight) {
          // Ensure weight is a valid number
          const weight = parseFloat(data.weight);
          if (!isNaN(weight) && weight > 0) {
            setInitiativeWeight(weight);
            console.log(`Fetched initiative weight: ${weight}`);
          }
        }
      } catch (error) {
        console.error('Error fetching initiative:', error);
      }
    };
    
    if (initiativeId) {
      fetchInitiativeData();
    }
  }, [initiativeId]);
  
  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<Partial<PerformanceMeasure>>({
    defaultValues: initialData || {
      initiative: initiativeId,
      name: '',
      weight: 0,
      selected_months: [],
      selected_quarters: [],
      baseline: '',
      target_type: 'cumulative',
      q1_target: 0,
      q2_target: 0,
      q3_target: 0,
      q4_target: 0,
      annual_target: 0
    }
  });

  // Calculate expected performance measures weight and max allowed weight with safety checks
  // Expected weight is 35% of the initiative weight
  const safeInitiativeWeight = initiativeWeight || 35; // Fallback value
  const expectedMeasuresWeight = safeInitiativeWeight * 0.35;

  // Convert and validate all weight values
  const safeCurrentTotal = typeof currentTotal === 'number' && !isNaN(currentTotal) ? currentTotal : 0;
  const safeInitialWeight = initialData && typeof initialData.weight === 'number' && !isNaN(initialData.weight) 
    ? initialData.weight : 0;
  
  // Calculate max weight (prevent negative values)
  const maxWeight = Math.max(0, expectedMeasuresWeight - safeCurrentTotal + safeInitialWeight);
  
  // Calculate remaining weight
  const remainingWeight = Math.max(0, expectedMeasuresWeight - safeCurrentTotal);
  
  console.log('Weight calculations:', {
    initiativeWeight: safeInitiativeWeight,
    expectedMeasuresWeight,
    currentTotal: safeCurrentTotal,
    initialWeight: safeInitialWeight,
    maxWeight,
    remainingWeight
  });
  
  // Watch target fields
  const targetType = watch('target_type') as TargetType;
  const baseline = watch('baseline') || '';
  const q1Target = Number(watch('q1_target')) || 0;
  const q2Target = Number(watch('q2_target')) || 0;
  const q3Target = Number(watch('q3_target')) || 0;
  const q4Target = Number(watch('q4_target')) || 0;
  const annualTarget = Number(watch('annual_target')) || 0;
  
  // Watch for period selection
  const selectedMonths = watch('selected_months') || [];
  const selectedQuarters = watch('selected_quarters') || [];
  const hasPeriodSelected = selectedMonths.length > 0 || selectedQuarters.length > 0;
  
  // Calculate 6-month target (based on target type)
  const sixMonthTarget = targetType === 'cumulative' ? q1Target + q2Target : q2Target;
  
  // Calculate 9-month target (based on target type)
  const nineMonthTarget = targetType === 'cumulative' ? q1Target + q2Target + q3Target : q3Target;
  
  // Calculate yearly target (either sum or Q4, depending on target type)
  const calculatedYearlyTarget = targetType === 'cumulative' 
    ? q1Target + q2Target + q3Target + q4Target 
    : targetType === 'constant' 
      ? (q1Target === q2Target && q2Target === q3Target && q3Target === q4Target && q1Target === annualTarget ? annualTarget : 0)
      : q4Target;

  // Validate targets based on target type
  useEffect(() => {
    const baselineValue = baseline ? Number(baseline) : null;
    
    if (targetType === 'cumulative') {
      // Sum of quarterly targets should equal annual target
      const quarterly_sum = q1Target + q2Target + q3Target + q4Target;
      if (quarterly_sum !== annualTarget) {
        setError(`For cumulative targets, sum of quarterly targets (${quarterly_sum}) must equal annual target (${annualTarget})`);
        return;
      }
    } else if (targetType === 'increasing') {
      // Q1 must be greater than or equal to baseline
      if (baselineValue !== null && !(q1Target >= baselineValue)) {
        setError(`For increasing targets, Q1 target (${q1Target}) must be greater than or equal to baseline (${baselineValue})`);
        return;
      }
      // Targets should be in ascending order and Q4 should equal annual target
      if (!(q1Target <= q2Target && q2Target <= q3Target && q3Target <= q4Target)) {
        setError('For increasing targets, quarterly targets must be in ascending order (Q1 ≤ Q2 ≤ Q3 ≤ Q4)');
        return;
      }
      // Q4 must equal annual target
      if (q4Target !== annualTarget) {
        setError(`For increasing targets, Q4 target (${q4Target}) must equal annual target (${annualTarget})`);
        return;
      }
    } else if (targetType === 'decreasing') {
      // Q1 must be less than or equal to baseline
      if (baselineValue !== null &&  !(q1Target <= baselineValue)) {
        setError(`For decreasing targets, Q1 target (${q1Target}) must be less than or equal to baseline (${baselineValue})`);
        return;
      }
      // Targets should be in descending order and Q4 should equal annual target
      if (!(q1Target >= q2Target && q2Target >= q3Target && q3Target >= q4Target)) {
        setError('For decreasing targets, quarterly targets must be in descending order (Q1 ≥ Q2 ≥ Q3 ≥ Q4)');
        return;
      }
      // Q4 must equal annual target
      if (q4Target !== annualTarget) {
        setError(`For decreasing targets, Q4 target (${q4Target}) must equal annual target (${annualTarget})`);
        return;
      }
    } else if (targetType === 'constant') {
      // All quarterly targets must equal annual target
      if (!(q1Target === q2Target && q2Target === q3Target && q3Target === q4Target && q1Target === annualTarget)) {
        setError(`For constant targets, all quarterly targets must equal annual target (Q1=Q2=Q3=Q4=${annualTarget})`);
        return;
      }
    }
    
    // If we get here, validation passed
    setError(null);
  }, [targetType, baseline, q1Target, q2Target, q3Target, q4Target, annualTarget]);

  // Handle target type change
  useEffect(() => {
    // Target type change validation only - no automatic value setting
    // Planners must manually input all quarter values
    setError(null);
  }, [targetType]);

  const handleFormSubmit = async (data: Partial<PerformanceMeasure>) => {
    if (!hasPeriodSelected) {
      setError('Please select at least one period');
      return;
    }

    if (!data.name?.trim()) {
      setError('Activity name is required');
      return;
    }

    if (!data.weight || data.weight <= 0 || data.weight > maxWeight) {
      setError(`Weight must be between 0 and ${maxWeight}`);
      return;
    }

    // Validate targets based on target type
    const targetType = data.target_type as TargetType;
    const q1 = Number(data.q1_target) || 0;
    const q2 = Number(data.q2_target) || 0;
    const q3 = Number(data.q3_target) || 0;
    const q4 = Number(data.q4_target) || 0;
    const annual = Number(data.annual_target) || 0;
    const baseline = data.baseline ? Number(data.baseline) : null;
    
    if (targetType === 'cumulative') {
      // Sum of quarterly targets should equal annual target
      const sum = q1 + q2 + q3 + q4;
      if (sum !== annual) {
        setError(`For cumulative targets, sum of quarterly targets (${sum}) must equal annual target (${annual})`);
        return;
      }
    } else if (targetType === 'increasing') {
      // Q1 must be greater than or equal to baseline
      if (baseline !== null && !(q1 >= baseline)) {
        setError(`For increasing targets, Q1 target (${q1}) must be greater than or equal to baseline (${baseline})`);
        return;
      }
      // Targets should be in ascending order
      if (!(q1 <= q2 && q2 <= q3 && q3 <= q4)) {
        setError('For increasing targets, quarterly targets must be in ascending order (Q1 ≤ Q2 ≤ Q3 ≤ Q4)');
        return;
      }
      // Q4 must equal annual target
      if (q4 !== annual) {
        setError(`For increasing targets, Q4 target (${q4}) must equal annual target (${annual})`);
        return;
      }
    } else if (targetType === 'decreasing') {
      // Q1 must be less than or equal to baseline
      if (baseline !== null && !(q1 <= baseline)) {
        setError(`For decreasing targets, Q1 target (${q1}) must be less than or equal to baseline (${baseline})`);
        return;
      }
      // Targets should be in descending order
      if (!(q1 >= q2 && q2 >= q3 && q3 >= q4)) {
        setError('For decreasing targets, quarterly targets must be in descending order (Q1 ≥ Q2 ≥ Q3 ≥ Q4)');
        return;
      }
      // Q4 must equal annual target
      if (q4 !== annual) {
        setError(`For decreasing targets, Q4 target (${q4}) must equal annual target (${annual})`);
        return;
      }
    } else if (targetType === 'constant') {
      // All quarters must be equal
      if (!(q1Target === q2Target && q2Target === q3Target && q3Target === q4Target)) {
        setError(`For constant targets, all quarterly targets must be equal (Q1=Q2=Q3=Q4)`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      const measureData = {
        ...data,
        // Only include the selected period type's data
        selected_months: periodType === 'months' ? data.selected_months : [],
        selected_quarters: periodType === 'quarters' ? data.selected_quarters : [],
        // Make sure we send the initiative ID as a string
        initiative: initiativeId.toString()
      };
      
      await onSubmit(measureData);
    } catch (error) {
      console.error('Error submitting form:', error);
      setError('Failed to save performance measure. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePeriodType = () => {
    // Clear selections when switching period type
    if (periodType === 'months') {
      setValue('selected_months', []);
      setPeriodType('quarters');
    } else {
      setValue('selected_quarters', []);
      setPeriodType('months');
    }
    setError(null);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Instructions based on target type */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="text-sm font-medium text-blue-700 mb-2 flex items-center">
          <Info className="h-4 w-4 mr-1 text-blue-500" />
          Performance Measure Guidelines
        </h4>
        
        <div className="mt-2 text-xs text-blue-600 space-y-2">
          {targetType === 'constant' && (
            <>
              <p><strong>Constant Target:</strong> All quarterly values must equal the annual target (Q1=Q2=Q3=Q4=annual target).</p>
              <p className="ml-4">Example: If annual target=50, you must set Q1=50, Q2=50, Q3=50, Q4=50.</p>
            </>
          )}
          
          {targetType === 'increasing' && (
            <>
              <p><strong>Increasing Target:</strong> Q1 must be greater than or equal to baseline, quarterly values must increase (Q1≤Q2≤Q3≤Q4) and Q4 must equal the annual target.</p>
              <p className="ml-4">Example: If baseline=25 and annual target=100, you might set Q1=25, Q2=50, Q3=75, Q4=100.</p>
            </>
          )}
            
          {targetType === 'decreasing' && (
            <>
              <p><strong>Decreasing Target:</strong> Q1 must be less than or equal to baseline, quarterly values must decrease (Q1≥Q2≥Q3≥Q4) and Q4 must equal the annual target.</p>
              <p className="ml-4">Example: If baseline=100 and annual target=25, you might set Q1=100, Q2=75, Q3=50, Q4=25.</p>
            </>
          )}
          
          {targetType === 'cumulative' && (
            <>
              <p><strong>Cumulative Target:</strong> The sum of all quarters (Q1+Q2+Q3+Q4) must equal the annual target.</p>
              <p className="ml-4">Example: If annual target=100, you might set Q1=20, Q2=30, Q3=25, Q4=25.</p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('planning.measureName')}
        </label>
        <p className="text-xs text-gray-500 mb-1">Enter a clear, specific name for what this measure tracks</p>
        <input
          type="text"
          {...register('name', { 
            required: 'Performance measure name is required',
            minLength: { value: 3, message: 'Name must be at least 3 characters' }
          })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Enter a descriptive name for this measure"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Choose a name that clearly indicates what is being measured
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Choose a name that clearly indicates what is being measured
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('planning.weight')} <span className="text-blue-600">(Maximum: {maxWeight.toFixed(2)}%)</span>
        </label>
        <div className="mt-1 relative rounded-md shadow-sm mb-1">
          <input
            type="number"
            step="0.01"
            {...register('weight', {
              required: 'Weight is required',
              min: { value: 0.01, message: 'Weight must be greater than 0' },
              max: { value: maxWeight, message: `Weight cannot exceed ${maxWeight}` },
              valueAsNumber: true
            })}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Enter weight percentage"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-500">
            <span className="text-gray-500 sm:text-sm">%</span>
          </div>
        </div>
        {errors.weight && (
          <p className="mt-1 text-sm text-red-600">{errors.weight.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-600 flex items-center flex-wrap">
          <Info className="h-3.5 w-3.5 mr-1 text-blue-500 flex-shrink-0" />
          <span>Performance measures must have a combined weight of exactly {expectedMeasuresWeight.toFixed(2)}% 
          (35% of initiative weight {safeInitiativeWeight}%).</span>
        </p>
        <p className="mt-1 text-xs text-blue-600 font-medium">
          Current total: {safeCurrentTotal.toFixed(2)}% | 
          Remaining: {remainingWeight.toFixed(2)}% |
          Your maximum: {maxWeight.toFixed(2)}%
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t('planning.baseline')} <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-1">Current starting value before implementation (required)</p>
        <input
          type="text"
          {...register('baseline', { 
            required: 'Baseline is required',
            minLength: { value: 1, message: 'Baseline cannot be empty' }
          })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Enter baseline value"
        />
        {errors.baseline && (
          <p className="mt-1 text-sm text-red-600">{errors.baseline.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          The starting point against which progress will be measured
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-gray-700">
            <span className="flex items-center gap-2 mb-1">
              <Calendar className="h-5 w-5 text-gray-400" />
              {t('planning.period')}
            </span>
            <span className="text-xs font-normal text-gray-500 block mt-1">
              Select the time periods when this measure will be tracked
            </span>
          </label>
          <button
            type="button"
            onClick={togglePeriodType}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1 bg-blue-50 rounded-md"
          >
            Switch to {periodType === 'months' ? 'Quarters' : 'Months'}
          </button>
        </div>

        {periodType === 'months' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {MONTHS.map((month) => (
              <label
                key={month.value}
                className="relative flex items-center p-3 rounded-lg border border-gray-200 hover:border-blue-400 cursor-pointer"
              >
                <Controller
                  name="selected_months"
                  control={control}
                  defaultValue={[]}
                  render={({ field }) => (
                    <input
                      type="checkbox"
                      value={month.value}
                      checked={field.value?.includes(month.value)}
                      onChange={(e) => {
                        const value = e.target.value as Month;
                        const currentValues = field.value || [];
                        field.onChange(
                          e.target.checked
                            ? [...currentValues, value]
                            : currentValues.filter((v) => v !== value)
                        );
                      }}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  )}
                />
                <span className="ml-3 text-sm font-medium text-gray-900">
                  {month.label}
                  <span className="block text-xs text-gray-500">
                    {month.quarter}
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {QUARTERS.map((quarter) => (
              <label
                key={quarter.value}
                className="relative flex items-center p-4 rounded-lg border border-gray-200 hover:border-blue-400 cursor-pointer"
              >
                <Controller
                  name="selected_quarters"
                  control={control}
                  defaultValue={[]}
                  render={({ field }) => (
                    <input
                      type="checkbox"
                      value={quarter.value}
                      checked={field.value?.includes(quarter.value)}
                      onChange={(e) => {
                        const value = e.target.value as Quarter;
                        const currentValues = field.value || [];
                        field.onChange(
                          e.target.checked
                            ? [...currentValues, value]
                            : currentValues.filter((v) => v !== value)
                        );
                      }}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                  )}
                />
                <span className="ml-3">
                  <span className="block text-sm font-medium text-gray-900">
                    {quarter.label}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {quarter.months.join(', ')}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        {!hasPeriodSelected && (
          <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-200 flex items-center">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>Please select at least one {periodType === 'months' ? 'month' : 'quarter'} when this measure will be tracked</span>
          </p>
        )}
      </div>

      <div className="border-t border-gray-200 pt-4">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Target Type
          </label>
          <p className="text-xs text-gray-500 mb-1">How targets are calculated across quarters</p>
          <select
            {...register('target_type')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {TARGET_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 flex items-center">
            <Info className="h-4 w-4 mr-1 text-blue-500" />
            {TARGET_TYPES.find(t => t.value === targetType)?.description}
          </p>
        </div>
        
        <h3 className="text-lg font-medium text-gray-900 mb-4">{t('planning.targets')}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('planning.annualTarget')}
            </label>
            <p className="text-xs text-gray-500 mb-1">The target to reach by the end of the fiscal year</p>
            <input
              type="number"
              step="0.01"
              {...register('annual_target', {
                required: true,
                min: 0,
                valueAsNumber: true
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('planning.q1Target')}
            </label>
            <p className="text-xs text-gray-500 mb-1">Target for July - September</p>
            <input
              type="number"
              step="0.01"
              {...register('q1_target', {
                required: true,
                min: 0,
                valueAsNumber: true
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('planning.q2Target')}
            </label>
            <p className="text-xs text-gray-500 mb-1">Target for October - December</p>
            <input
              type="number"
              step="0.01"
              {...register('q2_target', {
                required: true,
                min: 0,
                valueAsNumber: true
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          
          <div className="bg-blue-50 p-3 rounded-md">
            <label className="block text-sm font-medium text-blue-700">
              6 Month Target {targetType === 'cumulative' ? '(Q1+Q2)' : '(Q2)'}
            </label>
            <div className="mt-1 text-lg font-medium text-blue-800">
              {sixMonthTarget}
            </div>
            <p className="mt-1 text-xs text-blue-600">
              {targetType === 'cumulative' 
                ? 'Sum of Q1 and Q2 targets' 
                : 'Equal to Q2 target'}
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('planning.q3Target')}
            </label>
            <p className="text-xs text-gray-500 mb-1">Target for January - March</p>
            <input
              type="number"
              step="0.01"
              {...register('q3_target', {
                required: true,
                min: 0,
                valueAsNumber: true
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          
          <div className="bg-blue-50 p-3 rounded-md">
            <label className="block text-sm font-medium text-blue-700">
              9 Month Target {targetType === 'cumulative' ? '(Q1+Q2+Q3)' : '(Q3)'}
            </label>
            <div className="mt-1 text-lg font-medium text-blue-800">
              {nineMonthTarget}
            </div>
            <p className="mt-1 text-xs text-blue-600">
              {targetType === 'cumulative' 
                ? 'Sum of Q1, Q2, and Q3 targets' 
                : 'Equal to Q3 target'}
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t('planning.q4Target')}
            </label>
            <p className="text-xs text-gray-500 mb-1">Target for April - June</p>
            <input
              type="number"
              step="0.01"
              {...register('q4_target', {
                required: true,
                min: 0,
                valueAsNumber: true
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          
          <div className={`p-3 rounded-md ${
            calculatedYearlyTarget === annualTarget ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <label className={`block text-sm font-medium ${
              calculatedYearlyTarget === annualTarget ? 'text-green-700' : 'text-red-700'
            }`}>
              Calculated Annual Target
            </label>
            <div className={`mt-1 text-lg font-medium ${
              calculatedYearlyTarget === annualTarget ? 'text-green-800' : 'text-red-800'
            }`}>
              {calculatedYearlyTarget}
            </div>
            {calculatedYearlyTarget !== annualTarget && (
              <p className="text-xs text-red-600 mt-1">
                {targetType === 'cumulative'
                  ? 'Sum of quarterly targets must equal annual target'
                  : targetType === 'constant'
                  ? 'All quarterly targets must equal annual target'
                  : 'Q4 target must equal annual target'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Hidden field for initiative - use toString() to ensure it's a string */}
      <input type="hidden" {...register('initiative')} value={initiativeId.toString()} />

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          disabled={calculatedYearlyTarget !== annualTarget || isSubmitting || !hasPeriodSelected}
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <Loader className="h-4 w-4 mr-2 animate-spin" />
              {t('common.saving')}
            </span>
          ) : (
            initialData ? t('common.update') : t('common.create')
          )}
        </button>
      </div>
    </form>
  );
};

export default PerformanceMeasureForm;

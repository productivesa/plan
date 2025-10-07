import React from 'react';
import { useForm } from 'react-hook-form';
import { Calculator, DollarSign, Save, Loader } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { CostingAssumption } from '../types/costing';
import { TRAINING_LOCATIONS, ACTIVITY_TYPES } from '../types/plan';

interface CostingAssumptionsFormProps {
  onSubmit: (data: Partial<CostingAssumption>) => Promise<void>;
  initialData?: CostingAssumption;
  isSubmitting?: boolean;
}

const COST_TYPES = [
  { value: 'per_diem', label: 'Per Diem' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'venue', label: 'Venue' },
  { value: 'transport_land', label: 'Land Transport' },
  { value: 'transport_air', label: 'Air Transport' },
  { value: 'participant_flash_disk', label: 'Flash Disk (per participant)' },
  { value: 'participant_stationary', label: 'Stationary (per participant)' },
  { value: 'session_flip_chart', label: 'Flip Chart (per session)' },
  { value: 'session_marker', label: 'Marker (per session)' },
  { value: 'session_toner_paper', label: 'Toner and Paper (per session)' }
];

const CostingAssumptionsForm: React.FC<CostingAssumptionsFormProps> = ({
  onSubmit,
  initialData,
  isSubmitting = false
}) => {
  const { t } = useLanguage();
  const { register, handleSubmit, formState: { errors } } = useForm<Partial<CostingAssumption>>({
    defaultValues: initialData || {
      activity_type: 'Training',
      location: 'Addis_Ababa',
      cost_type: 'per_diem',
      amount: 0
    }
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="text-lg font-medium text-blue-800 mb-2 flex items-center">
          <Calculator className="h-5 w-5 mr-2" />
          Activity Cost Assumption
        </h3>
        <p className="text-sm text-blue-600">
          Define cost assumptions for different activity types and locations.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Activity Type
        </label>
        <select
          {...register('activity_type', { required: 'Activity type is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          {ACTIVITY_TYPES.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        {errors.activity_type && (
          <p className="mt-1 text-sm text-red-600">{errors.activity_type.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Location
        </label>
        <select
          {...register('location', { required: 'Location is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          {TRAINING_LOCATIONS.map(location => (
            <option key={location.value} value={location.value}>
              {location.label}
            </option>
          ))}
        </select>
        {errors.location && (
          <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Cost Type
        </label>
        <select
          {...register('cost_type', { required: 'Cost type is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          {COST_TYPES.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        {errors.cost_type && (
          <p className="mt-1 text-sm text-red-600">{errors.cost_type.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Amount (ETB)
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <DollarSign className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="number"
            step="0.01"
            {...register('amount', {
              required: 'Amount is required',
              min: { value: 0, message: 'Amount must be positive' },
              valueAsNumber: true
            })}
            className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        {errors.amount && (
          <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          {...register('description')}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Optional description or notes about this cost assumption"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Assumption
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default CostingAssumptionsForm;
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { Loader, Info } from 'lucide-react';
import type { StrategicObjective } from '../types/organization';
import { programs } from '../lib/api';

interface ObjectiveFormProps {
  objective?: StrategicObjective | null;
  onSubmit: (data: Partial<StrategicObjective>) => Promise<void>;
  onCancel: () => void;
  currentTotalWeight?: number;
}

const ObjectiveForm: React.FC<ObjectiveFormProps> = ({
  objective,
  onSubmit,
  onCancel,
  currentTotalWeight = 0,
}) => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [relatedPrograms, setRelatedPrograms] = useState<any[]>([]);
  const [isSyncingPrograms, setIsSyncingPrograms] = useState(false);
  const [programUpdateMessage, setProgramUpdateMessage] = useState('');
  
  // Check if we're working with a default objective that has a planner_weight
  const hasCustomWeight = objective?.is_default && objective?.planner_weight !== undefined && objective?.planner_weight !== null;
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Partial<StrategicObjective>>({
    defaultValues: objective ? {
      title: objective.title,
      description: objective.description,
      // If this is a default objective with planner_weight, use that for the weight field
      weight: hasCustomWeight ? objective.planner_weight : objective.weight
    } : {
      title: '',
      description: '',
      weight: 0
    },
  });

  // Watch for weight changes
  const currentWeight = watch('weight');

  // Load any existing programs related to this objective
  useEffect(() => {
    if (objective?.id) {
      const loadPrograms = async () => {
        try {
          const response = await programs.getByObjective(objective.id.toString());
          if (response.data && Array.isArray(response.data)) {
            setRelatedPrograms(response.data);
          }
        } catch (error) {
          console.error('Failed to load programs:', error);
        }
      };
      loadPrograms();
    }
  }, [objective]);

  // Calculate the required weight to reach 100%
  const requiredWeight = 100 - (currentTotalWeight - (
    // If we're editing a default objective with planner_weight, use the planner_weight
    hasCustomWeight ? (objective?.planner_weight || 0) : (objective?.weight || 0)
  ));

  const handleFormSubmit = async (data: Partial<StrategicObjective>) => {
    setIsSubmitting(true);
    try {
      // If this is a default objective, keep the original weight and set planner_weight
      if (objective?.is_default) {
        console.log(`Updating default objective. Setting planner_weight to ${data.weight}`);
        // For default objectives, we're actually updating planner_weight
        data.planner_weight = data.weight;
        // Original weight should remain unchanged for default objectives
        data.weight = objective.weight;
      }
      
      console.log("Saving objective with data:", data);
      
      // First, save the objective
      await onSubmit(data);
      
      // For existing objectives with changed weight, update related programs
      if (objective?.id && data.weight !== objective.weight && relatedPrograms.length > 0) {
        setIsSyncingPrograms(true);
        setProgramUpdateMessage('Updating related programs...');
        
        // Update all related programs to match the new weight
        try {
          for (const program of relatedPrograms) {
            if (!program.id) continue;
            
            await programs.update(program.id.toString(), {
              name: program.name,
              description: program.description,
              strategic_objective: objective.id,
              is_default: program.is_default || false
            });
          }
          setProgramUpdateMessage('Related programs updated successfully');
        } catch (error) {
          console.error('Failed to update related programs:', error);
          setProgramUpdateMessage('Failed to update some related programs');
        } finally {
          setIsSyncingPrograms(false);
        }
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setProgramUpdateMessage('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {objective?.is_default && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center">
            <Info className="h-5 w-5 text-blue-500 mr-2" />
            <p className="text-sm text-blue-700">
              {hasCustomWeight 
                ? "You're editing your custom weight for this default objective. Original weight will be preserved."
                : "This is a default objective. Your changes will be stored as custom weights."
              }
            </p>
          </div>
          
          {relatedPrograms.length > 0 && (
            <div className="mt-2 text-sm text-blue-600">
              Related programs: {relatedPrograms.map(p => p.name).join(', ')}
            </div>
          )}
          
          {programUpdateMessage && (
            <div className="mt-2 text-sm font-medium text-blue-700">
              {programUpdateMessage}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          type="text"
          {...register('title', { required: 'Title is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
          disabled={objective?.is_default} // Make title read-only for default objectives
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          {...register('description', { required: 'Description is required' })}
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
          disabled={objective?.is_default} // Make description read-only for default objectives
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Weight (%) {objective?.is_default ? '- Custom Weight' : ''}
        </label>
        <input
          type="number"
          step="0.01"
          {...register('weight', {
            required: 'Weight is required',
            min: { value: 0, message: 'Weight must be greater than 0' },
            max: { value: 100, message: 'Weight cannot exceed 100' },
            valueAsNumber: true,
          })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
        />
        {errors.weight && (
          <p className="mt-1 text-sm text-red-600">{errors.weight.message}</p>
        )}
        
        {objective?.is_default && (
          <p className="mt-1 text-sm text-blue-600">
            Original weight: {objective.weight}% - Your custom weight: {hasCustomWeight ? objective.planner_weight : 'Not set'}%
          </p>
        )}
        
        {!objective && (
          <p className="mt-1 text-sm text-gray-500">
            The total weight of all strategic objectives must be exactly 100%. Current total: {currentTotalWeight}%
          </p>
        )}
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || isSyncingPrograms}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
        >
          {isSubmitting || isSyncingPrograms ? (
            <span className="flex items-center">
              <Loader className="h-4 w-4 mr-2 animate-spin" />
              {isSyncingPrograms ? 'Updating Programs...' : 'Saving...'}
            </span>
          ) : (
            objective ? 'Update' : 'Create'
          )}
        </button>
      </div>
    </form>
  );
};

export default ObjectiveForm;
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { performanceMeasures } from '../lib/api';
import { BarChart3, AlertCircle, CheckCircle, Edit, Trash2, Lock, PlusCircle, Info } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { PerformanceMeasure } from '../types/organization';
import { auth } from '../lib/api';
import { isPlanner } from '../types/user';

interface PerformanceMeasureListProps {
  initiativeId: string;
  initiativeWeight: number;
  onEditMeasure: (measure: PerformanceMeasure) => void;
  // onDeleteMeasure: (measureId: string) => void;
  onSelectMeasure?: (measure: PerformanceMeasure) => void;
  isNewPlan?: boolean;
  planKey?: string;
}

const PerformanceMeasureList: React.FC<PerformanceMeasureListProps> = ({ 
  initiativeId,
  initiativeWeight,
  onEditMeasure,
  // onDeleteMeasure,
  onSelectMeasure,
  isNewPlan = false,
  planKey = 'default'
}) => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [isUserPlanner, setIsUserPlanner] = React.useState(false);
  const [userOrgId, setUserOrgId] = React.useState<number | null>(null);
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Fetch current user role and organization
  React.useEffect(() => {
    const fetchUserData = async () => {
      try {
        const authData = await auth.getCurrentUser();
        setIsUserPlanner(isPlanner(authData.userOrganizations));
        
        if (authData.userOrganizations && authData.userOrganizations.length > 0) {
          setUserOrgId(authData.userOrganizations[0].organization);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };
    
    fetchUserData();
  }, []);

  // Fetch all performance measures for this initiative
  const { data: measuresList, isLoading } = useQuery({
    queryKey: ['performance-measures', initiativeId, planKey],
    queryFn: async () => {
      if (!initiativeId) {
        console.log('Missing initiativeId, cannot fetch performance measures');
        return { data: [] };
      }
      
      console.log(`Fetching performance measures for initiative ${initiativeId}`);
      const response = await performanceMeasures.getByInitiative(initiativeId);
      console.log('Fetched performance measures:', response.data);
      return response;
    },
    enabled: !!initiativeId,
    staleTime: 0,
    cacheTime: 0,
  });
  // ADDED: Delete mutation with optimistic updates
  const deleteMeasureMutation = useMutation({
    mutationFn: (measureId: string) => performanceMeasures.delete(measureId),
    onMutate: async (measureId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ 
        queryKey: ['performance-measures', initiativeId, planKey] 
      });

      // Snapshot the previous value
      const previousMeasures = queryClient.getQueryData<{ data: PerformanceMeasure[] }>(
        ['performance-measures', initiativeId, planKey]
      );

      // Optimistically update to the new value
      if (previousMeasures) {
        queryClient.setQueryData(
          ['performance-measures', initiativeId, planKey],
          {
            ...previousMeasures,
            data: previousMeasures.data.filter(measure => measure.id !== measureId)
          }
        );
      }

      return { previousMeasures };
    },
    onError: (err, measureId, context) => {
      console.error('Failed to delete performance measure:', err);
      // Rollback to previous state on error
      if (context?.previousMeasures) {
        queryClient.setQueryData(
          ['performance-measures', initiativeId, planKey],
          context.previousMeasures
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ 
        queryKey: ['performance-measures', initiativeId, planKey] 
      });
    }
  });

  // Filter measures based on user organization
  const filteredMeasures = React.useMemo(() => {
    if (!measuresList?.data) return [];
    
    return measuresList.data.filter(measure => 
      !measure.organization || measure.organization === userOrgId
    );
  }, [measuresList?.data, userOrgId]);

  // Calculate weight totals
  const totalMeasuresWeight = filteredMeasures.reduce((sum, measure) => 
    sum + (Number(measure.weight) || 0), 0
  );
  
  // Expected weight is 35% of initiative weight
  const expectedMeasuresWeight = parseFloat((initiativeWeight * 0.35).toFixed(2));
  const remainingWeight = parseFloat((expectedMeasuresWeight - totalMeasuresWeight).toFixed(2));
  
  // Check if weight is valid (within 0.01% tolerance for floating point comparison)
  const isWeightValid = Math.abs(totalMeasuresWeight - expectedMeasuresWeight) < 0.01;

  console.log('Weight calculations:', {
    initiativeWeight,
    expectedMeasuresWeight,
    totalMeasuresWeight,
    remainingWeight,
    isWeightValid
  });

  // Handle measure validation
  const handleValidateMeasures = () => {
    // Clear previous messages
    setValidationSuccess(null);
    setValidationError(null);
    
    console.log('Validating measures:', {
      totalWeight: totalMeasuresWeight,
      expectedWeight: expectedMeasuresWeight,
      isValid: isWeightValid
    });

    if (isWeightValid) {
      setValidationSuccess(`Performance measures weights are valid (${totalMeasuresWeight.toFixed(2)}%)`);
      // Clear success message after 3 seconds
      setTimeout(() => setValidationSuccess(null), 3000);
    } else {
      setValidationError(`Performance measures weights (${totalMeasuresWeight.toFixed(2)}%) must equal 35% of initiative weight (${expectedMeasuresWeight.toFixed(2)}%)`);
      // Clear error message after 5 seconds
      setTimeout(() => setValidationError(null), 5000);
    }
  };

  if (isLoading && initiativeId) {
    return <div className="text-center p-4">{t('common.loading')}</div>;
  }

  if (!measuresList?.data) {
    return null;
  }

  console.log('Performance measures data:', measuresList.data);
  console.log('Filtered measures:', filteredMeasures);

  // If there are no measures yet, show empty state
  if (filteredMeasures.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {t('planning.weightDistribution')}
            </h3>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-500">Initiative Weight</p>
              <p className="text-2xl font-semibold text-gray-900">{initiativeWeight}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Expected (35%)</p>
              <p className="text-2xl font-semibold text-blue-600">{expectedMeasuresWeight}%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Available</p>
              <p className="text-2xl font-semibold text-green-600">{expectedMeasuresWeight}%</p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700 flex items-center">
              <Info className="h-4 w-4 mr-2" />
              <strong>Important:</strong> Performance measures must have a combined weight of exactly {expectedMeasuresWeight}% 
              (35% of initiative weight {initiativeWeight}%).
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-gray-700">Performance Measures</h3>
        </div>

        <div className="text-center p-8 bg-white rounded-lg border-2 border-dashed border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Performance Measures Found</h3>
          <p className="text-gray-500 mb-4">
            No performance measures have been created yet for this initiative.
          </p>
          {isUserPlanner && (
            <button 
              onClick={() => onEditMeasure({} as PerformanceMeasure)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Performance Measure
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {t('planning.weightDistribution')}
          </h3>
          <BarChart3 className="h-5 w-5 text-gray-400" />
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-500">Initiative Weight</p>
            <p className="text-2xl font-semibold text-gray-900">{initiativeWeight}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Current Total</p>
            <p className="text-2xl font-semibold text-purple-600">{totalMeasuresWeight.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Remaining</p>
            <p className={`text-2xl font-semibold ${isWeightValid ? 'text-green-600' : remainingWeight < 0 ? 'text-red-600' : 'text-amber-600'}`}>
              {remainingWeight.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700 flex items-center">
            <Info className="h-4 w-4 mr-2" />
            <strong>Target:</strong> Performance measures must total exactly {expectedMeasuresWeight}% 
            (35% of initiative weight {initiativeWeight}%).
          </p>
        </div>

        {remainingWeight < 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">Over target by {Math.abs(remainingWeight).toFixed(1)}%. Please reduce existing measure weights.</p>
          </div>
        )}

        {isWeightValid && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <p className="text-sm">Weight distribution is perfect at {expectedMeasuresWeight}%</p>
          </div>
        )}

        {/* Validation Messages */}
        {validationSuccess && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <p className="text-sm">{validationSuccess}</p>
          </div>
        )}

        {validationError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{validationError}</p>
          </div>
        )}

        {isUserPlanner && (
          <div className="mt-4">
            <button
              onClick={handleValidateMeasures}
              disabled={filteredMeasures.length === 0}
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
            >
              Validate Performance Measures Weight
            </button>
          </div>
        )}
      </div>

      {/* Performance Measures List */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700 flex items-center">
          <span className="inline-flex items-center px-2.5 py-0.5 mr-2 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            Measures ({filteredMeasures.length})
          </span>
          Performance Measures
        </h3>
        
        {filteredMeasures.map((measure) => (
          <div
            key={measure.id}
            onClick={() => onSelectMeasure && onSelectMeasure(measure)}
            className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-purple-300 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <h4 className="font-medium text-gray-900">{measure.name}</h4>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium text-purple-600">
                  {measure.weight}%
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-xs text-gray-500">
              <div>Baseline: {measure.baseline || 'N/A'}</div>
              <div>Annual Target: {measure.annual_target || 0}</div>
              <div>Q1: {measure.q1_target || 0}</div>
              <div>Q2: {measure.q2_target || 0}</div>
              <div>Q3: {measure.q3_target || 0}</div>
              <div>Q4: {measure.q4_target || 0}</div>
            </div>
            
            <div className="flex justify-end mt-2">
              {isUserPlanner ? (
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditMeasure(measure);
                    }}
                    className="text-xs text-purple-600 hover:text-purple-800 flex items-center"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                    <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Are you sure you want to delete this performance measure?')) {
                      deleteMeasureMutation.mutate(measure.id); // UPDATED: Use mutation directly
                    }
                  }}
                  disabled={deleteMeasureMutation.isPending}
                  className="text-xs text-red-600 hover:text-red-800 flex items-center disabled:opacity-50"
                >
                  {deleteMeasureMutation.isPending ? (
                    <Loader className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  {deleteMeasureMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
                </div>
              ) : (
                <div className="text-xs text-gray-500 flex items-center">
                  <Lock className="h-3 w-3 mr-1" />
                  Read Only
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add measure button */}
      {isUserPlanner && (
        <div className="mt-4 text-center">
          <button 
            onClick={() => onEditMeasure({} as PerformanceMeasure)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            {filteredMeasures.length === 0 ? 'Create First Performance Measure' : 'Create New Performance Measure'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PerformanceMeasureList;

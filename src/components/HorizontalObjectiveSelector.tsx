import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { objectives, auth } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { AlertCircle, CheckCircle, Target, Plus, Minus, RefreshCw, Info, ArrowRight } from 'lucide-react';
import type { StrategicObjective } from '../types/organization';
import Cookies from 'js-cookie'; 
import { cn } from '../lib/utils';

// Function to get effective weight for an objective
const getEffectiveWeight = (objective: StrategicObjective): number => {
  // First check effective_weight, then planner_weight, then fall back to weight
  if (objective.effective_weight !== undefined) {
    return objective.effective_weight;
  } else if (objective.planner_weight !== undefined && objective.planner_weight !== null) {
    return objective.planner_weight;
  } else {
    return objective.weight;
  }
};

interface HorizontalObjectiveSelectorProps {
  onObjectivesSelected: (objectives: StrategicObjective[]) => void;
  onProceed: () => void;
  initialObjectives?: StrategicObjective[];
}

const HorizontalObjectiveSelector: React.FC<HorizontalObjectiveSelectorProps> = ({
  onObjectivesSelected,
  onProceed,
  initialObjectives = []
}) => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedObjectives, setSelectedObjectives] = useState<StrategicObjective[]>(initialObjectives);
  const [objectiveWeights, setObjectiveWeights] = useState<Record<string, number>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [totalWeight, setTotalWeight] = useState(0);
  const [isSavingWeights, setIsSavingWeights] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(initialObjectives.length === 0);
  const [lastSentData, setLastSentData] = useState<string>('');
  const [userOrgId, setUserOrgId] = useState<number | null>(null);
  
  // Fetch all objectives
  const { data: objectivesData, isLoading, error, refetch } = useQuery({
    queryKey: ['objectives', 'selector'],
    queryFn: async () => {
      try {
        const response = await objectives.getAll();
        return response;
      } catch (error) {
        console.error('Error fetching objectives:', error);
        throw error;
      }
    },
    retry: 2,
    retryDelay: 1000
  });

  // Get user organization ID for filtering
  useEffect(() => {
    const fetchUserOrg = async () => {
      try {
        const authData = await auth.getCurrentUser();
        if (authData.userOrganizations && authData.userOrganizations.length > 0) {
          setUserOrgId(authData.userOrganizations[0].organization);
        }
      } catch (error) {
        console.error('Failed to get user organization:', error);
      }
    };
    
    fetchUserOrg();
  }, []);

  // Mutation for updating objective weights
  const updateObjectiveMutation = useMutation({
    mutationFn: async (objective: Partial<StrategicObjective>) => {
      if (!objective.id) throw new Error("Missing objective ID");
      return objectives.update(objective.id.toString(), objective);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
    }
  });

  // Initialize objective weights from initial objectives
  useEffect(() => {
    if (initialObjectives.length > 0 && !hasInitialized) {
      const initialWeights: Record<string, number> = {};
      initialObjectives.forEach(obj => {
        if (obj && obj.id) {
          // Use the effective weight (planner_weight if available, otherwise weight)
          const effectiveWeight = obj.effective_weight || getEffectiveWeight(obj);
          initialWeights[obj.id] = effectiveWeight;
        }
      });
      setObjectiveWeights(initialWeights);
      
      // Ensure these objectives are shown as selected
      setSelectedObjectives(initialObjectives);
      setHasInitialized(true);
    }
  }, [initialObjectives, hasInitialized]);

  // Calculate total weight whenever objectiveWeights changes
  useEffect(() => {
    let total = 0;
    // Calculate total from the weights that the user has set
    selectedObjectives.forEach(obj => {
      const weight = objectiveWeights[obj.id] !== undefined ? 
                      objectiveWeights[obj.id] : 
                      obj.effective_weight || getEffectiveWeight(obj);
                      
      total += Number(weight);
    }); 
    setTotalWeight(total);
  }, [objectiveWeights, selectedObjectives]);
  
  // Validation and parent callback effect
  useEffect(() => {
    if (hasInitialized) {
      if (Math.abs(totalWeight - 100) < 0.01) { // Using a small epsilon for floating point comparison
        setValidationError(null);
        
        // Create objectives with updated weights
        const objectivesWithWeights = selectedObjectives.map(obj => {
          const userSetWeight = objectiveWeights[obj.id];
          const originalEffectiveWeight = obj.effective_weight || getEffectiveWeight(obj);
          const effectiveWeight = userSetWeight !== undefined ? userSetWeight : originalEffectiveWeight;
          
          return {
            ...obj,
            weight: obj.weight, // Keep original weight for default objectives
            planner_weight: effectiveWeight, // Use the newly set weight as planner_weight
            effective_weight: effectiveWeight // Set effective_weight for downstream components
          };
        });
        
        // Only call parent callback if data has actually changed
        const currentDataString = JSON.stringify(objectivesWithWeights.map(obj => ({
          id: obj.id,
          effective_weight: obj.effective_weight
        })));
        
        if (currentDataString !== lastSentData) {
          setLastSentData(currentDataString);
          onObjectivesSelected(objectivesWithWeights);
        }
      } else {
        setValidationError(`Total weight must be 100%. Current: ${totalWeight.toFixed(2)}%`);
      }
    } else {
      if (selectedObjectives.length === 0) {
        setValidationError(null);
        // Only call parent callback if we haven't sent empty array yet
        if (lastSentData !== '[]') {
          setLastSentData('[]');
          onObjectivesSelected([]);
        }
      }
    }
  }, [totalWeight, selectedObjectives, objectiveWeights, hasInitialized, lastSentData]);

  const handleSelectObjective = (objective: StrategicObjective) => {
    // Check if already selected
    const isSelected = selectedObjectives.some(obj => obj.id === objective.id);
    
    if (isSelected) {
      return; // Objective already selected
    }
    
    // Add to selected objectives
    const updatedObjectives = [...selectedObjectives, objective];
    setSelectedObjectives(updatedObjectives);

    // Set initial weight to the effective weight of the objective
    const effectiveWeight = objective.effective_weight || getEffectiveWeight(objective);
    setObjectiveWeights(prev => ({
      ...prev,
      [objective.id]: effectiveWeight
    }));
  };

  const handleRemoveObjective = (objectiveId: number | string) => {
    // Remove from selected objectives
    const updatedObjectives = selectedObjectives.filter(obj => obj.id !== objectiveId);
    setSelectedObjectives(updatedObjectives);
    
    // Remove weight for this objective
    setObjectiveWeights(prev => {
      const updated = { ...prev };
      delete updated[objectiveId];
      return updated;
    });
  };

  const handleWeightChange = (objectiveId: number | string, weight: number) => {
    // Update weight for this objective
    setObjectiveWeights(prev => {
      const newWeights = {
        ...prev,
        [objectiveId]: weight
      };
      return newWeights;
    });
  };

  // Auto-distribute weights to reach 100%
  const handleAutoDistribute = () => {
    if (selectedObjectives.length === 0) return;
    
    // Simple equal distribution (exact division)
    const equalWeight = 100 / selectedObjectives.length;
    
    const updatedWeights: Record<string, number> = {};
    
    // First assign all objectives the same weight
    selectedObjectives.forEach(obj => {
      updatedWeights[obj.id] = equalWeight;
    });
    
    setObjectiveWeights(updatedWeights);
  };

  const handleRetryLoading = () => {
    refetch();
  };

  // Save all objective weights to the database before proceeding
  const handleSaveAndProceed = async () => {
    if (selectedObjectives.length === 0 || Math.abs(totalWeight - 100) >= 0.01) {
      setValidationError("Please select objectives with a total weight of exactly 100% before proceeding");
      return;
    }
    
    setIsSavingWeights(true);
    setValidationError(null);
    
    try {
      // Clear any existing planner_weight values from objectives not selected
      try {
        const allObjectives = await objectives.getAll();
        const allObjectiveIds = allObjectives?.data?.map(obj => obj.id) || [];
        const selectedObjectiveIds = selectedObjectives.map(obj => obj.id);
        const unselectedObjectiveIds = allObjectiveIds.filter(id => !selectedObjectiveIds.includes(id));
        
        // Clear planner_weight for unselected objectives
        for (const objId of unselectedObjectiveIds) {
          try {
            const objectiveData = {
              id: objId,
              planner_weight: null, // Clear the planner weight
            };
            await updateObjectiveMutation.mutateAsync(objectiveData);
          } catch (err) {
            console.warn(`Failed to clear planner_weight for objective ${objId}:`, err);
            // Continue with other objectives even if one fails
          }
        }
      } catch (err) {
        console.warn("Failed to clear unselected objectives:", err);
        // Continue anyway - this is not critical
      }
      
      // Ensure we have a fresh CSRF token before making multiple API calls
      try {
        await auth.getCurrentUser();
      } catch (err) {
        console.warn("Failed to refresh CSRF token:", err);
        // Continue anyway - the API client should retry if needed
      }
      
      // Save each objective's weight to the database
      const savePromises = selectedObjectives.map(obj => {
        const newWeight = objectiveWeights[obj.id];
        const originalEffectiveWeight = getEffectiveWeight(obj);
        
        // Always save the planner weight for default objectives if they're selected
        if (obj.is_default) {
          const objectiveData = {
            id: obj.id,
            planner_weight: newWeight,
            // Include these fields to ensure they're not lost in the update
            title: obj.title,
            description: obj.description,
            weight: obj.weight,
            is_default: obj.is_default,
          };

          return updateObjectiveMutation.mutateAsync(objectiveData);
        }
        
        // For non-default objectives, update the weight directly
        if (!obj.is_default) {
          const objectiveData = {
            id: obj.id,
            weight: newWeight,
            planner_weight: null, // Custom objectives don't use planner_weight
            // Include these fields to ensure they're not lost in the update
            title: obj.title,
            description: obj.description,
            is_default: obj.is_default
          };

          return updateObjectiveMutation.mutateAsync(objectiveData);
        }

        return Promise.resolve(); // No update needed
      });
      
      try {
        // Wait for all saves to complete
        await Promise.all(savePromises);
        
        // Refresh objectives data to get updated weights
        await queryClient.invalidateQueries({ queryKey: ['objectives'] });
        
        // Now proceed to planning with the user's chosen weights
        onProceed();
      } catch (err) {
        console.error('Error saving one or more objectives:', err);
        setValidationError('Failed to save all objective weights. Please try again.');
        throw err;
      }
    } catch (error) {
      console.error('Failed to save objective weights:', error instanceof Error ? error.message : error);
      
      // Extract more detailed error message
      let errorMessage = 'Failed to save objective weights. Please try again.';
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setValidationError(errorMessage);
    } finally {
      setIsSavingWeights(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center p-4">Loading objectives...</div>
    );
  }

  if (error) {
    console.error("Error loading objectives:", error);
    return (
      <div className="p-8 bg-red-50 rounded-lg border border-red-200 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800 mb-2">Failed to load objectives</h3>
        <p className="text-red-600 mb-4">
          {error instanceof Error ? error.message : "An unexpected error occurred while loading objectives"}
        </p>
        <button
          onClick={handleRetryLoading}
         className="px-4 py-2 bg-white border border-red-300 rounded-md text-red-700 hover:bg-red-50 inline-flex items-center"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </button>
      </div>
    );
  }

  // Ensure we have valid objectives data
  const availableObjectives = objectivesData?.data || [];
  
  if (!Array.isArray(availableObjectives) || availableObjectives.length === 0) {
    return (
      <div className="p-8 bg-yellow-50 rounded-lg border border-yellow-200 text-center">
        <Info className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-yellow-800 mb-2">No objectives available</h3>
        <p className="text-yellow-600 mb-4">
          No strategic objectives were found in the system. Please contact an administrator to create some objectives first.
        </p>
      </div>
    );
  }

  // Filter out already selected objectives for the available list
  const unselectedObjectives = availableObjectives.filter(
    (obj: StrategicObjective) => {
      // Don't show if already selected
      if (selectedObjectives.some(selected => selected.id === obj.id)) {
        return false;
      }
      
      // Always show default objectives
      if (obj.is_default) return true;
      
      // For custom objectives, only show if they belong to the planner's organization
      if (!obj.is_default && obj.organization_id) {
        return Number(obj.organization_id) === Number(userOrgId);
      }
      
      // Show objectives with no organization (legacy)
      return !obj.organization_id;
    }
  );

  return (
    <div className="space-y-6">
      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <div className="flex items-center">
          <Info className="h-5 w-5 text-green-600 mr-2" />
          <p className="text-green-700 text-sm">
            Select strategic objectives for your plan and adjust their weights. 
            The total weight must equal exactly 100%. Weights will be saved before proceeding.
          </p>
        </div>
      </div>

      {/* Weight Summary */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="text-md font-medium text-gray-800 mb-4">Weight Distribution</h3>
        
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-500">Total Weight</p>
            <p className={`text-2xl font-semibold ${
              Math.abs(totalWeight - 100) < 0.01 ? 'text-green-600' : 'text-blue-600'
            }`}>
              {totalWeight.toFixed(2)}%
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Required</p>
            <p className="text-2xl font-semibold text-gray-900">100%</p>
          </div>
        </div>

        {validationError && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <p className="text-sm text-amber-700">{validationError}</p>
          </div>
        )}

        {!validationError && selectedObjectives.length > 0 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <p className="text-sm text-green-700">
              Weight distribution is balanced at 100% - Good to proceed!
            </p>
          </div>
        )}

        {selectedObjectives.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-2">
            <button
              onClick={handleAutoDistribute}
              className="w-full px-4 py-2 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
            >
              Auto-distribute weights equally
            </button>
            
            <button
              onClick={handleSaveAndProceed}
              disabled={!!validationError || selectedObjectives.length === 0 || isSavingWeights}
              className="w-full px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isSavingWeights ? (
                <>
                  <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite] mr-2"></div>
                  Saving Weights...
                </>
              ) : (
                <>
                  Proceed to Planning
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Selected Objectives Section */}
      {selectedObjectives.length > 0 && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <h3 className="text-md font-medium text-gray-800 mb-4">Selected Objectives ({selectedObjectives.length})</h3>
          
          <div className="space-y-3">
            {selectedObjectives.map(obj => {
              const effectiveWeight = objectiveWeights[obj.id] !== undefined ? 
                                     objectiveWeights[obj.id] : 
                                     obj.effective_weight || getEffectiveWeight(obj);
              
              return (
                <div key={obj.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center flex-1">
                      <Target className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{obj.title}</h4>
                        <p className="text-sm text-gray-500 mt-1">{obj.description}</p>
                        {obj.is_default && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-2">
                            Default (Original: {obj.weight}%)
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveObjective(obj.id)}
                      className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full ml-2"
                      aria-label="Remove objective"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Weight (%)
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          const currentWeight = effectiveWeight;
                          handleWeightChange(obj.id, Math.max(0, parseFloat((currentWeight - 1).toFixed(1))));
                        }}
                        className="p-1 rounded-full bg-gray-100 hover:bg-gray-200"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={effectiveWeight}
                        onChange={(e) => handleWeightChange(obj.id, Number(e.target.value))}
                        className="block w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const currentWeight = effectiveWeight;
                          handleWeightChange(obj.id, parseFloat((currentWeight + 1).toFixed(1)));
                        }}
                        className="p-1 rounded-full bg-gray-100 hover:bg-gray-200"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Objectives Section */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="text-md font-medium text-gray-800 mb-4">Available Strategic Objectives</h3>
        
        {unselectedObjectives.length === 0 ? (
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">
              {selectedObjectives.length > 0 
                ? "All objectives have been selected" 
                : "No objectives available for selection"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unselectedObjectives.map((objective: StrategicObjective) => {
              // Determine effective weight (planner_weight if set, otherwise weight)
              const effectiveWeight = objective.planner_weight !== undefined && objective.planner_weight !== null
                ? objective.planner_weight
                : objective.weight;
                
              return (
                <div 
                  key={objective.id}
                  onClick={() => handleSelectObjective(objective)}
                  className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors"
                >
                  <div className="flex items-center mb-2">
                    <Target className="h-5 w-5 text-blue-600 mr-2" />
                    <h4 className="font-medium text-gray-900">{objective.title}</h4>
                  </div>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{objective.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600">
                      {objective.is_default ? 'Default' : 'Custom'} Weight: {effectiveWeight}%
                      {objective.planner_weight !== undefined && objective.planner_weight !== null && 
                        ` (Original: ${objective.weight}%)`
                      }
                    </span>
                    <span className="text-blue-600 text-sm flex items-center">
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {selectedObjectives.length === 0 && (
        <div className="text-center p-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg">
          <Target className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No objectives selected yet. Please select at least one objective from below.</p>
        </div>
      )}
    </div>
  );
};

export default HorizontalObjectiveSelector;

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { objectives } from '../lib/api';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { AlertCircle, CheckCircle, Target, Plus, Trash2, Info } from 'lucide-react';
import type { StrategicObjective } from '../types/organization';

interface CustomObjectiveSelectorProps {
  onObjectivesSelected: (objectives: StrategicObjective[]) => void;
  initialObjectives?: StrategicObjective[];
}

const CustomObjectiveSelector: React.FC<CustomObjectiveSelectorProps> = ({
  onObjectivesSelected,
  initialObjectives = []
}) => {
  const { t } = useLanguage();
  const [selectedObjectives, setSelectedObjectives] = useState<StrategicObjective[]>(initialObjectives);
  const [objectiveWeights, setObjectiveWeights] = useState<Record<string, number>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [totalWeight, setTotalWeight] = useState(0);
  
  // Fetch all objectives
  const { data: allObjectives, isLoading } = useQuery({
    queryKey: ['objectives', 'custom-selector'],
    queryFn: () => objectives.getAll(),
  });

  // Initialize objective weights from initial objectives
  useEffect(() => {
    if (initialObjectives.length > 0) {
      const initialWeights: Record<string, number> = {};
      initialObjectives.forEach(obj => {
        if (obj.id) {
          // Use effective_weight if available (which accounts for planner_weight), otherwise weight
          initialWeights[obj.id] = obj.effective_weight !== undefined ? obj.effective_weight : obj.weight;
        }
      });
      setObjectiveWeights(initialWeights);
    }
  }, [initialObjectives]);

  // Calculate total weight whenever objectiveWeights changes
  useEffect(() => {
    let total = 0;
    Object.values(objectiveWeights).forEach(weight => {
      total += weight;
    });
    setTotalWeight(total);
    
    // Validate total weight
    if (selectedObjectives.length > 0) {
      if (Math.abs(total - 100) < 0.01) { // Using a small epsilon for floating point comparison
        setValidationError(null);
        // Pass the updated objectives with weights to the parent
        const objectivesWithWeights = selectedObjectives.map(obj => ({
          ...obj,
          weight: objectiveWeights[obj.id] || obj.weight
        }));
        onObjectivesSelected(objectivesWithWeights);
      } else {
        setValidationError(`Total weight must be 100%. Current: ${total.toFixed(2)}%`);
      }
    } else {
      setValidationError(null);
    }
  }, [objectiveWeights, selectedObjectives, onObjectivesSelected]);

  const handleSelectObjective = (objective: StrategicObjective) => {
    // Check if already selected
    const isSelected = selectedObjectives.some(obj => obj.id === objective.id);
    
    if (isSelected) {
      return; // Objective already selected
    }
    
    // Add to selected objectives
    const updatedObjectives = [...selectedObjectives, objective];
    setSelectedObjectives(updatedObjectives);
    
    // Set initial weight for this objective - use planner_weight if available
    setObjectiveWeights(prev => ({
      ...prev,
      [objective.id]: objective.planner_weight !== undefined && objective.planner_weight !== null
        ? objective.planner_weight 
        : objective.weight
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
    setObjectiveWeights(prev => ({
      ...prev,
      [objectiveId]: weight
    }));
  };

  // Auto-distribute weights to reach 100%
  const handleAutoDistribute = () => {
    if (selectedObjectives.length === 0) return;
    
    const equalWeight = 100 / selectedObjectives.length;
    const updatedWeights: Record<string, number> = {};
    
    selectedObjectives.forEach(obj => {
      updatedWeights[obj.id] = equalWeight;
    });
    
    setObjectiveWeights(updatedWeights);
  };

  if (isLoading) {
    return <div className="text-center p-4">Loading objectives...</div>;
  }

  // Filter out already selected objectives for the available list
  const availableObjectives = allObjectives?.data?.filter(
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
  ) || [];

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <div className="flex items-center">
          <Info className="h-5 w-5 text-blue-600 mr-2" />
          <p className="text-blue-700 text-sm">
            Select one or more strategic objectives and assign weights to them. 
            The total weight must equal exactly 100%.
          </p>
        </div>
      </div>

      {/* Selected Objectives List */}
      <div className="space-y-4">
        <h3 className="text-md font-medium text-gray-800">Selected Strategic Objectives</h3>
        
        {selectedObjectives.length === 0 ? (
          <div className="text-center p-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg">
            <Target className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">No objectives selected yet. Please select at least one objective.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedObjectives.map(objective => (
              <div 
                key={objective.id} 
                className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{objective.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">{objective.description}</p>
                    {objective.is_default && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 mt-2">
                        Default Objective (Original weight: {objective.weight}%)
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveObjective(objective.id)}
                    className="p-1 text-red-600 hover:text-red-800"
                    aria-label="Remove objective"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weight (%)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={objectiveWeights[objective.id] || 0}
                      onChange={(e) => handleWeightChange(objective.id, Number(e.target.value))}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-gray-700 font-medium">Total Weight:</div>
              <div className={`text-lg font-semibold ${
                Math.abs(totalWeight - 100) < 0.01 ? 'text-green-600' : 'text-red-600'
              }`}>
                {totalWeight.toFixed(2)}%
              </div>
            </div>

            {validationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-600">{validationError}</p>
              </div>
            )}

            {Math.abs(totalWeight - 100) < 0.01 && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <p className="text-sm text-green-600">Total weight is 100% - Good to proceed!</p>
              </div>
            )}

            <button
              onClick={handleAutoDistribute}
              type="button"
              className="mt-2 px-4 py-2 text-sm text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
            >
              Auto-distribute weights equally
            </button>
          </div>
        )}
      </div>

      {/* Available Objectives Selection */}
      <div>
        <h3 className="text-md font-medium text-gray-800 mb-4">Available Strategic Objectives</h3>
        
        {availableObjectives.length === 0 ? (
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">No more objectives available for selection.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableObjectives.map((objective: StrategicObjective) => {
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
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    <h4 className="font-medium text-gray-900 truncate">{objective.title}</h4>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2">{objective.description}</p>
                  <div className="flex justify-between items-center mt-3">
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
    </div>
  );
};

export default CustomObjectiveSelector;
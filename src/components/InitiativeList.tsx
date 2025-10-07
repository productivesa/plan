import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { initiatives, auth, organizations } from '../lib/api';
import { BarChart3, AlertCircle, CheckCircle, Edit, Trash2, Lock, PlusCircle, Building2, Info, Loader } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import type { StrategicInitiative } from '../types/organization';
import { isPlanner } from '../types/user';

interface InitiativeListProps {
  parentId: string;
  parentType: 'objective' | 'program' | 'subprogram';
  parentWeight: number;
  selectedObjectiveData?: any;
  onEditInitiative: (initiative: StrategicInitiative) => void;
  onSelectInitiative?: (initiative: StrategicInitiative) => void;
  isNewPlan?: boolean;
  planKey?: string;
  isUserPlanner: boolean;
  userOrgId: number | null;
  refreshKey?: number;
}

const InitiativeList: React.FC<InitiativeListProps> = ({ 
  parentId,
  parentType,
  parentWeight,
  selectedObjectiveData,
  onEditInitiative,
  onSelectInitiative,
  isNewPlan = false,
  planKey = 'default',
  isUserPlanner,
  userOrgId,
  refreshKey = 0,
}) => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastRefreshKey, setLastRefreshKey] = useState(refreshKey);
  const [organizationsMap, setOrganizationsMap] = useState<Record<string, string>>({});
  
  console.log('InitiativeList received:', {
    parentWeight,
    parentType,
    parentId,
    selectedObjectiveData: selectedObjectiveData ? 'provided' : 'not provided',
    customWeight: selectedObjectiveData?.effective_weight || selectedObjectiveData?.planner_weight,
    refreshKey
  });

  // Fetch organizations mapping for displaying names
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await organizations.getAll();
        const orgMap: Record<string, string> = {};
        
        if (response?.data && Array.isArray(response.data)) {
          response.data.forEach((org: any) => {
            if (org?.id) {
              orgMap[String(org.id)] = org.name;
            }
          });
        }
        
        setOrganizationsMap(orgMap);
        console.log('Organizations map created for initiatives:', orgMap);
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
      }
    };
    
    fetchOrganizations();
  }, []);

  // Force refresh function for external use
  const forceRefresh = () => {
    console.log('Force refreshing initiatives list');
    queryClient.invalidateQueries({ queryKey: ['initiatives', parentId, parentType] });
    setRefreshTrigger(prev => prev + 1);
    refetch();
  };

  // Listen for initiative updates from parent component
  useEffect(() => {
    console.log('InitiativeList: planKey changed, refreshing data');
    setRefreshTrigger(prev => prev + 1);
  }, [planKey]);

  // Listen for external refresh key changes
  useEffect(() => {
    if (refreshKey !== lastRefreshKey) {
      console.log('InitiativeList: External refresh key changed, refreshing data');
      setLastRefreshKey(refreshKey);
      forceRefresh();
    }
  }, [refreshKey, lastRefreshKey]);

  // Fetch all initiatives based on parent type
  const { data: initiativesList, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['initiatives', parentId, parentType, planKey, refreshTrigger, refreshKey],
    queryFn: async () => {
      if (!parentId) {
        console.log('Missing parentId, cannot fetch initiatives');
        return { data: [] };
      }
      
      console.log(`InitiativeList: Fetching initiatives for ${parentType} ${parentId} (trigger: ${refreshTrigger}, key: ${refreshKey})`);
      console.log(`InitiativeList: User organization ID: ${userOrgId}`);
      
      let response;
      try {
        switch (parentType) {
          case 'objective':
            console.log(`InitiativeList: Calling initiatives.getByObjective(${parentId})`);
            response = await initiatives.getByObjective(parentId);
            break;
          case 'program':
            console.log(`InitiativeList: Calling initiatives.getByProgram(${parentId})`);
            response = await initiatives.getByProgram(parentId);
            break;
          case 'subprogram':
            console.log(`InitiativeList: Calling initiatives.getBySubProgram(${parentId})`);
            response = await initiatives.getBySubProgram(parentId);
            break;
          default:
            throw new Error('Invalid parent type');
        }
        
        console.log(`InitiativeList: Raw API response:`, response);
        
        // Ensure we have valid data
        if (!response || !response.data) {
          console.warn(`InitiativeList: No data in response for ${parentType} ${parentId}`);
          return { data: [] };
        }
        
        const initiativesData = Array.isArray(response.data) ? response.data : [];
        console.log(`InitiativeList: Processed ${initiativesData.length} initiatives from API`);
        
        return { data: initiativesData };
      } catch (error) {
        console.error(`InitiativeList: Error fetching initiatives for ${parentType} ${parentId}:`, error);
        return { data: [] };
      }
    },
    enabled: !!parentId && !!userOrgId,
    staleTime: 0,
    cacheTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  // Add delete initiative mutation
  const deleteInitiativeMutation = useMutation({
    mutationFn: (initiativeId: string) => initiatives.delete(initiativeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['initiatives', parentId, parentType] });
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      setRefreshTrigger(prev => prev + 1);
      refetch();
    }
  });

  // Handle initiative deletion
  const handleDeleteInitiative = (initiativeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this initiative? This action cannot be undone.')) {
      deleteInitiativeMutation.mutate(initiativeId);
    }
  };

  // CRITICAL: Filter initiatives by BOTH parent relationship AND organization
  const filteredInitiatives = React.useMemo(() => {
    console.log('InitiativeList: Starting to filter initiatives for parent:', parentId, 'and user org:', userOrgId);
    
    if (!initiativesList?.data || !Array.isArray(initiativesList.data)) {
      console.log('InitiativeList: No initiatives data to filter');
      return [];
    }

    console.log(`InitiativeList: Processing ${initiativesList.data.length} initiatives for ${parentType} ${parentId}`);
    
    // CRITICAL: Two-stage filtering - first by parent, then by organization
    const filtered = initiativesList.data.filter(initiative => {
      if (!initiative) {
        console.log('InitiativeList: Skipping null initiative');
        return false;
      }
      
      // STAGE 1: Check parent relationship
      let belongsToParent = false;
      if (parentType === 'objective') {
        belongsToParent = initiative.strategic_objective && 
                          Number(initiative.strategic_objective) === Number(parentId);
      } else if (parentType === 'program') {
        belongsToParent = initiative.program && 
                          Number(initiative.program) === Number(parentId);
      }
      
      if (!belongsToParent) {
        console.log(`InitiativeList: Initiative "${initiative.name}" doesn't belong to parent ${parentType} ${parentId}`);
        return false;
      }
      
      // STAGE 2: Check organization (only for initiatives that belong to this parent)
      const isDefault = initiative.is_default === true;
      const belongsToUserOrg = userOrgId && initiative.organization && 
                              Number(initiative.organization) === Number(userOrgId);
      
      // Only include default initiatives OR initiatives from user's organization
      const shouldInclude = isDefault || belongsToUserOrg;
      
      console.log(`InitiativeList: Initiative "${initiative.name}" - parent:${belongsToParent}, isDefault:${isDefault}, org:${initiative.organization}, userOrg:${userOrgId}, include:${shouldInclude}`);
      
      return shouldInclude;
    });
    
    console.log(`InitiativeList: Filtered ${initiativesList.data.length} total to ${filtered.length} for parent ${parentId} and user org ${userOrgId}`);
    
    return filtered;
  }, [initiativesList?.data, userOrgId, parentId, parentType, refreshKey]);
  
  // Enrich initiatives with organization names - using React.useMemo
  const enrichedInitiatives = React.useMemo(() => {
    return filteredInitiatives.map(initiative => ({
      ...initiative,
      organization_name: initiative.is_default 
        ? 'Ministry of Health (Default)'
        : (initiative.organization_name || 
           organizationsMap[String(initiative.organization)] || 
           'Unknown Organization')
    }));
  }, [filteredInitiatives, organizationsMap]);
  
  console.log('InitiativeList: Weight calculation debug:', {
    totalInitiatives: initiativesList?.data?.length || 0,
    filteredInitiatives: enrichedInitiatives.length,
    userOrgId,
    parentWeight,
    parentType
  });
  
  const total_initiatives_weight = enrichedInitiatives.reduce((sum, initiative) => 
    sum + (Number(initiative.weight) || 0), 0
  );
  
  const remaining_weight = parentWeight - total_initiatives_weight;
  
  console.log('InitiativeList: Final weight calculation:', {
    parentWeight,
    total_initiatives_weight,
    remaining_weight,
    filteredInitiativesCount: enrichedInitiatives.length
  });
  
  // Check if exactly equal to parent weight with a small epsilon for floating point comparison
  const is_valid = parentType === 'objective' 
    ? Math.abs(total_initiatives_weight - parentWeight) < 0.01 
    : total_initiatives_weight <= parentWeight;

  // Group initiatives by default vs custom - using React.useMemo
  const defaultInitiatives = React.useMemo(() => 
    enrichedInitiatives.filter(i => i.is_default), 
    [enrichedInitiatives]
  );
  
  const customInitiatives = React.useMemo(() => 
    enrichedInitiatives.filter(i => !i.is_default), 
    [enrichedInitiatives]
  );

  console.log(`Grouped initiatives: ${defaultInitiatives.length} default, ${customInitiatives.length} custom`);

  // Handle initiative validation
  const handleValidateInitiatives = () => {
    setValidationSuccess(null);
    setValidationError(null);
    
    console.log('Validating initiatives:', {
      parentWeight,
      totalWeight: total_initiatives_weight,
      isValid: is_valid
    });

    if (is_valid) {
      setValidationSuccess(`Initiative weights are valid (${total_initiatives_weight.toFixed(2)}% = ${parentWeight.toFixed(2)}%)`);
      setTimeout(() => setValidationSuccess(null), 3000);
    } else {
      if (parentType === 'objective') {
        setValidationError(`Initiative weights (${total_initiatives_weight.toFixed(2)}%) must equal objective weight (${parentWeight.toFixed(2)}%)`);
      } else {
        setValidationError(`Initiative weights (${total_initiatives_weight.toFixed(2)}%) cannot exceed ${parentType} weight (${parentWeight.toFixed(2)}%)`);
      }
      setTimeout(() => setValidationError(null), 5000);
    }
  };

  if ((isLoading || isFetching) && parentId) {
    return <div className="text-center p-4">{t('common.loading')}</div>;
  }

  if (!initiativesList?.data) {
    return null;
  }

  // If there are no initiatives yet, show empty state
  if (enrichedInitiatives.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {t('planning.weightDistribution')}
            </h3>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-500">{t('planning.allocatedWeight')}</p>
              <p className="text-2xl font-semibold text-blue-600">0%</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('planning.remainingWeight')}</p>
              <p className="text-2xl font-semibold text-green-600">{parentWeight}%</p>
            </div>
          </div>

          {parentType === 'objective' && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700 flex items-center">
                <Info className="h-4 w-4 mr-2" />
                <strong>Important:</strong> For this objective with custom weight {parentWeight}%, 
                the total initiative weights must equal <strong>exactly {parentWeight}%</strong>.
              </p>
            </div>
          )}
        </div>

        <div className="text-center p-8 bg-white rounded-lg border-2 border-dashed border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Initiatives Found</h3>
          <p className="text-gray-500 mb-4">
            No initiatives have been created yet for this {parentType}.
          </p>
          {isUserPlanner && (
            <button 
              onClick={() => onEditInitiative({} as StrategicInitiative)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Initiative
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
            <p className="text-sm text-gray-500">Parent Weight</p>
            <p className="text-2xl font-semibold text-gray-900">{parentWeight}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">{t('planning.allocatedWeight')}</p>
            <p className="text-2xl font-semibold text-blue-600">{total_initiatives_weight.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">{t('planning.remainingWeight')}</p>
            <p className={`text-2xl font-semibold ${is_valid ? 'text-green-600' : remaining_weight < 0 ? 'text-red-600' : 'text-amber-600'}`}>
              {remaining_weight.toFixed(1)}%
            </p>
          </div>
        </div>

        {parentType === 'objective' && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700 flex items-center">
              <Info className="h-4 w-4 mr-2" />
              <strong>Important:</strong> For this objective with custom weight {parentWeight.toFixed(2)}%, 
              the total initiative weights must equal <strong>exactly {parentWeight}%</strong>.
            </p>
          </div>
        )}

        {remaining_weight < 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">{t('planning.overAllocatedWarning')}</p>
          </div>
        )}

        {remaining_weight > 0 && parentType === 'objective' && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-2 text-amber-700">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm">
              Total weight must equal exactly {parentWeight}% (custom weight). 
              Current total: {total_initiatives_weight.toFixed(1)}%
              (Need {remaining_weight.toFixed(1)}% more)
            </p>
          </div>
        )}

        {is_valid && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <p className="text-sm">
              {parentType === 'objective' 
                ? `Weight distribution is balanced at exactly ${parentWeight}% (custom weight)` 
                : 'Weight distribution is valid'}
            </p>
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
              onClick={handleValidateInitiatives}
              disabled={
                enrichedInitiatives.length === 0 ||
                (parentType === 'objective' && Math.abs(total_initiatives_weight - parentWeight) >= 0.01)
              }
              className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {parentType === 'objective' && Math.abs(total_initiatives_weight - parentWeight) >= 0.01
                ? `Complete Weight Distribution (${remaining_weight.toFixed(1)}% ${remaining_weight > 0 ? 'remaining' : 'over'})`
                : 'Validate Initiatives Weight'}
            </button>
            
            {parentType === 'objective' && Math.abs(total_initiatives_weight - parentWeight) >= 0.01 && enrichedInitiatives.length > 0 && (
              <p className="mt-2 text-xs text-amber-600 text-center">
                {remaining_weight > 0 
                  ? `Add more initiatives to reach exactly ${parentWeight}% total weight`
                  : `Reduce initiative weights to reach exactly ${parentWeight}% total weight`}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Default Initiatives */}
      {defaultInitiatives.length > 0 && (
        <>
          <h3 className="text-sm font-medium text-gray-700 flex items-center">
            <span className="inline-flex items-center px-2.5 py-0.5 mr-2 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Default
            </span>
            Default Initiatives
          </h3>
          <div className="space-y-2">
            {defaultInitiatives.map((initiative) => (
              <div
                key={initiative.id}
                onClick={() => onSelectInitiative && onSelectInitiative(initiative)}
                className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-green-300 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <h4 className="font-medium text-gray-900">{initiative.name}</h4>
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Default
                    </span>
                    {initiative.initiative_feed && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Predefined
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-medium text-blue-600">
                      {initiative.weight}%
                    </span>
                  </div>
                </div>
                
                {initiative.organization_name && (
                  <div className="mb-2 flex items-center text-sm text-gray-600">
                    <Building2 className="h-4 w-4 mr-1 text-gray-500" />
                    <span>{initiative.organization_name}</span>
                  </div>
                )}
                
                <div className="flex justify-end mt-2">
                  {isUserPlanner ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditInitiative(initiative);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleDeleteInitiative(initiative.id, e)}
                        disabled={deleteInitiativeMutation.isPending}
                        className="text-xs text-red-600 hover:text-red-800 flex items-center"
                      >
                        {deleteInitiativeMutation.isPending ? (
                          <Loader className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-1" />
                        )}
                        {deleteInitiativeMutation.isPending ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 flex items-center">
                      <Lock className="h-3 w-3 mr-1" />
                      {t('planning.permissions.readOnly')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Custom Initiatives */}
      {customInitiatives.length > 0 && (
        <>
          <h3 className="text-sm font-medium text-gray-700 flex items-center mt-6">
            <span className="inline-flex items-center px-2.5 py-0.5 mr-2 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Custom
            </span>
            Your Initiatives
          </h3>
          <div className="space-y-2">
            {customInitiatives.map((initiative) => (
              <div
                key={initiative.id}
                onClick={() => onSelectInitiative && onSelectInitiative(initiative)}
                className="bg-white p-4 rounded-lg shadow-sm border border-blue-200 hover:border-blue-400 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <h4 className="font-medium text-gray-900">{initiative.name}</h4>
                    {initiative.initiative_feed && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Predefined
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-medium text-blue-600">
                      {initiative.weight}%
                    </span>
                  </div>
                </div>
                
                {initiative.organization_name && (
                  <div className="mb-2 flex items-center text-sm text-gray-600">
                    <Building2 className="h-4 w-4 mr-1 text-gray-500" />
                    <span>{initiative.organization_name}</span>
                  </div>
                )}
                
                <div className="flex justify-end mt-2">
                  {isUserPlanner ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditInitiative(initiative);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                      <button
                        onClick={(e) => handleDeleteInitiative(initiative.id, e)}
                        disabled={deleteInitiativeMutation.isPending}
                        className="text-xs text-red-600 hover:text-red-800 flex items-center"
                      >
                        {deleteInitiativeMutation.isPending ? (
                          <Loader className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-1" />
                        )}
                        {deleteInitiativeMutation.isPending ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 flex items-center">
                      <Lock className="h-3 w-3 mr-1" />
                      {t('planning.permissions.readOnly')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add initiative button */}
      {isUserPlanner && (
        <div className="mt-4 text-center">
          <button 
            onClick={() => {
              console.log('Creating new initiative with parentWeight:', parentWeight);
              onEditInitiative({ parentWeight, selectedObjectiveData } as StrategicInitiative);
            }}
            disabled={parentType === 'objective' && remaining_weight <= 0.01}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            {enrichedInitiatives.length === 0 ? 'Create First Initiative' : 
             remaining_weight <= 0.01 ? `No Weight Available (${remaining_weight.toFixed(1)}%)` :
             'Create New Initiative'}
          </button>
          
          {parentType === 'objective' && remaining_weight <= 0.01 && total_initiatives_weight < parentWeight && (
            <p className="mt-2 text-xs text-amber-600">
              Cannot add more initiatives. Total weight must equal exactly {parentWeight.toFixed(2)}% (custom weight).
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default InitiativeList;
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { Loader, AlertCircle, Info } from 'lucide-react';
import { initiatives, initiativeFeeds, auth } from '../lib/api';

interface InitiativeFormProps {
  parentId: string;
  parentType: 'objective' | 'program';
  parentWeight: number;
  selectedObjectiveData?: any;
  currentTotal: number;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  initialData?: any;
}

const InitiativeForm: React.FC<InitiativeFormProps> = ({
  parentId,
  parentType,
  parentWeight,
  selectedObjectiveData,
  currentTotal,
  onSubmit,
  onCancel,
  initialData
}) => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFeedId, setSelectedFeedId] = useState<string>('');
  const [initiativeMode, setInitiativeMode] = useState<'custom' | 'predefined'>('custom');
  const [isLoadingFeeds, setIsLoadingFeeds] = useState(false);
  const [availableFeeds, setAvailableFeeds] = useState<any[]>([]);
  const [existingInitiatives, setExistingInitiatives] = useState<any[]>([]);
  const [useInitiativeFeed, setUseInitiativeFeed] = useState<boolean>(
    initialData?.initiative_feed ? true : false
  );
  const [userOrgId, setUserOrgId] = useState<number | null>(null);
  
  console.log('InitiativeForm initialized with:', {
    parentId,
    parentType,
    parentWeight,
    selectedObjectiveData: selectedObjectiveData ? {
      id: selectedObjectiveData.id,
      title: selectedObjectiveData.title,
      weight: selectedObjectiveData.weight,
      planner_weight: selectedObjectiveData.planner_weight,
      effective_weight: selectedObjectiveData.effective_weight
    } : 'not provided'
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<any>({
    defaultValues: {
      name: initialData?.name || '',
      weight: initialData?.weight || '',
      initiative_feed: initialData?.initiative_feed || ''
    }
  });

  // Watch form fields
  const watchedName = watch('name') || '';
  const selectedInitiativeFeed = watch('initiative_feed');
  const watchedWeight = watch('weight');

  // Get user organization ID
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const authData = await auth.getCurrentUser();
        if (authData.userOrganizations && authData.userOrganizations.length > 0) {
          setUserOrgId(authData.userOrganizations[0].organization);
          console.log('InitiativeForm: User organization ID set to:', authData.userOrganizations[0].organization);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };
    
    fetchUserData();
  }, []);

  // Auto-fill name when predefined initiative is selected
  useEffect(() => {
    if (useInitiativeFeed && selectedInitiativeFeed && availableFeeds.length > 0) {
      const selectedFeed = availableFeeds.find((feed: any) => 
        feed.id.toString() === selectedInitiativeFeed.toString());
      
      if (selectedFeed) {
        console.log('Auto-filling name with:', selectedFeed.name);
        setValue('name', selectedFeed.name);
      }
    }
  }, [selectedInitiativeFeed, availableFeeds, useInitiativeFeed, setValue]);

  // Fetch existing initiatives for weight calculation
  useEffect(() => {
    const fetchExistingInitiatives = async () => {
      if (!parentId || !userOrgId) return;
      
      try {
        console.log(`InitiativeForm: Fetching existing initiatives for ${parentType} ${parentId}`);
        console.log(`InitiativeForm: User organization ID: ${userOrgId}`);
        
        let response;
        if (parentType === 'objective') {
          response = await initiatives.getByObjective(parentId);
        } else if (parentType === 'program') {
          response = await initiatives.getByProgram(parentId);
        } else {
          return;
        }
        
        const initiativesData = response?.data || [];
        console.log(`InitiativeForm: Raw initiatives from API (${initiativesData.length})`);
        
        // Filter initiatives to only include user's organization and defaults
        const filteredInitiatives = initiativesData.filter(initiative => {
          const isDefault = initiative.is_default;
          const belongsToUserOrg = initiative.organization === userOrgId;
          
          const shouldInclude = isDefault || belongsToUserOrg;
          
          console.log(`Initiative "${initiative.name}": isDefault=${isDefault}, org=${initiative.organization}, userOrg=${userOrgId}, shouldInclude=${shouldInclude}`);
          
          return shouldInclude;
        });
        
        console.log('InitiativeForm: Filtered initiatives for user org:', filteredInitiatives.length);
        setExistingInitiatives(filteredInitiatives);
      } catch (error) {
        console.error('Error fetching existing initiatives:', error);
        setExistingInitiatives([]);
      }
    };
    
    if (userOrgId !== null) {
      fetchExistingInitiatives();
    }
  }, [parentId, parentType, userOrgId]);

  // Calculate weight constraints
  const calculateWeights = () => {
    // CRITICAL: Filter initiatives by parent relationship first, then by organization
    const parentInitiatives = existingInitiatives.filter(init => {
      if (parentType === 'objective') {
        return init.strategic_objective && Number(init.strategic_objective) === Number(parentId);
      } else if (parentType === 'program') {
        return init.program && Number(init.program) === Number(parentId);
      }
      return false;
    });
    
    // Then filter out the current initiative if editing
    const otherInitiatives = parentInitiatives.filter(init => 
      !initialData || init.id !== initialData.id
    );
    
    // Calculate total weight of other initiatives
    const otherInitiativesWeight = otherInitiatives.reduce((sum, init) => 
      sum + (Number(init.weight) || 0), 0
    );
    
    // Calculate remaining weight
    const remainingWeight = parentWeight - otherInitiativesWeight;
    const maxWeight = Math.max(0, remainingWeight);
    
    const currentInitiativeWeight = initialData ? Number(initialData.weight) || 0 : 0;
    const totalWithCurrentInitiative = otherInitiativesWeight + currentInitiativeWeight;
    
    // Calculate total with new weight
    const totalWithCurrent = otherInitiativesWeight + (Number(watchedWeight) || 0);
    
    console.log('InitiativeForm: Weight calculation:', {
      parentWeight,
      parentInitiatives: parentInitiatives.length,
      otherInitiativesWeight,
      currentInitiativeWeight,
      remainingWeight,
      maxWeight,
      currentWeight: Number(watchedWeight) || 0,
      totalWithCurrent
    });
    
    return {
      otherInitiativesWeight,
      currentInitiativeWeight,
      remainingWeight,
      maxWeight,
      totalWithCurrent,
      parentWeight
    };
  };

  const weights = calculateWeights();

  // Load initiative feeds based on parent type
  useEffect(() => {
    const loadFeeds = async () => {
      try {
        setIsLoadingFeeds(true);
        setError(null);
        
        let response;
        if (parentType === 'objective') {
          response = await initiativeFeeds.getByObjective(parentId);
        } else {
          response = await initiativeFeeds.getAll();
        }
        
        setAvailableFeeds(response?.data || []);
      } catch (error) {
        console.error('Error loading initiative feeds:', error);
        setError('Failed to load predefined initiatives');
        setAvailableFeeds([]);
      } finally {
        setIsLoadingFeeds(false);
      }
    };
    
    if (initiativeMode === 'predefined' && parentId) {
      loadFeeds();
    } else {
      setAvailableFeeds([]);
    }
  }, [initiativeMode, parentId, parentType]);

  // Initialize form with existing data
  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name || '',
        weight: initialData.weight || '',
        initiative_feed: initialData.initiative_feed || ''
      });
      
      if (initialData.initiative_feed) {
        setInitiativeMode('predefined');
        setSelectedFeedId(initialData.initiative_feed);
        setUseInitiativeFeed(true);
      }
    }
  }, [initialData, reset]);

  const handleFormSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Ensure we have user organization ID
      if (!userOrgId) {
        setError('User organization not found. Please refresh the page and try again.');
        setIsSubmitting(false);
        return;
      }
      
      // Validate weight
      const currentWeight = Number(data.weight) || 0;
      
      // For new initiatives, check against remaining weight
      if (!initialData && currentWeight > weights.maxWeight) {
        setError(`Weight cannot exceed ${weights.maxWeight.toFixed(2)}%. Available weight: ${weights.remainingWeight.toFixed(2)}%`);
        setIsSubmitting(false);
        return;
      }
      
      // For editing, validate against total parent weight
      if (initialData && weights.totalWithCurrent > parentWeight) {
        setError(`Total initiative weight (${weights.totalWithCurrent.toFixed(2)}%) cannot exceed parent weight (${parentWeight.toFixed(2)}%)`);
        setIsSubmitting(false);
        return;
      }
      
      // Prepare submission data with proper organization assignment
      const submissionData = {
        name: data.name?.trim(),
        weight: Number(data.weight),
        [parentType === 'objective' ? 'strategic_objective' : 'program']: parentId,
        organization: userOrgId, // CRITICAL: Always assign user's organization
        is_default: initialData?.is_default || false,
        initiative_feed: useInitiativeFeed && selectedInitiativeFeed ? selectedInitiativeFeed : null
      };

      console.log('InitiativeForm: Submitting initiative with data:', submissionData);
      console.log('InitiativeForm: Operation type:', initialData ? 'UPDATE' : 'CREATE');
      
      await onSubmit(submissionData);
      
      console.log('InitiativeForm: Successfully submitted initiative');
    } catch (error: any) {
      console.error('Error submitting initiative:', error);
      
      let errorMessage = 'Failed to save initiative';
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.weight) {
          errorMessage = Array.isArray(error.response.data.weight) 
            ? error.response.data.weight[0] 
            : error.response.data.weight;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if submit button should be enabled
  const isSubmitDisabled = () => {
    if (isSubmitting || !userOrgId) return true;
    
    const name = watchedName?.trim();
    if (!name) return true;
    
    const currentWeight = Number(watchedWeight) || 0;
    if (currentWeight <= 0) return true;
    
    // For new initiatives
    if (!initialData) {
      return currentWeight > weights.maxWeight;
    }
    
    // For editing initiatives
    return weights.totalWithCurrent > parentWeight;
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Weight Summary */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-blue-600">Parent Weight</p>
            <p className="font-semibold text-blue-800">{parentWeight.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-blue-600">Other Initiatives</p>
            <p className="font-semibold text-blue-800">{weights.otherInitiativesWeight.toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-blue-600">Available</p>
            <p className={`font-semibold ${weights.remainingWeight > 0 ? 'text-green-600' : weights.remainingWeight < 0 ? 'text-red-600' : 'text-blue-800'}`}>
              {weights.remainingWeight.toFixed(2)}%
            </p>
          </div>
        </div>
        
        {initialData && (
          <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-xs">
            <Info className="h-4 w-4 inline mr-1" />
            Editing existing initiative (current weight: {weights.currentInitiativeWeight.toFixed(2)}%)
          </div>
        )}
        
        {parentType === 'objective' && (
          <p className="mt-2 text-xs text-blue-600">
            <strong>Important:</strong> For this objective with custom weight {parentWeight.toFixed(2)}%, 
            the total initiative weights must equal <strong>exactly {parentWeight.toFixed(2)}%</strong>.
          </p>
        )}
        
        {weights.remainingWeight < 0 && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
            <AlertCircle className="h-4 w-4 inline mr-1" />
            Total weight exceeds parent weight by {Math.abs(weights.remainingWeight).toFixed(2)}%
          </div>
        )}
        
        {watchedWeight && (
          <div className="mt-2 text-xs text-blue-600">
            <strong>Current calculation:</strong> Other initiatives ({weights.otherInitiativesWeight.toFixed(2)}%) + This initiative ({Number(watchedWeight).toFixed(2)}%) = {weights.totalWithCurrent.toFixed(2)}%
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Initiative Mode Toggle */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Initiative Type</h4>
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="initiativeMode"
              value="custom"
              checked={!useInitiativeFeed}
              onChange={() => {
                setUseInitiativeFeed(false);
                setInitiativeMode('custom');
                setValue('initiative_feed', '');
              }}
              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Custom Initiative</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="initiativeMode"
              value="predefined"
              checked={useInitiativeFeed}
              onChange={() => {
                setUseInitiativeFeed(true);
                setInitiativeMode('predefined');
                setValue('name', '');
              }}
              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Predefined Initiative</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {!useInitiativeFeed 
            ? 'Create your own custom initiative with a unique name'
            : 'Select from predefined initiatives for this objective'
          }
        </p>
      </div>

      {/* Predefined Initiative Selection */}
      {useInitiativeFeed && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Predefined Initiative
          </label>
          {isLoadingFeeds ? (
            <div className="flex items-center p-3 bg-gray-50 border border-gray-200 rounded-md">
              <Loader className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-gray-500">Loading predefined initiatives...</span>
            </div>
          ) : (
            <select
              {...register('initiative_feed', { 
                required: useInitiativeFeed ? 'Please select an initiative' : false 
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              disabled={isLoadingFeeds}
            >
              <option value="">Select a predefined initiative...</option>
              {availableFeeds.map(feed => (
                <option key={feed.id} value={feed.id}>
                  {feed.name}
                  {feed.strategic_objective_title && ` (${feed.strategic_objective_title})`}
                </option>
              ))}
            </select>
          )}
          {errors.initiative_feed && (
            <p className="mt-1 text-sm text-red-600">{errors.initiative_feed.message}</p>
          )}
        </div>
      )}

      {/* Initiative Name */}
      {useInitiativeFeed ? (
        selectedInitiativeFeed && watchedName && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Initiative Name (from selected initiative)
            </label>
            <div className="mt-1 p-3 bg-gray-100 rounded-md border border-gray-300 text-gray-700">
              {watchedName}
            </div>
            <input type="hidden" {...register('name')} />
            <p className="mt-1 text-xs text-green-600">
              ✓ Name filled from predefined initiative
            </p>
          </div>
        )
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Initiative Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('name', { 
              required: useInitiativeFeed ? false : 'Initiative name is required',
              minLength: { value: 3, message: 'Name must be at least 3 characters' }
            })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="Enter your custom initiative name"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>
      )}

      {/* Weight Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Weight (%) <span className="text-red-500">*</span>
          {!initialData && (
            <span className="text-blue-600 ml-2">(Maximum: {weights.maxWeight.toFixed(2)}%)</span>
          )}
          {initialData && (
            <span className="text-purple-600 ml-2">(Current: {weights.currentInitiativeWeight.toFixed(2)}%)</span>
          )}
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          max={initialData ? parentWeight : weights.maxWeight}
          {...register('weight', {
            required: 'Weight is required',
            min: { value: 0.01, message: 'Weight must be greater than 0' },
            max: { 
              value: initialData ? parentWeight : weights.maxWeight, 
              message: initialData 
                ? `Weight cannot exceed parent weight (${parentWeight.toFixed(2)}%)` 
                : `Weight cannot exceed ${weights.maxWeight.toFixed(2)}%` 
            },
            valueAsNumber: true
          })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Enter weight percentage"
        />
        {errors.weight && (
          <p className="mt-1 text-sm text-red-600">{errors.weight.message}</p>
        )}
        
        {/* Enhanced weight validation info */}
        <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
          <p><strong>Weight Distribution:</strong></p>
          <p>• Parent {parentType} weight: {parentWeight.toFixed(2)}%</p>
          <p>• Other initiatives: {weights.otherInitiativesWeight.toFixed(2)}%</p>
          {initialData && (
            <p>• Current initiative: {weights.currentInitiativeWeight.toFixed(2)}%</p>
          )}
          {!initialData && (
            <p>• Available for new initiative: {weights.maxWeight.toFixed(2)}%</p>
          )}
          {watchedWeight && (
            <p>• Total after this change: {weights.totalWithCurrent.toFixed(2)}%</p>
          )}
          {parentType === 'objective' && (
            <p className="text-amber-600 font-medium">
              • <strong>Rule:</strong> For objectives, total must equal exactly {parentWeight.toFixed(2)}%
            </p>
          )}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitDisabled()}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <Loader className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </span>
          ) : (
            initialData ? 'Update Initiative' : 'Create Initiative'
          )}
        </button>
      </div>
    </form>
  );
};

export default InitiativeForm;
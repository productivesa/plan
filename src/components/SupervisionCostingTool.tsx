import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { Calculator, DollarSign, Info, Plus, Trash2, AlertCircle } from 'lucide-react';
import type { SupervisionCost, TrainingLocation } from '../types/costing';
import { locations, perDiems, accommodations, supervisorCosts, landTransports, airTransports } from '../lib/api';

// Fallback data if API fails
const FALLBACK_LOCATIONS = [
  { id: 'fallback-1', name: 'Addis Ababa', region: 'Addis Ababa', is_hardship_area: false },
  { id: 'fallback-2', name: 'Adama', region: 'Oromia', is_hardship_area: false }
];

const FALLBACK_SUPERVISOR_COSTS = [
  { id: 'fallback-1', cost_type: 'MOBILE_CARD_300', cost_type_display: 'Mobile Card (300 birr)', amount: 300 },
  { id: 'fallback-2', cost_type: 'STATIONARY', cost_type_display: 'Stationary (Writing Pad and Pen)', amount: 200 }
];

interface TransportRoute {
  id: string;
  transportId?: string;
  origin: string;
  destination: string;
  price: number;
  participants: number;
  originName?: string;
  destinationName?: string;
}

interface SupervisionLocation {
  locationId: string;
  days: number;
  supervisors: number;
}

interface SupervisionCostingToolProps {
  onCalculate: (costs: SupervisionCost) => void;
  onCancel: () => void;
  initialData?: SupervisionCost;
}

const SupervisionCostingTool: React.FC<SupervisionCostingToolProps> = ({ 
  onCalculate,
  onCancel, 
  initialData 
}) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationsData, setLocationsData] = useState<any[]>([]);
  const [perDiemsData, setPerDiemsData] = useState<any[]>([]);
  const [accommodationsData, setAccommodationsData] = useState<any[]>([]);
  const [supervisorCostsData, setSupervisorCostsData] = useState<any[]>([]);
  const [landTransportsData, setLandTransportsData] = useState<any[]>([]);
  const [airTransportsData, setAirTransportsData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [landTransportRoutes, setLandTransportRoutes] = useState<TransportRoute[]>([]);
  const [airTransportRoutes, setAirTransportRoutes] = useState<TransportRoute[]>([]);
  const [additionalLocations, setAdditionalLocations] = useState<SupervisionLocation[]>([]);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('');
  const [costMode, setCostMode] = useState<'perdiem' | 'accommodation'>('perdiem');
  
  const { register, watch, control, setValue, handleSubmit, formState: { errors }, trigger, getValues } = useForm<SupervisionCost>({
    defaultValues: initialData || {
      description: '',
      numberOfDays: 1,
      numberOfSupervisors: 1,
      numberOfSessions: 1,
      location: '',
      costMode: 'perdiem',
      accommodationType: 'FULL_BOARD',
      numberOfSupervisorsWithAdditionalCost: 0,
      additionalSupervisorCosts: [],
      transportRequired: false,
      landTransportSupervisors: 0,
      airTransportSupervisors: 0,
      otherCosts: 0
    }
  });

  // Watch all form values at once
  const allFormValues = watch();

  // Get API base URL
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    setApiBaseUrl(apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl);
    console.log('API Base URL for supervision tool:', apiUrl);
  }, []);

  // Fetch all required data from database
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('Fetching supervision costing data...');
        
        // Fetch all data in parallel
        const [
          locationsResponse,
          perDiemsResponse,
          accommodationsResponse,
          supervisorCostsResponse,
          landTransportsResponse,
          airTransportsResponse
        ] = await Promise.all([
          locations.getAll().catch(err => {
            console.error('Failed to fetch locations:', err);
            return { data: FALLBACK_LOCATIONS };
          }),
          perDiems.getAll().catch(err => {
            console.error('Failed to fetch per diems:', err);
            return { data: [] };
          }),
          accommodations.getAll().catch(err => {
            console.error('Failed to fetch accommodations:', err);
            return { data: [] };
          }),
          supervisorCosts.getAll().catch(err => {
            console.error('Failed to fetch supervisor costs:', err);
            return { data: FALLBACK_SUPERVISOR_COSTS };
          }),
          landTransports.getAll().catch(err => {
            console.error('Failed to fetch land transports:', err);
            return { data: [] };
          }),
          airTransports.getAll().catch(err => {
            console.error('Failed to fetch air transports:', err);
            return { data: [] };
          })
        ]);

        // Set all data
        setLocationsData(locationsResponse?.data || FALLBACK_LOCATIONS);
        setPerDiemsData(perDiemsResponse?.data || []);
        setAccommodationsData(accommodationsResponse?.data || []);
        setSupervisorCostsData(supervisorCostsResponse?.data || FALLBACK_SUPERVISOR_COSTS);
        setLandTransportsData(landTransportsResponse?.data || []);
        setAirTransportsData(airTransportsResponse?.data || []);

        console.log('Successfully loaded supervision costing data:', {
          locations: locationsResponse?.data?.length || 0,
          perDiems: perDiemsResponse?.data?.length || 0,
          accommodations: accommodationsResponse?.data?.length || 0,
          supervisorCosts: supervisorCostsResponse?.data?.length || 0,
          landTransports: landTransportsResponse?.data?.length || 0,
          airTransports: airTransportsResponse?.data?.length || 0
        });

        // Set default location if available
        if (locationsResponse?.data?.length > 0 && !initialData?.location) {
          setValue('location', locationsResponse.data[0].id);
        }

        // Initialize additional locations if provided in initial data
        if (initialData?.additionalLocations && Array.isArray(initialData.additionalLocations)) {
          setAdditionalLocations(initialData.additionalLocations);
        }

        // Initialize transport routes if provided in initial data
        if (initialData?.landTransportRoutes && Array.isArray(initialData.landTransportRoutes)) {
          setLandTransportRoutes(initialData.landTransportRoutes);
        }
        if (initialData?.airTransportRoutes && Array.isArray(initialData.airTransportRoutes)) {
          setAirTransportRoutes(initialData.airTransportRoutes);
        }
        
        // Initialize cost mode if provided in initial data
        if (initialData?.costMode) {
          setCostMode(initialData.costMode);
        }

      } catch (error) {
        console.error('Failed to fetch supervision costing data:', error);
        setError('Failed to load costing data from database. Using fallback values.');
        
        // Use fallback data
        setLocationsData(FALLBACK_LOCATIONS);
        setSupervisorCostsData(FALLBACK_SUPERVISOR_COSTS);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [setValue, initialData]);

  // Calculate average transport costs
  const calculateAvgLandTransportCost = () => {
    if (!landTransportsData || landTransportsData.length === 0) return 1000;
    const total = landTransportsData.reduce((sum, transport) => sum + Number(transport.price || 0), 0);
    return total / landTransportsData.length;
  };

  const calculateAvgAirTransportCost = () => {
    if (!airTransportsData || airTransportsData.length === 0) return 5000;
    const total = airTransportsData.reduce((sum, transport) => sum + Number(transport.price || 0), 0);
    return total / airTransportsData.length;
  };

  // Memoize these values to avoid recalculating on every render
  const avgLandTransportCost = calculateAvgLandTransportCost();
  const avgAirTransportCost = calculateAvgAirTransportCost();

  // Re-validate transport supervisors when total supervisors changes
  useEffect(() => {
    if (allFormValues.transportRequired) {
      trigger(['landTransportSupervisors', 'airTransportSupervisors']);
    }
  }, [allFormValues.numberOfSupervisors, trigger, allFormValues.transportRequired]);

  // Calculate total budget whenever relevant data changes
  useEffect(() => {
    const calculateTotalBudget = () => {
      const locationId = allFormValues.location;
      const days = allFormValues.numberOfDays || 0;
      const supervisors = allFormValues.numberOfSupervisors || 0;
      const numSessions = Number(allFormValues.numberOfSessions) || 1;
      
      let totalCost = 0;
      
      // Main location costs
      if (locationId) {
        if (costMode === 'perdiem') {
          // Per diem costs
          const perDiemData = perDiemsData.find(pd => pd.location == locationId);
          if (perDiemData) {
            const perDiemCost = Number(perDiemData.amount) || 0;
            const hardshipAllowance = Number(perDiemData.hardship_allowance_amount) || 0;
            totalCost += (perDiemCost + hardshipAllowance) * supervisors * days;
          }
        } else {
          // Accommodation costs - use selected accommodation type
          const selectedAccommodationType = allFormValues.accommodationType || 'FULL_BOARD';
          const accommodationData = accommodationsData.find(acc => 
            acc.location == locationId && acc.service_type === selectedAccommodationType
          );
          if (accommodationData) {
            const accommodationCost = Number(accommodationData.price) || 0;
            totalCost += accommodationCost * supervisors * days;
          }
        }
      }
      
      // Additional locations costs
      additionalLocations.forEach(addLocation => {
        if (costMode === 'perdiem') {
          const perDiemData = perDiemsData.find(pd => pd.location == addLocation.locationId);
          if (perDiemData) {
            const perDiemCost = Number(perDiemData.amount) || 0;
            const hardshipAllowance = Number(perDiemData.hardship_allowance_amount) || 0;
            totalCost += (perDiemCost + hardshipAllowance) * addLocation.supervisors * addLocation.days;
          }
        } else {
          const selectedAccommodationType = allFormValues.accommodationType || 'FULL_BOARD';
          const accommodationData = accommodationsData.find(acc => 
            acc.location == addLocation.locationId && acc.service_type === selectedAccommodationType
          );
          if (accommodationData) {
            const accommodationCost = Number(accommodationData.price) || 0;
            totalCost += accommodationCost * addLocation.supervisors * addLocation.days;
          }
        }
      });
      
      // Additional supervisor costs
      const additionalSupervisors = allFormValues.numberOfSupervisorsWithAdditionalCost || 0;
      const selectedAdditionalCosts = allFormValues.additionalSupervisorCosts || [];
      
      selectedAdditionalCosts.forEach((costType: string) => {
        const costData = supervisorCostsData.find(sc => sc.cost_type === costType);
        if (costData) {
          totalCost += Number(costData.amount) * additionalSupervisors;
        }
      });
      
      // Transport costs from routes
      landTransportRoutes.forEach(route => {
        totalCost += Number(route.price) * Number(route.participants);
      });
      
      airTransportRoutes.forEach(route => {
        totalCost += Number(route.price) * Number(route.participants);
      });
      
      // Transport costs from simple inputs
      if (allFormValues.transportRequired) {
        const landSupervisors = Number(allFormValues.landTransportSupervisors) || 0;
        const airSupervisors = Number(allFormValues.airTransportSupervisors) || 0;
        
        totalCost += landSupervisors * avgLandTransportCost;
        totalCost += airSupervisors * avgAirTransportCost;
      }
      
      // Other costs
      totalCost += Number(allFormValues.otherCosts) || 0;
      
      setValue('totalBudget', totalCost);
      return totalCost;
    };

    calculateTotalBudget();
  }, [
    allFormValues,
    additionalLocations, 
    landTransportRoutes, 
    airTransportRoutes,
    costMode,
    perDiemsData,
    accommodationsData,
    supervisorCostsData,
    landTransportsData,
    airTransportsData,
    avgLandTransportCost,
    avgAirTransportCost,
    setValue
  ]);

  // Add additional location
  const addAdditionalLocation = () => {
    setAdditionalLocations([...additionalLocations, {
      locationId: locationsData[0]?.id || '',
      days: 1,
      supervisors: 1
    }]);
  };

  // Remove additional location
  const removeAdditionalLocation = (index: number) => {
    const updated = [...additionalLocations];
    updated.splice(index, 1);
    setAdditionalLocations(updated);
  };

  // Update additional location
  const updateAdditionalLocation = (index: number, field: keyof SupervisionLocation, value: string | number) => {
    const updated = [...additionalLocations];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalLocations(updated);
  };

  // Add land transport route
  const addLandTransportRoute = () => {
    if (landTransportsData.length === 0) return;
    
    setLandTransportRoutes([...landTransportRoutes, {
      id: `land-${Date.now()}`,
      transportId: landTransportsData[0]?.id || '',
      origin: landTransportsData[0]?.origin || '',
      destination: landTransportsData[0]?.destination || '',
      price: Number(landTransportsData[0]?.price) || 0,
      participants: 1,
      originName: landTransportsData[0]?.origin_name || '',
      destinationName: landTransportsData[0]?.destination_name || ''
    }]);
  };

  // Remove land transport route
  const removeLandTransportRoute = (index: number) => {
    const updated = [...landTransportRoutes];
    updated.splice(index, 1);
    setLandTransportRoutes(updated);
  };

  // Update land transport route
  const updateLandTransportRoute = (index: number, field: keyof TransportRoute, value: string | number) => {
    const updated = [...landTransportRoutes];
    
    if (field === 'transportId') {
      // Find the selected transport and update all related fields
      const selectedTransport = landTransportsData.find(t => t.id === value);
      if (selectedTransport) {
        updated[index] = {
          ...updated[index],
          transportId: selectedTransport.id,
          origin: selectedTransport.origin,
          destination: selectedTransport.destination,
          price: Number(selectedTransport.price),
          originName: selectedTransport.origin_name,
          destinationName: selectedTransport.destination_name
        };
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    
    setLandTransportRoutes(updated);
  };

  // Add air transport route
  const addAirTransportRoute = () => {
    if (airTransportsData.length === 0) return;
    
    setAirTransportRoutes([...airTransportRoutes, {
      id: `air-${Date.now()}`,
      transportId: airTransportsData[0]?.id || '',
      origin: airTransportsData[0]?.origin || '',
      destination: airTransportsData[0]?.destination || '',
      price: Number(airTransportsData[0]?.price) || 0,
      participants: 1,
      originName: airTransportsData[0]?.origin_name || '',
      destinationName: airTransportsData[0]?.destination_name || ''
    }]);
  };

  // Remove air transport route
  const removeAirTransportRoute = (index: number) => {
    const updated = [...airTransportRoutes];
    updated.splice(index, 1);
    setAirTransportRoutes(updated);
  };

  // Update air transport route
  const updateAirTransportRoute = (index: number, field: keyof TransportRoute, value: string | number) => {
    const updated = [...airTransportRoutes];
    
    if (field === 'transportId') {
      // Find the selected transport and update all related fields
      const selectedTransport = airTransportsData.find(t => t.id === value);
      if (selectedTransport) {
        updated[index] = {
          ...updated[index],
          transportId: selectedTransport.id,
          origin: selectedTransport.origin,
          destination: selectedTransport.destination,
          price: Number(selectedTransport.price),
          originName: selectedTransport.origin_name,
          destinationName: selectedTransport.destination_name
        };
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    
    setAirTransportRoutes(updated);
  };

  // Handle form submission
  const handleFormSubmit = async (data: SupervisionCost) => {
    try {
      setIsCalculating(true);
      setError(null);
      
      const totalBudget = watch('totalBudget');
      
      if (!totalBudget || totalBudget <= 0) {
        setError('Total budget must be greater than 0');
        setIsCalculating(false);
        return;
      }
      
      const supervisionCosts: SupervisionCost = {
        ...data,
        totalBudget: totalBudget || 0,
        // Ensure numeric values
        numberOfDays: Number(data.numberOfDays),
        numberOfSupervisors: Number(data.numberOfSupervisors),
        numberOfSupervisorsWithAdditionalCost: Number(data.numberOfSupervisorsWithAdditionalCost || 0),
        landTransportSupervisors: Number(data.landTransportSupervisors || 0),
        airTransportSupervisors: Number(data.airTransportSupervisors || 0),
        otherCosts: Number(data.otherCosts || 0),
        // Include additional data
        additionalLocations,
        landTransportRoutes,
        airTransportRoutes,
        costMode,
        supervision_details: {
          description: data.description,
          numberOfDays: Number(data.numberOfDays),
          numberOfSupervisors: Number(data.numberOfSupervisors),
          location: data.location,
          costMode,
          additionalLocations,
          landTransportRoutes,
          airTransportRoutes,
          additionalSupervisorCosts: data.additionalSupervisorCosts,
          otherCosts: Number(data.otherCosts || 0),
          justification: data.justification
        }
      };
      
      console.log("Submitting supervision costs:", supervisionCosts);
      
      try {
        // Call the onCalculate function from props
        await onCalculate(supervisionCosts);
        console.log("Supervision calculation successfully passed to parent");
      } catch (err) {
        console.error("Error in onCalculate callback:", err);
        setError(`Failed to process: ${err instanceof Error ? err.message : String(err)}`);
        setIsCalculating(false);
      }
    } catch (error: any) {
      console.error('Failed to process supervision costs:', error);
      setError(error.message || 'Failed to process supervision costs. Please try again.');
      setIsCalculating(false);
    }
  };

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mb-4"></div>
        <p className="text-gray-700">Loading supervision costing data from database...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-h-[75vh] overflow-y-auto p-2 pb-20">
      <div className="flex items-center justify-between">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex-1">
          <h3 className="text-lg font-medium text-blue-800 mb-2 flex items-center">
            <Calculator className="h-5 w-5 mr-2" />
            Supervision Cost Calculator
          </h3>
          <p className="text-sm text-blue-600">
            Fill in the supervision details below to calculate the total budget.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="ml-4 p-2 text-gray-400 hover:text-gray-500"
        >
          <span className="sr-only">Cancel</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description of Supervision Activity
        </label>
        <textarea
          {...register('description', { required: 'Description is required' })}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Describe the supervision activity..."
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      {/* Main Location Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Primary Supervision Location
        </label>
        <select
          {...register('location', { required: 'Location is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">Select location...</option>
          {locationsData.map(location => (
            <option key={location.id} value={location.id}>
              {location.name}, {location.region}
              {location.is_hardship_area && ' (Hardship Area)'}
            </option>
          ))}
        </select>
        {errors.location && (
          <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
        )}
      </div>

      {/* Cost Mode Selection */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Cost Calculation Mode
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="relative flex items-center p-4 border rounded-lg cursor-pointer">
            <input
              type="radio"
              name="costMode"
              value="perdiem"
              checked={costMode === 'perdiem'}
              onChange={() => setCostMode('perdiem')}
              className="sr-only"
            />
            <div className={`flex items-center ${costMode === 'perdiem' ? 'text-blue-600' : 'text-gray-500'}`}>
              <DollarSign className="h-5 w-5 mr-2" />
              <div>
                <p className="font-medium">Per Diem Mode</p>
                <p className="text-sm">Calculate based on daily allowances</p>
              </div>
            </div>
            {costMode === 'perdiem' && (
              <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none" />
            )}
          </label>

          <label className="relative flex items-center p-4 border rounded-lg cursor-pointer">
            <input
              type="radio"
              name="costMode"
              value="accommodation"
              checked={costMode === 'accommodation'}
              onChange={() => setCostMode('accommodation')}
              className="sr-only"
            />
            <div className={`flex items-center ${costMode === 'accommodation' ? 'text-green-600' : 'text-gray-500'}`}>
              <DollarSign className="h-5 w-5 mr-2" />
              <div>
                <p className="font-medium">Accommodation Mode</p>
                <p className="text-sm">Calculate based on accommodation services</p>
              </div>
            </div>
            {costMode === 'accommodation' && (
              <div className="absolute inset-0 border-2 border-green-500 rounded-lg pointer-events-none" />
            )}
          </label>
        </div>
      </div>

      {/* Accommodation Type Selection - Only show in accommodation mode */}
      {costMode === 'accommodation' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Accommodation Service Type
          </label>
          <select
            {...register('accommodationType')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="LUNCH">Lunch</option>
            <option value="HALL_REFRESHMENT">Hall with Refreshment</option>
            <option value="DINNER">Dinner</option>
            <option value="BED">Bed</option>
            <option value="FULL_BOARD">Full Board</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Select the type of accommodation service for cost calculation
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Number of Days
          </label>
          <input
            type="number"
            min="1"
            {...register('numberOfDays', {
              required: 'Number of days is required',
              min: { value: 1, message: 'Minimum 1 day required' },
              valueAsNumber: true
            })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {errors.numberOfDays && (
            <p className="mt-1 text-sm text-red-600">{errors.numberOfDays.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Number of Supervisors
          </label>
          <input
            type="number"
            min="1"
            {...register('numberOfSupervisors', {
              required: 'Number of supervisors is required',
              min: { value: 1, message: 'Minimum 1 supervisor required' },
              valueAsNumber: true
            })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {errors.numberOfSupervisors && (
            <p className="mt-1 text-sm text-red-600">{errors.numberOfSupervisors.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Supervisors with Additional Costs
          </label>
          <input
            type="number"
            min="0"
            {...register('numberOfSupervisorsWithAdditionalCost', {
              min: { value: 0, message: 'Cannot be negative' },
              max: { 
                value: allFormValues.numberOfSupervisors || 0, 
                message: 'Cannot exceed total supervisors' 
              },
              valueAsNumber: true
            })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {errors.numberOfSupervisorsWithAdditionalCost && (
            <p className="mt-1 text-sm text-red-600">{errors.numberOfSupervisorsWithAdditionalCost.message}</p>
          )}
        </div>
      </div>

      {/* Additional Locations Section */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-md font-medium text-gray-700">Additional Supervision Locations</h4>
          <button
            type="button"
            onClick={addAdditionalLocation}
            disabled={locationsData.length === 0}
            className="flex items-center text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Location
          </button>
        </div>

        {additionalLocations.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No additional locations added</p>
        ) : (
          <div className="space-y-3">
            {additionalLocations.map((location, index) => (
              <div key={index} className="flex items-center space-x-4 bg-white p-3 rounded border">
                <div className="flex-1">
                  <div className="text-xs text-gray-500">
                    {(() => {
                      if (!location.locationId) return 'Select location';
                      
                      if (costMode === 'perdiem') {
                        const perDiemData = perDiemsData.find(pd => pd.location == location.locationId);
                        if (perDiemData) {
                          const dailyCost = Number(perDiemData.amount) + Number(perDiemData.hardship_allowance_amount || 0);
                          const totalCost = dailyCost * location.supervisors * location.days;
                          return `ETB ${totalCost.toLocaleString()}`;
                        }
                      } else {
                        const selectedAccommodationType = allFormValues.accommodationType || 'FULL_BOARD';
                        const accommodationData = accommodationsData.find(acc => 
                          acc.location == location.locationId && acc.service_type === selectedAccommodationType
                        );
                        if (accommodationData) {
                          const dailyCost = Number(accommodationData.price);
                          const totalCost = dailyCost * location.supervisors * location.days;
                          return `ETB ${totalCost.toLocaleString()}`;
                        }
                      }
                      return 'No rate found';
                    })()}
                  </div>
                  <select
                    value={location.locationId}
                    onChange={(e) => updateAdditionalLocation(index, 'locationId', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  >
                    <option value="">Select location...</option>
                    {locationsData.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}, {loc.region}
                        {loc.is_hardship_area && ' (Hardship Area)'}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-20">
                  <input
                    type="number"
                    min="1"
                    value={location.days}
                    onChange={(e) => updateAdditionalLocation(index, 'days', Number(e.target.value))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    placeholder="Days"
                  />
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    min="1"
                    value={location.supervisors}
                    onChange={(e) => updateAdditionalLocation(index, 'supervisors', Number(e.target.value))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    placeholder="Supervisors"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeAdditionalLocation(index)}
                  className="p-1 text-red-600 hover:text-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Additional Supervisor Costs */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Additional Supervisor Costs
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {supervisorCostsData.map(cost => (
            <label key={cost.id} className="flex items-center">
              <Controller
                name="additionalSupervisorCosts"
                control={control}
                defaultValue={[]}
                render={({ field }) => (
                  <input
                    type="checkbox"
                    value={cost.cost_type}
                    checked={field.value?.includes(cost.cost_type)}
                    onChange={(e) => {
                      const currentValues = field.value || [];
                      field.onChange(
                        e.target.checked
                          ? [...currentValues, cost.cost_type]
                          : currentValues.filter((v: string) => v !== cost.cost_type)
                      );
                    }}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                )}
              />
              <span className="ml-2 text-sm text-gray-700">
                {cost.cost_type_display} - ETB {Number(cost.amount).toLocaleString()}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Transport Section */}
      <div>
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            {...register('transportRequired')}
            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
          />
          <label className="ml-2 text-sm font-medium text-gray-700">
            Transport Required
          </label>
        </div>
      </div>
      
      {allFormValues.transportRequired && (
        <div className="space-y-6">
          {/* Simple Transport Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Land Transport Supervisors
              </label>
              <input
                type="number"
                min="0"
                {...register('landTransportSupervisors', {
                  min: { value: 0, message: 'Cannot be negative' },
                  max: { 
                    value: allFormValues.numberOfSupervisors || 0, 
                    message: 'Cannot exceed total supervisors' 
                  },
                  valueAsNumber: true
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              {errors.landTransportSupervisors && (
                <p className="mt-1 text-sm text-red-600">{errors.landTransportSupervisors.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Average cost: ETB {avgLandTransportCost.toLocaleString()} per supervisor
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Air Transport Supervisors
              </label>
              <input
                type="number"
                min="0"
                {...register('airTransportSupervisors', {
                  min: { value: 0, message: 'Cannot be negative' },
                  max: { 
                    value: allFormValues.numberOfSupervisors || 0, 
                    message: 'Cannot exceed total supervisors' 
                  },
                  valueAsNumber: true
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              {errors.airTransportSupervisors && (
                <p className="mt-1 text-sm text-red-600">{errors.airTransportSupervisors.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Average cost: ETB {avgAirTransportCost.toLocaleString()} per supervisor
              </p>
            </div>
          </div>

          {/* Detailed Land Transport Routes */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-md font-medium text-gray-700">Detailed Land Transport Routes</h4>
              <button
                type="button"
                onClick={addLandTransportRoute}
                disabled={landTransportsData.length === 0}
                className="flex items-center text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Route
              </button>
            </div>

            {landTransportRoutes.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No land transport routes added</p>
            ) : (
              <div className="space-y-3">
                {landTransportRoutes.map((route, index) => (
                  <div key={route.id} className="flex items-center space-x-4 bg-white p-3 rounded border">
                    <div className="flex-1">
                      <select
                        value={route.transportId}
                        onChange={(e) => updateLandTransportRoute(index, 'transportId', e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Select route...</option>
                        {landTransportsData.map(transport => (
                          <option key={transport.id} value={transport.id}>
                            {transport.origin_name} → {transport.destination_name} 
                            ({transport.trip_type}) - ETB {Number(transport.price).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        value={route.participants}
                        onChange={(e) => updateLandTransportRoute(index, 'participants', Number(e.target.value))}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        placeholder="Count"
                      />
                    </div>
                    <div className="text-sm font-medium text-green-600">
                      ETB {(Number(route.price) * Number(route.participants)).toLocaleString()}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLandTransportRoute(index)}
                      className="p-1 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detailed Air Transport Routes */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-md font-medium text-gray-700">Detailed Air Transport Routes</h4>
              <button
                type="button"
                onClick={addAirTransportRoute}
                disabled={airTransportsData.length === 0}
                className="flex items-center text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Route
              </button>
            </div>

            {airTransportRoutes.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No air transport routes added</p>
            ) : (
              <div className="space-y-3">
                {airTransportRoutes.map((route, index) => (
                  <div key={route.id} className="flex items-center space-x-4 bg-white p-3 rounded border">
                    <div className="flex-1">
                      <select
                        value={route.transportId}
                        onChange={(e) => updateAirTransportRoute(index, 'transportId', e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Select route...</option>
                        {airTransportsData.map(transport => (
                          <option key={transport.id} value={transport.id}>
                            {transport.origin_name} → {transport.destination_name} 
                            - ETB {Number(transport.price).toLocaleString()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        value={route.participants}
                        onChange={(e) => updateAirTransportRoute(index, 'participants', Number(e.target.value))}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        placeholder="Count"
                      />
                    </div>
                    <div className="text-sm font-medium text-green-600">
                      ETB {(Number(route.price) * Number(route.participants)).toLocaleString()}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAirTransportRoute(index)}
                      className="p-1 text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Cost Mode Information */}
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700 flex items-center">
              <Info className="h-4 w-4 mr-2" />
              <span>
                {costMode === 'perdiem' 
                  ? 'Calculating costs based on per diem rates (including hardship allowance where applicable)'
                  : `Calculating costs based on ${allFormValues.accommodationType || 'FULL_BOARD'} accommodation rates`
                }
              </span>
            </p>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Other Costs (ETB)
        </label>
        <input
          type="number"
          min="0"
          {...register('otherCosts', {
            min: { value: 0, message: 'Cannot be negative' },
            valueAsNumber: true
          })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="0"
        />
        {errors.otherCosts && (
          <p className="mt-1 text-sm text-red-600">{errors.otherCosts.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Justification for Additional Costs
        </label>
        <textarea
          {...register('justification')}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Explain any additional costs..."
        />
      </div>

      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <DollarSign className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-lg font-medium text-gray-900">Total Supervision Budget</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-2xl font-bold text-green-600">
              ETB {watch('totalBudget')?.toLocaleString() || '0'}
            </span>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={isCalculating}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCalculating}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
              >
                {isCalculating ? (
                  <>
                    <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  'Continue to Budget Form'
                )}
              </button>
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500 flex items-center">
          <Info className="h-4 w-4 mr-1" />
          This total is calculated based on supervision days, supervisors, locations, and {costMode === 'perdiem' ? 'per diem' : 'accommodation'} rates
        </p>
      </div>
    </form>
  );
};

export default SupervisionCostingTool;
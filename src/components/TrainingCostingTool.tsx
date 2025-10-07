import React, { useEffect, useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { Calculator, DollarSign, Info, Plus, Trash2, AlertCircle, Loader } from 'lucide-react';
import type { TrainingCost, TrainingLocation } from '../types/costing';
import { api } from '../lib/api';

// Fallback data if API fails
const FALLBACK_LOCATIONS = [
  { id: '1', name: 'Addis Ababa', region: 'Addis Ababa', is_hardship_area: false },
  { id: '2', name: 'Adama', region: 'Oromia', is_hardship_area: false },
  { id: '3', name: 'Bahir Dar', region: 'Amhara', is_hardship_area: false },
  { id: '4', name: 'Mekele', region: 'Tigray', is_hardship_area: false },
  { id: '5', name: 'Hawassa', region: 'Sidama', is_hardship_area: false },
  { id: '6', name: 'Gambella', region: 'Gambela', is_hardship_area: true },
  { id: '7', name: 'Semera', region: 'Afar', is_hardship_area: true },
  { id: '8', name: 'Jigjiga', region: 'Somali', is_hardship_area: true }
];

const FALLBACK_LAND_TRANSPORTS = [
  { id: '1', origin_name: 'Addis Ababa', destination_name: 'Adama', price: 1000 },
  { id: '2', origin_name: 'Addis Ababa', destination_name: 'Bahir Dar', price: 2000 },
  { id: '3', origin_name: 'Addis Ababa', destination_name: 'Mekele', price: 2500 }
];

const FALLBACK_AIR_TRANSPORTS = [
  { id: '1', origin_name: 'Addis Ababa', destination_name: 'Gambella', price: 7000 },
  { id: '2', origin_name: 'Addis Ababa', destination_name: 'Semera', price: 6500 },
  { id: '3', origin_name: 'Addis Ababa', destination_name: 'Jigjiga', price: 7500 }
];

const FALLBACK_ACCOMMODATIONS = [
  { id: '1', location_name: 'Addis Ababa', service_type: 'LUNCH', service_type_display: 'Lunch', price: 400 },
  { id: '2', location_name: 'Addis Ababa', service_type: 'DINNER', service_type_display: 'Dinner', price: 500 },
  { id: '3', location_name: 'Addis Ababa', service_type: 'BED', service_type_display: 'Bed', price: 1500 },
  { id: '4', location_name: 'Addis Ababa', service_type: 'FULL_BOARD', service_type_display: 'Full Board', price: 2400 }
];

interface TransportRoute {
  id: string;
  origin: string;
  destination: string;
  price: number;
  participants: number;
  originName?: string;
  destinationName?: string;
}

interface AdditionalLocation {
  locationId: string;
  days: number;
  participants: number;
}

interface TrainingCostingToolProps {
  onCalculate: (costs: TrainingCost) => void;
  onCancel: () => void;
  initialData?: TrainingCost;
}

const TrainingCostingTool: React.FC<TrainingCostingToolProps> = ({ 
  onCalculate,
  onCancel, 
  initialData 
}) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  
  // Data states
  const [locationsData, setLocationsData] = useState<any[]>([]);
  const [landTransportsData, setLandTransportsData] = useState<any[]>([]);
  const [airTransportsData, setAirTransportsData] = useState<any[]>([]);
  const [accommodationsData, setAccommodationsData] = useState<any[]>([]);
  const [perDiemsData, setPerDiemsData] = useState<any[]>([]);
  const [participantCostsData, setParticipantCostsData] = useState<any[]>([]);
  const [sessionCostsData, setSessionCostsData] = useState<any[]>([]);
  
  // Transport routes state
  const [landTransportRoutes, setLandTransportRoutes] = useState<TransportRoute[]>([]);
  const [airTransportRoutes, setAirTransportRoutes] = useState<TransportRoute[]>([]);
  
  // New state for accommodation and multiple locations
  const [costMode, setCostMode] = useState<'perdiem' | 'accommodation'>('perdiem');
  const [selectedAccommodationType, setSelectedAccommodationType] = useState<string>('BED');
  const [additionalLocations, setAdditionalLocations] = useState<AdditionalLocation[]>([]);
  
  const { register, watch, control, setValue, handleSubmit, formState: { errors }, getValues } = useForm<TrainingCost>({
    defaultValues: initialData || {
      description: '',
      numberOfDays: 1,
      numberOfParticipants: 1,
      numberOfSessions: 1,
      trainingLocationId: '',
      additionalParticipantCosts: [],
      additionalSessionCosts: [],
      transportRequired: false,
      landTransportParticipants: 0,
      airTransportParticipants: 0,
      otherCosts: 0
    }
  });

  const { fields: participantCostFields, append: appendParticipantCost, remove: removeParticipantCost } = useFieldArray({
    control,
    name: "additionalParticipantCosts"
  });

  const { fields: sessionCostFields, append: appendSessionCost, remove: removeSessionCost } = useFieldArray({
    control,
    name: "additionalSessionCosts"
  });

  const watchTransportRequired = watch('transportRequired');
  const watchLocation = watch('trainingLocationId');
  const watchDays = watch('numberOfDays');
  const watchParticipants = watch('numberOfParticipants');
  const watchSessions = watch('numberOfSessions');
  const watchParticipantCosts = watch('additionalParticipantCosts');
  const watchSessionCosts = watch('additionalSessionCosts');
  const watchOtherCosts = watch('otherCosts');
  
  // Add new watchers
  const watchCostMode = watch('costMode');

  // Fetch all required data from the database
  const fetchAllData = async () => {
    setIsLoading(true);
    setError(null);
    console.log('🔄 Starting to fetch training costing data...');
    
    try {
      // Fetch data step by step with better error handling
      const dataPromises = [
        api.get('/locations/').catch(err => {
          console.error('❌ Failed to fetch locations:', err);
          return { data: FALLBACK_LOCATIONS };
        }),
        api.get('/land-transports/').catch(err => {
          console.error('❌ Failed to fetch land transports:', err);
          return { data: FALLBACK_LAND_TRANSPORTS };
        }),
        api.get('/air-transports/').catch(err => {
          console.error('❌ Failed to fetch air transports:', err);
          return { data: FALLBACK_AIR_TRANSPORTS };
        }),
        api.get('/accommodations/').catch(err => {
          console.error('❌ Failed to fetch accommodations:', err);
          return { data: FALLBACK_ACCOMMODATIONS };
        }),
        api.get('/per-diems/').catch(err => {
          console.error('❌ Failed to fetch per diems:', err);
          return { data: [] };
        }),
        api.get('/participant-costs/').catch(err => {
          console.error('❌ Failed to fetch participant costs:', err);
          return { data: [] };
        }),
        api.get('/session-costs/').catch(err => {
          console.error('❌ Failed to fetch session costs:', err);
          return { data: [] };
        })
      ];

      const [
        locationsResult,
        landTransportsResult,
        airTransportsResult,
        accommodationsResult,
        perDiemsResult,
        participantCostsResult,
        sessionCostsResult
      ] = await Promise.all(dataPromises);

      // Process locations
      const locations = Array.isArray(locationsResult?.data) ? locationsResult.data : FALLBACK_LOCATIONS;
      console.log('✅ Locations loaded:', locations.length, 'items');
      setLocationsData(locations);

      // Process land transports
      const landTransports = Array.isArray(landTransportsResult?.data) ? landTransportsResult.data : FALLBACK_LAND_TRANSPORTS;
      console.log('✅ Land transports loaded:', landTransports.length, 'items');
      setLandTransportsData(landTransports);

      // Process air transports
      const airTransports = Array.isArray(airTransportsResult?.data) ? airTransportsResult.data : FALLBACK_AIR_TRANSPORTS;
      console.log('✅ Air transports loaded:', airTransports.length, 'items');
      setAirTransportsData(airTransports);

      // Process accommodations
      const accommodations = Array.isArray(accommodationsResult?.data) ? accommodationsResult.data : FALLBACK_ACCOMMODATIONS;
      console.log('✅ Accommodations loaded:', accommodations.length, 'items');
      setAccommodationsData(accommodations);

      // Process other data
      setPerDiemsData(Array.isArray(perDiemsResult?.data) ? perDiemsResult.data : []);
      setParticipantCostsData(Array.isArray(participantCostsResult?.data) ? participantCostsResult.data : []);
      setSessionCostsData(Array.isArray(sessionCostsResult?.data) ? sessionCostsResult.data : []);

      // Set default location if not already set
      if (locations.length > 0 && !watchLocation) {
        setValue('trainingLocationId', locations[0].id);
      }

      // Check if we're using any fallback data
      const usingFallback = 
        locations === FALLBACK_LOCATIONS ||
        landTransports === FALLBACK_LAND_TRANSPORTS ||
        airTransports === FALLBACK_AIR_TRANSPORTS ||
        accommodations === FALLBACK_ACCOMMODATIONS;
      
      setUsingFallbackData(usingFallback);
      setDataLoaded(true);
      
      console.log('✅ All training costing data loaded successfully');
      
    } catch (error) {
      console.error('❌ Critical error loading training data:', error);
      setError('Failed to load training data. Using fallback values.');
      
      // Use all fallback data
      setLocationsData(FALLBACK_LOCATIONS);
      setLandTransportsData(FALLBACK_LAND_TRANSPORTS);
      setAirTransportsData(FALLBACK_AIR_TRANSPORTS);
      setAccommodationsData(FALLBACK_ACCOMMODATIONS);
      setUsingFallbackData(true);
      setDataLoaded(true);
      
      if (FALLBACK_LOCATIONS.length > 0 && !watchLocation) {
        setValue('trainingLocationId', FALLBACK_LOCATIONS[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Add a new training location
  const addTrainingLocation = () => {
    if (!locationsData.length) return;
    
    const newLocation: AdditionalLocation = {
      locationId: locationsData[0]?.id || '',
      days: 1,
      participants: 1
    };
    
    setAdditionalLocations([...additionalLocations, newLocation]);
  };
  
  // Remove a training location
  const removeTrainingLocation = (index: number) => {
    const newLocations = [...additionalLocations];
    newLocations.splice(index, 1);
    setAdditionalLocations(newLocations);
  };
  
  // Update a training location
  const updateTrainingLocation = (index: number, field: keyof AdditionalLocation, value: any) => {
    const newLocations = [...additionalLocations];
    newLocations[index] = {
      ...newLocations[index],
      [field]: value
    };
    setAdditionalLocations(newLocations);
  };

  // Add transport route functions
  const addLandTransportRoute = () => {
    if (landTransportsData.length > 0) {
      const transport = landTransportsData[0];
      const newRoute: TransportRoute = {
        id: Date.now().toString(),
        origin: transport.origin_name || 'Origin',
        destination: transport.destination_name || 'Destination',
        price: Number(transport.price || 1000),
        participants: 1,
        originName: transport.origin_name,
        destinationName: transport.destination_name
      };
      setLandTransportRoutes([...landTransportRoutes, newRoute]);
    }
  };

  const addAirTransportRoute = () => {
    if (airTransportsData.length > 0) {
      const transport = airTransportsData[0];
      const newRoute: TransportRoute = {
        id: Date.now().toString(),
        origin: transport.origin_name || 'Origin',
        destination: transport.destination_name || 'Destination',
        price: Number(transport.price || 5000),
        participants: 1,
        originName: transport.origin_name,
        destinationName: transport.destination_name
      };
      setAirTransportRoutes([...airTransportRoutes, newRoute]);
    }
  };

  // Remove transport routes
  const removeLandTransportRoute = (id: string) => {
    setLandTransportRoutes(landTransportRoutes.filter(route => route.id !== id));
  };

  const removeAirTransportRoute = (id: string) => {
    setAirTransportRoutes(airTransportRoutes.filter(route => route.id !== id));
  };

  // Update transport route
  const updateLandTransportRoute = (id: string, field: string, value: any) => {
    setLandTransportRoutes(landTransportRoutes.map(route => 
      route.id === id ? { ...route, [field]: value } : route
    ));
  };

  const updateAirTransportRoute = (id: string, field: string, value: any) => {
    setAirTransportRoutes(airTransportRoutes.map(route => 
      route.id === id ? { ...route, [field]: value } : route
    ));
  };

  // Calculate total budget
  useEffect(() => {
    if (!dataLoaded) return;

    const calculateTotalBudget = () => {
      const locationId = watchLocation;
      const days = watchDays || 0;
      const participants = watchParticipants || 0;
      const numSessions = watchSessions || 1;

      // Get location data
      const location = locationsData.find(loc => String(loc.id) === String(locationId));
      if (!location) {
        setValue('totalBudget', 0);
        return 0;
      }

      // Calculate accommodation or per diem based on cost mode
      let accommodationPerDiemTotal = 0;
      
      if (costMode === 'accommodation') {
        // Accommodation calculation
        const accommodation = accommodationsData.find(acc => 
          (String(acc.location_id) === String(locationId) || 
           String(acc.location) === String(locationId) ||
           acc.location_name === location.name) && 
          acc.service_type === selectedAccommodationType
        );
        
        if (accommodation) {
          accommodationPerDiemTotal = Number(accommodation.price) * participants * days;
        } else {
          // Use default accommodation rates based on type
          let defaultPrice = 1500; // Default for BED
          if (selectedAccommodationType === 'LUNCH') defaultPrice = 400;
          else if (selectedAccommodationType === 'DINNER') defaultPrice = 500;
          else if (selectedAccommodationType === 'FULL_BOARD') defaultPrice = 2400;
          else if (selectedAccommodationType === 'HALL_REFRESHMENT') defaultPrice = 800;
          
          if (location.is_hardship_area) defaultPrice *= 1.1; // 10% increase for hardship areas
          accommodationPerDiemTotal = defaultPrice * participants * days;
        }
        
        // Add accommodation costs for additional locations
        additionalLocations.forEach(loc => {
          if (!loc.locationId) return;
          
          const additionalAccommodation = accommodationsData.find(acc => 
            (String(acc.location_id) === String(loc.locationId) || 
             String(acc.location) === String(loc.locationId)) && 
            acc.service_type === selectedAccommodationType
          );
          
          if (additionalAccommodation) {
            accommodationPerDiemTotal += Number(additionalAccommodation.price) * loc.participants * loc.days;
          } else {
            const additionalLocation = locationsData.find(l => String(l.id) === String(loc.locationId));
            let defaultPrice = 1500; // Default for BED
            if (selectedAccommodationType === 'LUNCH') defaultPrice = 400;
            else if (selectedAccommodationType === 'DINNER') defaultPrice = 500;
            else if (selectedAccommodationType === 'FULL_BOARD') defaultPrice = 2400;
            else if (selectedAccommodationType === 'HALL_REFRESHMENT') defaultPrice = 800;
            
            if (additionalLocation?.is_hardship_area) defaultPrice *= 1.1;
            accommodationPerDiemTotal += defaultPrice * loc.participants * loc.days;
          }
        });
      } else {
        // Per diem calculation
        const perDiem = perDiemsData.find(pd => 
          String(pd.location_id) === String(locationId) || 
          String(pd.location) === String(locationId)
        );
        
        if (perDiem) {
          const perDiemAmount = Number(perDiem.amount) || 1200;
          const hardshipAmount = Number(perDiem.hardship_allowance_amount) || (location.is_hardship_area ? 200 : 0);
          accommodationPerDiemTotal = (perDiemAmount + hardshipAmount) * participants * days;
        } else {
          // Use default per diem rates
          const defaultPerDiem = location.region === 'Addis Ababa' ? 1200 : 1100;
          const hardshipAmount = location.is_hardship_area ? 200 : 0;
          accommodationPerDiemTotal = (defaultPerDiem + hardshipAmount) * participants * days;
        }
        
        // Add per diems for additional locations
        additionalLocations.forEach(loc => {
          if (!loc.locationId) return;
          
          const additionalPerDiem = perDiemsData.find(pd => 
            String(pd.location_id) === String(loc.locationId) || 
            String(pd.location) === String(loc.locationId)
          );
          
          if (additionalPerDiem) {
            const addPerDiemAmount = Number(additionalPerDiem.amount || 0);
            const addHardshipAmount = Number(additionalPerDiem.hardship_allowance_amount || 0);
            accommodationPerDiemTotal += (addPerDiemAmount + addHardshipAmount) * loc.participants * loc.days;
          } else {
            const additionalLocation = locationsData.find(l => String(l.id) === String(loc.locationId));
            const defaultPerDiem = additionalLocation?.region === 'Addis Ababa' ? 1200 : 1100;
            const hardshipAmount = additionalLocation?.is_hardship_area ? 200 : 0;
            accommodationPerDiemTotal += (defaultPerDiem + hardshipAmount) * loc.participants * loc.days;
          }
        });
      }

      // Transport costs
      let transportTotal = 0;
      if (watchTransportRequired) {
        // Calculate from routes
        landTransportRoutes.forEach(route => {
          transportTotal += Number(route.price || 0) * Number(route.participants || 1);
        });
        
        airTransportRoutes.forEach(route => {
          transportTotal += Number(route.price || 0) * Number(route.participants || 1);
        });
      }

      // Additional participant costs
      let participantCostsTotal = 0;
      if (watchParticipantCosts && Array.isArray(watchParticipantCosts)) {
        watchParticipantCosts.forEach(cost => {
          if (cost.costType === 'ALL') {
            participantCostsTotal += participants * 700; // Default all costs
          } else if (cost.costType === 'FLASH_DISK') {
            participantCostsTotal += participants * 500;
          } else if (cost.costType === 'STATIONARY') {
            participantCostsTotal += participants * 200;
          }
        });
      }

      // Additional session costs
      let sessionCostsTotal = 0;
      if (watchSessionCosts && Array.isArray(watchSessionCosts) && numSessions > 0) {
        watchSessionCosts.forEach(cost => {
          if (cost.costType === 'ALL') {
            sessionCostsTotal += numSessions * 1000;
          } else if (cost.costType === 'FLIP_CHART') {
            sessionCostsTotal += numSessions * 300;
          } else if (cost.costType === 'MARKER') {
            sessionCostsTotal += numSessions * 150;
          } else if (cost.costType === 'TONER_PAPER') {
            sessionCostsTotal += numSessions * 1000;
          }
        });
      }

      // Other costs
      const otherCostsTotal = Number(watchOtherCosts) || 0;

      // Calculate subtotal (before session multiplier)
      const subtotal = accommodationPerDiemTotal + transportTotal + 
                      participantCostsTotal + sessionCostsTotal + otherCostsTotal;
      
      // Multiply entire subtotal by number of sessions (training repetitions)
      const total = subtotal * numSessions;

      setValue('totalBudget', total);
      return total;
    };

    calculateTotalBudget();
  }, [
    dataLoaded, watchLocation, watchDays, watchParticipants, watchSessions,
    watchTransportRequired, watchParticipantCosts, watchSessionCosts,
    watchOtherCosts, setValue, locationsData, accommodationsData,
    perDiemsData, landTransportRoutes, airTransportRoutes, costMode,
    selectedAccommodationType, additionalLocations
  ]);

  const handleFormSubmit = async (data: TrainingCost) => {
    try {
      setIsCalculating(true);
      setError(null);

      const calculatedBudget = watch('totalBudget') || 0;
      
      if (!calculatedBudget || calculatedBudget <= 0) {
        setError('Total budget must be greater than 0');
        return;
      }

      // Calculate transport costs
      let transportCosts = {
        landParticipants: 0,
        airParticipants: 0,
        totalCost: 0
      };
      
      if (watchTransportRequired) {
        const landParticipantsTotal = landTransportRoutes.reduce((sum, route) => sum + Number(route.participants || 1), 0);
        const airParticipantsTotal = airTransportRoutes.reduce((sum, route) => sum + Number(route.participants || 1), 0);
        const landCostTotal = landTransportRoutes.reduce((sum, route) => sum + (Number(route.price || 0) * Number(route.participants || 1)), 0);
        const airCostTotal = airTransportRoutes.reduce((sum, route) => sum + (Number(route.price || 0) * Number(route.participants || 1)), 0);
        
        transportCosts = {
          landParticipants: landParticipantsTotal,
          airParticipants: airParticipantsTotal,
          totalCost: landCostTotal + airCostTotal
        };
        
        // Note: Transport validation removed - participants can use both land and air transport
        // This allows for flexible transport arrangements where some participants may use multiple transport modes
      }

      const budgetData = {
        activity: data.activity,
        budget_calculation_type: 'WITH_TOOL',
        activity_type: 'Training',
        estimated_cost_with_tool: calculatedBudget || 0,
        totalBudget: calculatedBudget || 0,
        estimated_cost: calculatedBudget || 0,
        estimated_cost_without_tool: 0,
        government_treasury: 0,
        sdg_funding: 0,
        partners_funding: 0,
        other_funding: 0,
        training_details: {
          description: data.description,
          numberOfDays: Number(data.numberOfDays) || 0,
          numberOfParticipants: Number(data.numberOfParticipants) || 0,
          numberOfSessions: Number(data.numberOfSessions) || 0,
          trainingLocationId: data.trainingLocationId,
          costMode: costMode,
          selectedAccommodationType: selectedAccommodationType,
          additionalLocations: additionalLocations.map(loc => ({
            locationId: loc.locationId,
            days: Number(loc.days) || 0,
            participants: Number(loc.participants) || 0
          })),
          additionalParticipantCosts: data.additionalParticipantCosts,
          additionalSessionCosts: data.additionalSessionCosts,
          transportRequired: data.transportRequired,
          transportCosts: transportCosts,
          landTransportRoutes: landTransportRoutes,
          airTransportRoutes: airTransportRoutes,
          otherCosts: Number(data.otherCosts) || 0,
          justification: data.justification
        }
      };

      onCalculate(budgetData);
    } catch (err: any) {
      console.error('Failed to process training costs:', err);
      setError(err.message || 'Failed to process costs. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader className="h-12 w-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-700 text-lg">Loading training costing data...</p>
        <p className="text-gray-500 text-sm mt-2">Fetching locations, transport, and accommodation data</p>
      </div>
    );
  }

  // Show error state if data couldn't be loaded and no fallback is available
  if (!dataLoaded) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center text-red-500 mb-2">
          <AlertCircle className="h-6 w-6 mr-2 flex-shrink-0" />
          <h3 className="text-lg font-medium text-red-800">Failed to Load Training Data</h3>
        </div>
        <p className="text-red-600 mb-4">Could not load training costing data from the database.</p>
        <div className="space-y-2">
          <button
            onClick={fetchAllData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mr-2"
          >
            Retry Loading Data
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-white border border-red-300 rounded-md text-red-700 hover:bg-red-50"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-h-[80vh] overflow-y-auto p-2 pb-20">
      <div className="flex items-center justify-between">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex-1">
          <h3 className="text-lg font-medium text-blue-800 mb-2 flex items-center">
            <Calculator className="h-5 w-5 mr-2" />
            Training Cost Calculator
          </h3>
          <p className="text-sm text-blue-600">
            Fill in the training details below to calculate the total budget.
          </p>
          {usingFallbackData && (
            <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800">
              <Info className="h-3 w-3 inline mr-1" />
              Using default costing data. Database connection may be limited.
            </div>
          )}
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
          Description of Training Activity
        </label>
        <textarea
          {...register('description', { required: 'Description is required' })}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Describe the training activity..."
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      {/* Cost Mode Selection */}
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <h4 className="text-sm font-medium text-yellow-800 mb-3">Cost Calculation Mode</h4>
        <div className="grid grid-cols-2 gap-4">
          <label className="relative flex items-center p-3 rounded-lg border cursor-pointer">
            <input
              type="radio"
              value="perdiem"
              checked={costMode === 'perdiem'}
              onChange={(e) => setCostMode(e.target.value as 'perdiem' | 'accommodation')}
              className="sr-only"
            />
            <div className={`flex items-center ${costMode === 'perdiem' ? 'text-blue-600' : 'text-gray-500'}`}>
              <div className="flex flex-col">
                <span className="font-medium">Per Diem Mode</span>
                <span className="text-sm">Calculate based on daily allowances</span>
              </div>
            </div>
            {costMode === 'perdiem' && (
              <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none" />
            )}
          </label>

          <label className="relative flex items-center p-3 rounded-lg border cursor-pointer">
            <input
              type="radio"
              value="accommodation"
              checked={costMode === 'accommodation'}
              onChange={(e) => setCostMode(e.target.value as 'perdiem' | 'accommodation')}
              className="sr-only"
            />
            <div className={`flex items-center ${costMode === 'accommodation' ? 'text-blue-600' : 'text-gray-500'}`}>
              <div className="flex flex-col">
                <span className="font-medium">Accommodation Mode</span>
                <span className="text-sm">Calculate based on accommodation services</span>
              </div>
            </div>
            {costMode === 'accommodation' && (
              <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none" />
            )}
          </label>
        </div>
      </div>

      {/* Accommodation Type Selection (only when accommodation mode is selected) */}
      {costMode === 'accommodation' && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-blue-800 mb-3">Select Accommodation Type</h4>
          <select
            value={selectedAccommodationType}
            onChange={(e) => setSelectedAccommodationType(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="BED">Bed Only</option>
            <option value="LUNCH">Lunch</option>
            <option value="DINNER">Dinner</option>
            <option value="HALL_REFRESHMENT">Hall with Refreshment</option>
            <option value="FULL_BOARD">Full Board</option>
          </select>
          {accommodationsData.length > 0 && (
            <p className="mt-2 text-sm text-blue-600">
              ✅ Accommodation rates loaded from database ({accommodationsData.length} options available)
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            Number of Participants
          </label>
          <input
            type="number"
            min="1"
            {...register('numberOfParticipants', {
              required: 'Number of participants is required',
              min: { value: 1, message: 'Minimum 1 participant required' },
              valueAsNumber: true
            })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {errors.numberOfParticipants && (
            <p className="mt-1 text-sm text-red-600">{errors.numberOfParticipants.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Number of Sessions
          </label>
          <input
            type="number"
            min="1"
            {...register('numberOfSessions', {
              required: 'Number of sessions is required',
              min: { value: 1, message: 'Minimum 1 session required' },
              valueAsNumber: true
            })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          {errors.numberOfSessions && (
            <p className="mt-1 text-sm text-red-600">{errors.numberOfSessions.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Training Location
          </label>
          <select
            {...register('trainingLocationId', { required: 'Location is required' })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">Select location...</option>
            {locationsData.map(location => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.region}{location.is_hardship_area ? ' - Hardship' : ''})
              </option>
            ))}
          </select>
          {errors.trainingLocationId && (
            <p className="mt-1 text-sm text-red-600">{errors.trainingLocationId.message}</p>
          )}
        </div>
      </div>

      {/* Multiple Training Locations */}
      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-sm font-medium text-green-800">Additional Training Locations (Optional)</h4>
          <button
            type="button"
            onClick={addTrainingLocation}
            className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </button>
        </div>

        <div className="space-y-4">
          {additionalLocations.map((location, index) => (
            <div key={index} className="flex items-start gap-4 bg-white p-3 rounded-lg border border-green-200">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Location {index + 2}
                  </label>
                  <select
                    value={location.locationId}
                    onChange={(e) => updateTrainingLocation(index, 'locationId', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    {locationsData.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.region}{loc.is_hardship_area ? ' - Hardship' : ''})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Days
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={location.days}
                    onChange={(e) => updateTrainingLocation(index, 'days', Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Participants
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={location.participants}
                    onChange={(e) => updateTrainingLocation(index, 'participants', Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeTrainingLocation(index)}
                className="mt-4 text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
        
        {additionalLocations.length === 0 && (
          <p className="text-sm text-green-700 italic">
            No additional locations added. You can add multiple training locations to include in the cost calculation.
          </p>
        )}
      </div>

      {/* Transport Section */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Transport Required?
        </label>
        <div className="mt-2">
          <label className="inline-flex items-center">
            <input
              type="checkbox"
              {...register('transportRequired')}
              className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-700">Yes, transport is required</span>
          </label>
        </div>
      </div>

      {watchTransportRequired && (
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <h4 className="text-lg font-medium text-gray-800">Transport Configuration</h4>
          
          {/* Land Transport Routes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-medium text-gray-700">Land Transport Routes</h5>
              <button
                type="button"
                onClick={addLandTransportRoute}
                className="inline-flex items-center px-3 py-1 text-sm font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Land Route
              </button>
            </div>
            
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700 mb-2">
                <Info className="h-4 w-4 inline mr-1" />
                Available Land Transport Routes from Database:
              </p>
              {landTransportsData.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {landTransportsData.map((transport, index) => (
                    <div key={index} className="text-xs bg-white p-2 rounded border">
                      <strong>{transport.origin_name || 'Origin'} → {transport.destination_name || 'Destination'}</strong>
                      <br />Price: ETB {Number(transport.price || 0).toLocaleString()}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-blue-600">No land transport data available from database. Using defaults.</p>
              )}
            </div>
            
            {landTransportRoutes.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No land transport routes added</p>
            ) : (
              <div className="space-y-3">
                {landTransportRoutes.map((route) => (
                  <div key={route.id} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                    <div className="flex-1 mr-4 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700">Route</label>
                        <select
                          value={`${route.origin}-${route.destination}`}
                          onChange={(e) => {
                            const selectedTransport = landTransportsData.find(t => 
                              `${t.origin_name}-${t.destination_name}` === e.target.value
                            );
                            if (selectedTransport) {
                              updateLandTransportRoute(route.id, 'origin', selectedTransport.origin_name);
                              updateLandTransportRoute(route.id, 'destination', selectedTransport.destination_name);
                              updateLandTransportRoute(route.id, 'price', Number(selectedTransport.price));
                            }
                          }}
                          className="mt-1 block w-full text-xs rounded-md border-gray-300"
                        >
                          {landTransportsData.map((transport, index) => (
                            <option key={index} value={`${transport.origin_name}-${transport.destination_name}`}>
                              {transport.origin_name} → {transport.destination_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700">Price (ETB)</label>
                        <input
                          type="number"
                          min="1"
                          value={route.price}
                          onChange={(e) => updateLandTransportRoute(route.id, 'price', Number(e.target.value))}
                          className="mt-1 block w-full text-xs rounded-md border-gray-300"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700">Participants</label>
                        <input
                          type="number"
                          min="1"
                          value={route.participants}
                          onChange={(e) => updateLandTransportRoute(route.id, 'participants', Number(e.target.value))}
                          className="mt-1 block w-full text-xs rounded-md border-gray-300"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLandTransportRoute(route.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Air Transport Routes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-medium text-gray-700">Air Transport Routes</h5>
              <button
                type="button"
                onClick={addAirTransportRoute}
                className="inline-flex items-center px-3 py-1 text-sm font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Air Route
              </button>
            </div>
            
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700 mb-2">
                <Info className="h-4 w-4 inline mr-1" />
                Available Air Transport Routes from Database:
              </p>
              {airTransportsData.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {airTransportsData.map((transport, index) => (
                    <div key={index} className="text-xs bg-white p-2 rounded border">
                      <strong>{transport.origin_name || 'Origin'} → {transport.destination_name || 'Destination'}</strong>
                      <br />Price: ETB {Number(transport.price || 0).toLocaleString()}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-blue-600">No air transport data available from database. Using defaults.</p>
              )}
            </div>
            
            {airTransportRoutes.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No air transport routes added</p>
            ) : (
              <div className="space-y-3">
                {airTransportRoutes.map((route) => (
                  <div key={route.id} className="flex items-center justify-between bg-white p-3 rounded-lg border">
                    <div className="flex-1 mr-4 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700">Route</label>
                        <select
                          value={`${route.origin}-${route.destination}`}
                          onChange={(e) => {
                            const selectedTransport = airTransportsData.find(t => 
                              `${t.origin_name}-${t.destination_name}` === e.target.value
                            );
                            if (selectedTransport) {
                              updateAirTransportRoute(route.id, 'origin', selectedTransport.origin_name);
                              updateAirTransportRoute(route.id, 'destination', selectedTransport.destination_name);
                              updateAirTransportRoute(route.id, 'price', Number(selectedTransport.price));
                            }
                          }}
                          className="mt-1 block w-full text-xs rounded-md border-gray-300"
                        >
                          {airTransportsData.map((transport, index) => (
                            <option key={index} value={`${transport.origin_name}-${transport.destination_name}`}>
                              {transport.origin_name} → {transport.destination_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700">Price (ETB)</label>
                        <input
                          type="number"
                          min="1"
                          value={route.price}
                          onChange={(e) => updateAirTransportRoute(route.id, 'price', Number(e.target.value))}
                          className="mt-1 block w-full text-xs rounded-md border-gray-300"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-700">Participants</label>
                        <input
                          type="number"
                          min="1"
                          value={route.participants}
                          onChange={(e) => updateAirTransportRoute(route.id, 'participants', Number(e.target.value))}
                          className="mt-1 block w-full text-xs rounded-md border-gray-300"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAirTransportRoute(route.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Additional Costs Sections */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Additional Participant Costs
        </label>
        <div className="mt-2 space-y-2">
          {participantCostFields.map((field, index) => (
            <div key={field.id} className="flex items-center space-x-2">
              <select
                {...register(`additionalParticipantCosts.${index}.costType` as const)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="FLASH_DISK">Flash Disk</option>
                <option value="STATIONARY">Stationary</option>
                <option value="ALL">All</option>
              </select>
              <button
                type="button"
                onClick={() => removeParticipantCost(index)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => appendParticipantCost({ costType: 'FLASH_DISK' })}
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Participant Cost
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Additional Session Costs
        </label>
        <div className="mt-2 space-y-2">
          {sessionCostFields.map((field, index) => (
            <div key={field.id} className="flex items-center space-x-2">
              <select
                {...register(`additionalSessionCosts.${index}.costType` as const)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="FLIP_CHART">Flip Chart</option>
                <option value="MARKER">Marker</option>
                <option value="TONER_PAPER">Toner and Paper</option>
                <option value="ALL">All</option>
              </select>
              <button
                type="button"
                onClick={() => removeSessionCost(index)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => appendSessionCost({ costType: 'FLIP_CHART' })}
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Session Cost
          </button>
        </div>
      </div>

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

      {/* Budget Summary */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <DollarSign className="h-5 w-5 text-green-600 mr-1 flex-shrink-0" />
            <span className="text-lg font-medium text-gray-900">Total Training Budget</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-green-600">
              ETB {watch('totalBudget')?.toLocaleString() || '0'}
            </span>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500 flex items-center">
          <Info className="h-4 w-4 mr-1" />
          This total is calculated based on the training parameters and standard rates
        </p>
        {accommodationsData.length > 0 && (
          <p className="mt-1 text-xs text-green-600">
            ✅ Using accommodation data from database ({accommodationsData.length} rates loaded)
          </p>
        )}
      </div>

      <div className="flex justify-end space-x-2 sticky bottom-0 left-0 right-0 bg-white py-4 px-2 border-t border-gray-200 shadow-md z-10">
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
          disabled={isCalculating || !dataLoaded}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
        >
          {isCalculating ? (
            <>
              <Loader className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            'Apply and Continue to Funding Sources'
          )}
        </button>
      </div>
    </form>
  );
};

export default TrainingCostingTool;
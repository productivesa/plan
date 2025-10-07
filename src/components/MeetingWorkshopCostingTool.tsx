import React, { useEffect, useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { Calculator, DollarSign, Info, Plus, Trash2, AlertCircle } from 'lucide-react';
import type { MeetingWorkshopCost, TrainingLocation } from '../types/costing';
import { locations, perDiems, accommodations, participantCosts, sessionCosts, landTransports, airTransports } from '../lib/api';

// Fallback data if API fails
const FALLBACK_LOCATIONS = [
  { id: 'fallback-1', name: 'Addis Ababa', region: 'Addis Ababa', is_hardship_area: false },
  { id: 'fallback-2', name: 'Adama', region: 'Oromia', is_hardship_area: false },
  { id: 'fallback-3', name: 'Bahirdar', region: 'Amhara', is_hardship_area: false },
  { id: 'fallback-4', name: 'Mekele', region: 'Tigray', is_hardship_area: false }
];

const FALLBACK_PER_DIEMS = [
  { id: 'fallback-1', location: 'fallback-1', amount: 1200, hardship_allowance_amount: 0 },
  { id: 'fallback-2', location: 'fallback-2', amount: 1000, hardship_allowance_amount: 0 }
];

const FALLBACK_ACCOMMODATIONS = [
  { id: 'fallback-1', location: 'fallback-1', service_type: 'BED', price: 1500 },
  { id: 'fallback-2', location: 'fallback-1', service_type: 'LUNCH', price: 300 }
];

const FALLBACK_PARTICIPANT_COSTS = [
  { id: 'fallback-1', cost_type: 'FLASH_DISK', price: 500 },
  { id: 'fallback-2', cost_type: 'STATIONARY', price: 200 }
];

const FALLBACK_SESSION_COSTS = [
  { id: 'fallback-1', cost_type: 'FLIP_CHART', price: 300 },
  { id: 'fallback-2', cost_type: 'MARKER', price: 150 }
];

interface TrainingLocationItem {
  locationId: string;
  days: number;
  participants: number;
}

interface TransportRoute {
  id: string;
  transportId: string;
  origin: string;
  destination: string;
  price: number;
  participants: number;
}

interface MeetingWorkshopCostingToolProps {
  activityType: 'Meeting' | 'Workshop';
  onCalculate: (costs: MeetingWorkshopCost) => void;
  onCancel: () => void;
  initialData?: MeetingWorkshopCost;
}

interface MeetingLocation {
  locationId: string;
  days: number;
  participants: number;
}

const MeetingWorkshopCostingTool: React.FC<MeetingWorkshopCostingToolProps> = ({ 
  activityType,
  onCalculate, 
  onCancel,
  initialData 
}) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationsData, setLocationsData] = useState<any[]>([]);
  const [perDiemsData, setPerDiemsData] = useState<any[]>([]);
  const [accommodationsData, setAccommodationsData] = useState<any[]>([]);
  const [participantCostsData, setParticipantCostsData] = useState<any[]>([]);
  const [sessionCostsData, setSessionCostsData] = useState<any[]>([]);
  const [landTransportsData, setLandTransportsData] = useState<any[]>([]);
  const [airTransportsData, setAirTransportsData] = useState<any[]>([]);
  const [landTransportRoutes, setLandTransportRoutes] = useState<TransportRoute[]>([]);
  const [airTransportRoutes, setAirTransportRoutes] = useState<TransportRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLocations, setSelectedLocations] = useState<TrainingLocationItem[]>([]);
  const [costMode, setCostMode] = useState<'perdiem' | 'accommodation'>('perdiem');
  const [selectedAccommodationTypes, setSelectedAccommodationTypes] = useState<string[]>([]);
  const [additionalLocations, setAdditionalLocations] = useState<MeetingLocation[]>([]);
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('');
  
  const { register, watch, control, setValue, handleSubmit, formState: { errors }, trigger, getValues } = useForm<MeetingWorkshopCost>({
    defaultValues: initialData || {
      description: '',
      numberOfDays: 1,
      numberOfParticipants: 1,
      numberOfSessions: 1,
      location: '',
      trainingLocation: '',
      trainingLocations: [],
      costMode: 'perdiem',
      additionalParticipantCosts: [],
      additionalSessionCosts: [],
      transportRequired: false,
      otherCosts: 0
    }
  });

  const watchTransportRequired = watch('transportRequired');
  const watchCostMode = watch('costMode');
  const watchLocation = watch('trainingLocation');
  const watchDays = watch('numberOfDays');
  const watchParticipants = watch('numberOfParticipants');
  const watchNumberOfSessions = watch('numberOfSessions');
  const watchParticipantCosts = watch('additionalParticipantCosts');
  const watchSessionCosts = watch('additionalSessionCosts');
  const watchLandTransport = watch('landTransportParticipants');
  const watchAirTransport = watch('airTransportParticipants');
  const watchOtherCosts = watch('otherCosts');

  useEffect(() => {
    if (watchTransportRequired) {
      trigger(['landTransportParticipants', 'airTransportParticipants']);
    }
  }, [watchParticipants, trigger, watchTransportRequired]);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    setApiBaseUrl(apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      const errors: string[] = [];
      
      try {
        // Locations
        try {
          const locationsResult = await locations.getAll();
          setLocationsData(locationsResult?.data || FALLBACK_LOCATIONS);
        } catch (e) {
          console.warn('Failed to fetch locations, using fallback:', e);
          setLocationsData(FALLBACK_LOCATIONS);
          errors.push('Locations data loaded from fallback');
        }
        
        // Per Diems
        try {
          const perDiemsResult = await perDiems.getAll();
          setPerDiemsData(perDiemsResult?.data || FALLBACK_PER_DIEMS);
        } catch (e) {
          console.warn('Failed to fetch per diems, using fallback:', e);
          setPerDiemsData(FALLBACK_PER_DIEMS);
          errors.push('Per diems data loaded from fallback');
        }
        
        // Accommodations
        try {
          const accommodationsResult = await accommodations.getAll();
          setAccommodationsData(accommodationsResult?.data || FALLBACK_ACCOMMODATIONS);
        } catch (e) {
          console.warn('Failed to fetch accommodations, using fallback:', e);
          setAccommodationsData(FALLBACK_ACCOMMODATIONS);
          errors.push('Accommodations data loaded from fallback');
        }
        
        // Participant Costs
        try {
          const participantCostsResult = await participantCosts.getAll();
          setParticipantCostsData(participantCostsResult?.data || FALLBACK_PARTICIPANT_COSTS);
        } catch (e) {
          console.warn('Failed to fetch participant costs, using fallback:', e);
          setParticipantCostsData(FALLBACK_PARTICIPANT_COSTS);
          errors.push('Participant costs data loaded from fallback');
        }
        
        // Session Costs
        try {
          const sessionCostsResult = await sessionCosts.getAll();
          setSessionCostsData(sessionCostsResult?.data || FALLBACK_SESSION_COSTS);
        } catch (e) {
          console.warn('Failed to fetch session costs, using fallback:', e);
          setSessionCostsData(FALLBACK_SESSION_COSTS);
          errors.push('Session costs data loaded from fallback');
        }
        
        // Land Transports
        try {
          const landTransportsResult = await landTransports.getAll();
          setLandTransportsData(landTransportsResult?.data || []);
        } catch (e) {
          console.warn('Failed to fetch land transports:', e);
          setLandTransportsData([]);
          errors.push('Land transport data not available');
        }
        
        // Air Transports
        try {
          const airTransportsResult = await airTransports.getAll();
          setAirTransportsData(airTransportsResult?.data || []);
        } catch (e) {
          console.warn('Failed to fetch air transports:', e);
          setAirTransportsData([]);
          errors.push('Air transport data not available');
        }
        
        // Set API errors if any
        if (errors.length > 0) {
          setApiErrors(errors);
        }
        
        // Set default location if available
        if (locationsData.length > 0 && !initialData?.trainingLocation) {
          setValue('trainingLocation', locationsData[0].id);
        }
      } catch (error) {
        console.error('Critical error fetching data:', error);
        setError('Using fallback data due to server issues');
        setLocationsData(FALLBACK_LOCATIONS);
        setPerDiemsData(FALLBACK_PER_DIEMS);
        setAccommodationsData(FALLBACK_ACCOMMODATIONS);
        setParticipantCostsData(FALLBACK_PARTICIPANT_COSTS);
        setSessionCostsData(FALLBACK_SESSION_COSTS);
        setLandTransportsData([]);
        setAirTransportsData([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [setValue, initialData]);

  const addLocation = () => {
    if (locationsData.length === 0) return;
    
    const newLocation: TrainingLocationItem = {
      locationId: locationsData[0]?.id || '',
      days: 1,
      participants: 1
    };
    
    setSelectedLocations([...selectedLocations, newLocation]);
  };
  
  const removeLocation = (index: number) => {
    const newLocations = [...selectedLocations];
    newLocations.splice(index, 1);
    setSelectedLocations(newLocations);
  };
  
  const updateLocation = (index: number, field: keyof TrainingLocationItem, value: any) => {
    const newLocations = [...selectedLocations];
    newLocations[index] = {
      ...newLocations[index],
      [field]: value
    };
    setSelectedLocations(newLocations);
  };

  const addMeetingLocation = () => {
    if (!locationsData.length) return;
    
    const newLocation: MeetingLocation = {
      locationId: locationsData[0]?.id || '',
      days: 1,
      participants: 1
    };
    
    setAdditionalLocations([...additionalLocations, newLocation]);
  };
  
  const removeMeetingLocation = (index: number) => {
    const newLocations = [...additionalLocations];
    newLocations.splice(index, 1);
    setAdditionalLocations(newLocations);
  };
  
  const updateMeetingLocation = (index: number, field: keyof MeetingLocation, value: any) => {
    const newLocations = [...additionalLocations];
    newLocations[index] = {
      ...newLocations[index],
      [field]: value
    };
    setAdditionalLocations(newLocations);
  };

  const addLandTransportRoute = () => {
    const defaultTransport = landTransportsData.length > 0 ? landTransportsData[0] : null;
    
    setLandTransportRoutes([...landTransportRoutes, {
      id: Date.now().toString(),
      transportId: defaultTransport?.id || '',
      origin: defaultTransport?.origin_name || 'Addis Ababa',
      destination: defaultTransport?.destination_name || 'Destination',
      price: Number(defaultTransport?.price || 0),
      participants: 1
    }]);
  };

  const addAirTransportRoute = () => {
    const defaultTransport = airTransportsData.length > 0 ? airTransportsData[0] : null;
    
    setAirTransportRoutes([...airTransportRoutes, {
      id: Date.now().toString(),
      transportId: defaultTransport?.id || '',
      origin: defaultTransport?.origin_name || 'Addis Ababa',
      destination: defaultTransport?.destination_name || 'Destination', 
      price: Number(defaultTransport?.price || 0),
      participants: 1
    }]);
  };

  const removeLandTransportRoute = (id: string) => {
    setLandTransportRoutes(landTransportRoutes.filter(route => route.id !== id));
  };

  const removeAirTransportRoute = (id: string) => {
    setAirTransportRoutes(airTransportRoutes.filter(route => route.id !== id));
  };

  const updateLandTransportRoute = (id: string, field: string, value: any) => {
    setLandTransportRoutes(landTransportRoutes.map(route => {
      if (route.id === id) {
        if (field === 'transportId') {
          const selectedTransport = landTransportsData.find(t => t.id === value);
          if (selectedTransport) {
            const dbPrice = Number(selectedTransport.price) || 
                           Number(selectedTransport.single_trip_price) || 
                           Number(selectedTransport.round_trip_price) || 0;
            return {
              ...route,
              transportId: value,
              origin: selectedTransport.origin_name || selectedTransport.origin,
              destination: selectedTransport.destination_name || selectedTransport.destination,
              price: dbPrice
            };
          }
        }
        if (field === 'price') {
          return { ...route, [field]: Number(value) || 0 };
        }
        return { ...route, [field]: value };
      }
      return route;
    }));
  };

  const updateAirTransportRoute = (id: string, field: string, value: any) => {
    setAirTransportRoutes(airTransportRoutes.map(route => {
      if (route.id === id) {
        if (field === 'transportId') {
          const selectedTransport = airTransportsData.find(t => t.id === value);
          if (selectedTransport) {
            const dbPrice = Number(selectedTransport.price) || 
                           Number(selectedTransport.single_trip_price) || 
                           Number(selectedTransport.round_trip_price) || 0;
            return {
              ...route,
              transportId: value,
              origin: selectedTransport.origin_name || selectedTransport.origin,
              destination: selectedTransport.destination_name || selectedTransport.destination,
              price: dbPrice
            };
          }
        }
        if (field === 'price') {
          return { ...route, [field]: Number(value) || 0 };
        }
        return { ...route, [field]: value };
      }
      return route;
    }));
  };

  const calculateAvgLandTransportCost = () => {
    if (!landTransportsData || landTransportsData.length === 0) return 1000;
    
    let total = 0;
    let count = 0;
    
    landTransportsData.forEach(transport => {
      const price = Number(transport.price);
      if (!isNaN(price) && price > 0) {
        total += price;
        count++;
      }
    });
    
    return count > 0 ? total / count : 1000;
  };

  const calculateAvgAirTransportCost = () => {
    if (!airTransportsData || airTransportsData.length === 0) return 5000;
    
    let total = 0;
    let count = 0;
    
    airTransportsData.forEach(transport => {
      const price = Number(transport.single_trip_price);
      if (!isNaN(price) && price > 0) {
        total += price;
        count++;
      }
    });
    
    return count > 0 ? total / count : 5000;
  };

  const avgLandTransportCost = calculateAvgLandTransportCost();
  const avgAirTransportCost = calculateAvgAirTransportCost();

  useEffect(() => {
    if (initialData) {
      if (initialData.costMode) {
        setCostMode(initialData.costMode);
        setValue('costMode', initialData.costMode);
      }
      
      if (initialData.trainings && Array.isArray(initialData.trainings) && initialData.trainings.length > 0) {
        setSelectedLocations(initialData.trainings);
      }
      
      if (initialData.transportRequired && initialData.transportCosts) {
        if (initialData.transportCosts.landParticipants > 0) {
          const landRoute: TransportRoute = {
            id: Date.now().toString(),
            transportId: '',
            origin: 'Origin',
            destination: 'Destination',
            price: 1000,
            participants: initialData.transportCosts.landParticipants
          };
          setLandTransportRoutes([landRoute]);
        }
        
        if (initialData.transportCosts.airParticipants > 0) {
          const airRoute: TransportRoute = {
            id: (Date.now() + 100).toString(),
            transportId: '',
            origin: 'Origin',
            destination: 'Destination',
            price: 5000,
            participants: initialData.transportCosts.airParticipants
          };
          setAirTransportRoutes([airRoute]);
        }
      }
    }
  }, [initialData, setValue]);

  useEffect(() => {
    const calculateTotalBudget = () => {
      const locationId = watchLocation;
      const days = watchDays || 0;
      const participants = watchParticipants || 0;
      const numSessions = Number(watchNumberOfSessions) || 1;
      
      const location = locationsData.find(loc => String(loc.id) === String(locationId));
      if (!location) {
        setValue('totalBudget', 0);
        return 0;
      }
      
      let perDiemTotal = 0;
      if (costMode === 'perdiem') {
        const perDiem = perDiemsData.find(pd => 
          String(pd.location_id) === String(locationId) || 
          String(pd.location) === String(locationId)
        );
        
        if (perDiem) {
          const perDiemAmount = Number(perDiem.amount) || 0;
          const hardshipAmount = Number(perDiem.hardship_allowance_amount) || 0;
          perDiemTotal = (perDiemAmount + hardshipAmount) * participants * days;
          
          additionalLocations.forEach(loc => {
            if (!loc.locationId) return;
            
            const additionalPerDiem = perDiemsData.find(pd => 
              String(pd.location_id) === String(loc.locationId) || 
              String(pd.location) === String(loc.locationId)
            );
            
            if (additionalPerDiem) {
              const addPerDiemAmount = Number(additionalPerDiem.amount || 0);
              const addHardshipAmount = Number(additionalPerDiem.hardship_allowance_amount || 0);
              perDiemTotal += (addPerDiemAmount + addHardshipAmount) * loc.participants * loc.days;
            }
          });
        }
      } else {
        selectedAccommodationTypes.forEach(serviceType => {
          const accommodation = accommodationsData.find(acc => 
            (String(acc.location_id) === String(locationId) || 
             String(acc.location) === String(locationId)) && 
            acc.service_type === serviceType
          );
          
          if (accommodation) {
            perDiemTotal += Number(accommodation.price) * participants * days;
            
            additionalLocations.forEach(loc => {
              if (!loc.locationId) return;
              
              const additionalAccommodation = accommodationsData.find(acc => 
                (String(acc.location_id) === String(loc.locationId) || 
                 String(acc.location) === String(loc.locationId)) && 
                acc.service_type === serviceType
              );
              
              if (additionalAccommodation) {
                perDiemTotal += Number(additionalAccommodation.price) * loc.participants * loc.days;
              }
            });
          }
        });
      }
      
      let participantCostsTotal = 0;
      if (watchParticipantCosts && watchParticipantCosts.length > 0) {
        if (watchParticipantCosts.includes('ALL')) {
          const allCosts = participantCostsData
            .filter(cost => cost.cost_type !== 'ALL')
            .reduce((sum, cost) => sum + Number(cost.price || 0), 0);
          
          participantCostsTotal = participants * allCosts;
          
          additionalLocations.forEach(loc => {
            participantCostsTotal += loc.participants * allCosts;
          });
        } else {
          watchParticipantCosts.forEach(cost => {
            const costItem = participantCostsData.find(c => c.cost_type === cost);
            if (costItem) {
              participantCostsTotal += participants * Number(costItem.price || 0);
              
              additionalLocations.forEach(loc => {
                participantCostsTotal += loc.participants * Number(costItem.price || 0);
              });
            }
          });
        }
      }
      
      let sessionCostsTotal = 0;
      if (watchSessionCosts && watchSessionCosts.length > 0) {
        if (watchSessionCosts.includes('ALL')) {
          const allCosts = sessionCostsData
            .filter(cost => cost.cost_type !== 'ALL')
            .reduce((sum, cost) => sum + Number(cost.price || 0), 0);
          
          sessionCostsTotal = numSessions * allCosts;
        } else {
          watchSessionCosts.forEach(cost => {
            const costItem = sessionCostsData.find(c => c.cost_type === cost);
            if (costItem) {
              sessionCostsTotal += numSessions * Number(costItem.price || 0);
            }
          });
        }
      }
      
      let transportTotal = 0;
      if (watchTransportRequired) {
        landTransportRoutes.forEach(route => {
          transportTotal += Number(route.price || 0) * Number(route.participants || 1);
        });
        
        airTransportRoutes.forEach(route => {
          transportTotal += Number(route.price || 0) * Number(route.participants || 1);
        });
        
        if (landTransportRoutes.length === 0 && airTransportRoutes.length === 0) {
          const landParticipants = Number(watchLandTransport) || 0;
          const airParticipants = Number(watchAirTransport) || 0;
          transportTotal = (landParticipants * 1000) + (airParticipants * 5000);
        }
      }
      
      const otherCostsTotal = Number(watchOtherCosts) || 0;
      
      const subtotal = perDiemTotal + participantCostsTotal + sessionCostsTotal + transportTotal + otherCostsTotal;
      
      const total = subtotal * numSessions;
      
      setValue('totalBudget', total);
      return total;
    };

    calculateTotalBudget();
  }, [
    watchLocation, watchDays, watchParticipants, watchNumberOfSessions,
    watchParticipantCosts, watchSessionCosts, watchTransportRequired,
    watchLandTransport, watchAirTransport, watchOtherCosts, setValue,
    locationsData, perDiemsData, accommodationsData, participantCostsData, sessionCostsData,
    costMode, selectedAccommodationTypes, additionalLocations, landTransportRoutes, airTransportRoutes
  ]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mb-4"></div>
        <p className="text-gray-700">Loading meeting/workshop costing data...</p>
        <p className="text-sm text-gray-500 mt-2">Fetching locations, costs, and transport data...</p>
      </div>
    );
  }

  const handleFormSubmit = async (data: MeetingWorkshopCost) => {
    try {
      setIsCalculating(true);
      setError(null);
      
      const calculatedBudget = watch('totalBudget') || 0;
      const formValues = getValues();
      
      if (!calculatedBudget || calculatedBudget <= 0) {
        setError('Total budget must be greater than 0');
        return;
      }

      let transportCosts = {
        landParticipants: 0,
        airParticipants: 0,
        totalCost: 0
      };
      
      if (watchTransportRequired) {
        let landParticipantsTotal = 0;
        let landCostTotal = 0;
        
        landTransportRoutes.forEach(route => {
          landParticipantsTotal += Number(route.participants || 1);
          landCostTotal += Number(route.price || 0) * Number(route.participants || 1);
        });
        
        let airParticipantsTotal = 0;
        let airCostTotal = 0;
        
        airTransportRoutes.forEach(route => {
          airParticipantsTotal += Number(route.participants || 1);
          airCostTotal += Number(route.price || 0) * Number(route.participants || 1);
        });
        
        if (landTransportRoutes.length === 0 && Number(data.landTransportParticipants) > 0) {
          landParticipantsTotal = Number(data.landTransportParticipants);
          landCostTotal = landParticipantsTotal * avgLandTransportCost;
        }
        
        if (airTransportRoutes.length === 0 && Number(data.airTransportParticipants) > 0) {
          airParticipantsTotal = Number(data.airTransportParticipants);
          airCostTotal = airParticipantsTotal * avgAirTransportCost;
        }
        
        transportCosts = {
          landParticipants: landParticipantsTotal,
          airParticipants: airParticipantsTotal,
          totalCost: landCostTotal + airCostTotal
        };
      }
      
      const trainingLocations = [
        ...selectedLocations.map(loc => ({
          locationId: loc.locationId,
          days: Number(loc.days) || 0,
          participants: Number(loc.participants) || 0
        }))
      ];

      if (watchTransportRequired) {
        let totalTransportParticipants = 0;
        
        landTransportRoutes.forEach(route => {
          totalTransportParticipants += Number(route.participants || 0);
        });
        
        airTransportRoutes.forEach(route => {
          totalTransportParticipants += Number(route.participants || 0);
        });
        
        if (landTransportRoutes.length === 0 && airTransportRoutes.length === 0) {
          totalTransportParticipants = (Number(watchLandTransport) || 0) + (Number(watchAirTransport) || 0);
        }
        
        let totalParticipants = Number(watchParticipants) || 0;
        selectedLocations.forEach(loc => {
          totalParticipants += Number(loc.participants) || 0;
        });
        
        if (totalTransportParticipants > totalParticipants) {
          setError(`Total transport participants (${totalTransportParticipants}) cannot exceed total participants (${totalParticipants})`);
          return;
        }
      }

      const budgetData = {
        activity: data.activity,
        budget_calculation_type: 'WITH_TOOL',
        activity_type: activityType,
        estimated_cost_with_tool: Number(calculatedBudget) || 0,
        totalBudget: Number(calculatedBudget) || 0,
        estimated_cost: Number(calculatedBudget) || 0,
        estimated_cost_without_tool: 0,
        government_treasury: 0,
        sdg_funding: 0,
        partners_funding: 0,
        other_funding: 0,
        meeting_workshop_details: {
          description: data.description,
          trainingLocation: data.trainingLocation,
          numberOfDays: Number(data.numberOfDays) || 0,
          numberOfParticipants: Number(data.numberOfParticipants) || 0,
          numberOfSessions: Number(data.numberOfSessions) || 0,
          costMode: costMode,
          selectedAccommodationTypes: selectedAccommodationTypes,
          additionalLocations: additionalLocations,
          additionalParticipantCosts: data.additionalParticipantCosts,
          additionalSessionCosts: data.additionalSessionCosts,
          transportRequired: data.transportRequired,
          landTransportRoutes: landTransportRoutes,
          airTransportRoutes: airTransportRoutes,
          otherCosts: Number(data.otherCosts) || 0,
          justification: data.justification
        }
      };
      
      onCalculate(budgetData);
    } catch (err: any) {
      console.error('Failed to process costs:', err);
      setError(err.message || 'Failed to process costs. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-h-[75vh] overflow-y-auto p-2 pb-20">
      <div className="flex items-center justify-between">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex-1">
          <h3 className="text-lg font-medium text-blue-800 mb-2 flex items-center gap-2">
            <Calculator className="h-5 w-5 mr-2" />
            {activityType} Cost Calculator 
            <span className="bg-blue-200 text-xs px-2 py-1 rounded-full">{costMode === 'perdiem' ? 'Per Diem Mode' : 'Accommodation Mode'}</span>
          </h3>
          <p className="text-sm text-blue-600">
            Fill in the {activityType?.toLowerCase()} details below to calculate the total budget.
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

      {apiErrors.length > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Some data loaded from fallback:</p>
              <ul className="mt-1 text-sm text-yellow-700 list-disc list-inside">
                {apiErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description of {activityType} Activity <span className="text-red-500">*</span>
        </label>
        <textarea
          {...register('description', { required: 'Description is required' })}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder={`Describe what will be covered in this ${activityType?.toLowerCase()}...`}
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Number of Days <span className="text-red-500">*</span>
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
            placeholder="Enter number of days"
          />
          {errors.numberOfDays && (
            <p className="mt-1 text-sm text-red-600">{errors.numberOfDays.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Number of Participants <span className="text-red-500">*</span>
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
            placeholder="Enter number of participants"
          />
          {errors.numberOfParticipants && (
            <p className="mt-1 text-sm text-red-600">{errors.numberOfParticipants.message}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Number of Sessions <span className="text-red-500">*</span>
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
            placeholder="Enter number of sessions"
          />
          {errors.numberOfSessions && (
            <p className="mt-1 text-sm text-red-600">{errors.numberOfSessions.message}</p>
          )}
        </div>
      </div>

      <div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Meeting Location
          </label>
          <select
            {...register('trainingLocation', { required: 'Location is required' })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {locationsData.map(location => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.region}{location.is_hardship_area ? ' - Hardship' : ''})
              </option>
            ))}
          </select>
          {errors.trainingLocation && (
            <p className="mt-1 text-sm text-red-600">{errors.trainingLocation.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Cost Calculation Method
        </label>
        <div className="flex space-x-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              value="perdiem"
              checked={costMode === 'perdiem'}
              onChange={() => setCostMode('perdiem')}
              className="form-radio h-4 w-4 text-blue-600"
            />
            <span className="ml-2 text-sm text-gray-700">Per Diem</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              value="accommodation"
              checked={costMode === 'accommodation'}
              onChange={() => setCostMode('accommodation')}
              className="form-radio h-4 w-4 text-blue-600"
            />
            <span className="ml-2 text-sm text-gray-700">Accommodation</span>
          </label>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {costMode === 'perdiem' 
            ? 'Uses standard per diem rates for the location' 
            : 'Uses specific accommodation service rates'}
        </p>
      </div>

      {costMode === 'accommodation' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Accommodation Types
          </label>
          <div className="space-y-2">
            {['BED', 'LUNCH', 'DINNER', 'HALL_REFRESHMENT', 'FULL_BOARD'].map(type => (
              <label key={type} className="inline-flex items-center mr-4">
                <input
                  type="checkbox"
                  checked={selectedAccommodationTypes.includes(type)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedAccommodationTypes([...selectedAccommodationTypes, type]);
                    } else {
                      setSelectedAccommodationTypes(selectedAccommodationTypes.filter(t => t !== type));
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  {type === 'BED' ? 'Bed Only' :
                   type === 'LUNCH' ? 'Lunch' :
                   type === 'DINNER' ? 'Dinner' :
                   type === 'HALL_REFRESHMENT' ? 'Hall with Refreshment' :
                   'Full Board'}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Select the accommodation services required for the meeting/workshop
          </p>
        </div>
      )}

      <div className="mt-4">
        <div className="flex justify-between items-center mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Additional Meeting Locations (optional)
          </label>
          <button
            type="button"
            onClick={addMeetingLocation}
            className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Location
          </button>
        </div>

        <div className="space-y-4">
          {additionalLocations.map((location, index) => (
            <div key={index} className="flex items-start gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Location {index + 2}
                  </label>
                  <select
                    value={location.locationId}
                    onChange={(e) => updateMeetingLocation(index, 'locationId', e.target.value)}
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
                    onChange={(e) => updateMeetingLocation(index, 'days', Number(e.target.value))}
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
                    onChange={(e) => updateMeetingLocation(index, 'participants', Number(e.target.value))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeMeetingLocation(index)}
                className="mt-4 text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
        
        {additionalLocations.length === 0 && (
          <p className="text-sm text-gray-500 italic">No additional locations added</p>
        )}
      </div>
      
      {watchCostMode === 'perdiem' && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <h4 className="text-sm font-medium text-yellow-800 mb-2">Per Diem Rates</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {locationsData.slice(0, 4).map((location) => {
              const perDiem = perDiemsData.find(pd => 
                String(pd.location) === String(location.id)
              );
              
              if (!perDiem) return null;
              
              return (
                <div key={location.id} className="bg-white p-2 rounded text-xs">
                  <p className="font-medium text-gray-800">{location.name}</p>
                  <div className="flex justify-between mt-1">
                    <span>Base Rate:</span>
                    <span>{Number(perDiem.amount || 0).toLocaleString()} ETB</span>
                  </div>
                  {Number(perDiem.hardship_allowance_amount) > 0 && (
                    <div className="flex justify-between mt-1">
                      <span>Hardship:</span>
                      <span>{Number(perDiem.hardship_allowance_amount || 0).toLocaleString()} ETB</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {costMode === 'accommodation' && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Accommodation Rates</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {locationsData.slice(0, 4).map((location) => {
              const accommodation = accommodationsData.find(acc => 
                (String(acc.location) === String(location.id)) &&
                acc.service_type === 'FULL_BOARD'
              );
              
              if (!accommodation) return null;
              
              return (
                <div key={location.id} className="bg-white p-2 rounded text-xs">
                  <p className="font-medium text-gray-800">{location.name}</p>
                  <div className="flex justify-between mt-1">
                    <span>Full Board:</span>
                    <span>{Number(accommodation.price || 0).toLocaleString()} ETB</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Additional Cost per Participant
        </label>
        <Controller
          name="additionalParticipantCosts"
          control={control}
          render={({ field }) => (
            <div className="mt-2 space-y-2">
              {participantCostsData.map(cost => (
                <label key={cost.cost_type} className="inline-flex items-center mr-4">
                  <input
                    type="checkbox"
                    value={cost.cost_type}
                    checked={field.value?.includes(cost.cost_type)}
                    onChange={(e) => {
                      const value = e.target.value;
                      const currentValues = field.value || [];
                      const newSelection = e.target.checked
                        ? [...currentValues, value]
                        : currentValues.filter(v => v !== value);
                      field.onChange(newSelection);
                    }}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {cost.cost_type_display || cost.cost_type} (ETB {Number(cost.price).toLocaleString()})
                  </span>
                </label>
              ))}
            </div>
          )}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Additional Cost per Session
        </label>
        <Controller
          name="additionalSessionCosts"
          control={control}
          render={({ field }) => (
            <div className="mt-2 space-y-2">
              {sessionCostsData.map(cost => (
                <label key={cost.cost_type} className="inline-flex items-center mr-4">
                  <input
                    type="checkbox"
                    value={cost.cost_type}
                    checked={field.value?.includes(cost.cost_type)}
                    onChange={(e) => {
                      const value = e.target.value;
                      const currentValues = field.value || [];
                      const newSelection = e.target.checked
                        ? [...currentValues, value]
                        : currentValues.filter(v => v !== value);
                      field.onChange(newSelection);
                    }}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    {cost.cost_type_display || cost.cost_type} (ETB {Number(cost.price).toLocaleString()})
                  </span>
                </label>
              ))}
            </div>
          )}
        />
      </div>

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
            <span className="ml-2 text-sm text-gray-700">Yes</span>
          </label>
        </div>
      </div>

      {watchTransportRequired && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Land Transport Routes</h4>
              <button
                type="button"
                onClick={addLandTransportRoute}
                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
              >
                <Plus className="h-3 w-3 mr-1" /> Add Land Route
              </button>
            </div>
            
            {landTransportRoutes.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No land transport routes added</p>
            ) : (
              <div className="space-y-3">
                {landTransportRoutes.map((route) => (
                  <div key={route.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex-1 mr-4 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700">Transport Route</label>
                        <select
                          value={route.transportId || ''}
                          onChange={(e) => updateLandTransportRoute(route.id, 'transportId', e.target.value)}
                          className="mt-1 block w-full text-xs rounded-md border-gray-300"
                        >
                          <option value="">Select Route</option>
                          {landTransportsData.map(transport => (
                            <option key={transport.id} value={transport.id}>
                              {transport.origin_name} → {transport.destination_name} (ETB {Number(transport.price).toLocaleString()})
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Air Transport Routes</h4>
              <button
                type="button"
                onClick={addAirTransportRoute}
                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
              >
                <Plus className="h-3 w-3 mr-1" /> Add Air Route
              </button>
            </div>
            
            {airTransportRoutes.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No air transport routes added</p>
            ) : (
              <div className="space-y-3">
                {airTransportRoutes.map((route) => (
                  <div key={route.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex-1 mr-4 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700">Transport Route</label>
                        <select
                          value={route.transportId || ''}
                          onChange={(e) => updateAirTransportRoute(route.id, 'transportId', e.target.value)}
                          className="mt-1 block w-full text-xs rounded-md border-gray-300"
                        >
                          <option value="">Select Route</option>
                          {airTransportsData.map(transport => (
                            <option key={transport.id} value={transport.id}>
                              {transport.origin_name} → {transport.destination_name} (ETB {Number(transport.price).toLocaleString()})
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
            <DollarSign className="h-5 w-5 text-green-600 mr-1 flex-shrink-0" />
            <span className="text-lg font-medium text-gray-900">Total Budget</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-2xl font-bold text-green-600">
                ETB {watch('totalBudget')?.toLocaleString() || '0'}
              </span>
              <p className="text-xs text-gray-500">
                {additionalLocations.length > 0 && `Including ${additionalLocations.length} additional location(s)`}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500 flex items-center">
          <Info className="h-4 w-4 mr-1" />
          This total includes {costMode === 'perdiem' ? 'per diem' : 'accommodation'} costs
          {additionalLocations.length > 0 && ` for ${additionalLocations.length + 1} location(s)`}
          {accommodationsData.length > 0 && costMode === 'accommodation' ? ' (from database)' : ''}
        </p>
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
          disabled={isCalculating || !getValues('description')}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
        >
          {isCalculating ? (
            <>
              <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
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

export default MeetingWorkshopCostingTool;
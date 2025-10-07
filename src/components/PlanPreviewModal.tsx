import React, { useEffect, useState } from 'react';
import { X, FileSpreadsheet, File as FilePdf, RefreshCw, AlertCircle, Info, Loader } from 'lucide-react';
import { StrategicObjective } from '../types/organization';
import { PlanType } from '../types/plan';
import PlanReviewTable from './PlanReviewTable';
import { exportToExcel, exportToPDF } from '../lib/utils/export';
import { auth, objectives, initiatives, performanceMeasures, mainActivities } from '../lib/api';
import { processDataForExport } from '../lib/utils/export';

interface PlanPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  objectives: StrategicObjective[];
  organizationName: string;
  plannerName: string;
  fromDate: string;
  toDate: string;
  planType: PlanType;
  refreshKey?: number;
}

const PlanPreviewModal: React.FC<PlanPreviewModalProps> = ({
  isOpen,
  onClose,
  objectives,
  organizationName,
  plannerName,
  fromDate,
  toDate,
  planType,
  refreshKey = 0,
}) => {
  const [userOrgId, setUserOrgId] = useState<number | null>(null);
  const [processedObjectives, setProcessedObjectives] = useState<StrategicObjective[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [internalRefreshKey, setInternalRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Fetch current user's organization ID when the modal opens
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const authData = await auth.getCurrentUser();
        if (authData.userOrganizations && authData.userOrganizations.length > 0) {
          setUserOrgId(authData.userOrganizations[0].organization);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        setError('Failed to load user organization data');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (isOpen) {
      fetchUserData();
    }
  }, [isOpen, refreshKey]);

  // Comprehensive data fetching function
  const fetchCompleteObjectiveData = async (objectivesList: StrategicObjective[]) => {
    if (!userOrgId || !objectivesList.length) {
      return objectivesList;
    }

    try {
      console.log('Fetching complete data for objectives:', objectivesList.length);
      
      const enrichedObjectives = await Promise.all(
        objectivesList.map(async (objective) => {
          try {
            // Fetch fresh initiatives for this objective
            const initiativesResponse = await initiatives.getByObjective(objective.id.toString());
            const objectiveInitiatives = initiativesResponse?.data || [];

            // Filter initiatives based on user organization
            const filteredInitiatives = objectiveInitiatives.filter(initiative => 
              initiative.is_default || 
              !initiative.organization || 
              initiative.organization === userOrgId
            );

            // For each initiative, fetch performance measures and main activities
            const enrichedInitiatives = await Promise.all(
              filteredInitiatives.map(async (initiative) => {
                try {
                  // Fetch performance measures
                  const measuresResponse = await performanceMeasures.getByInitiative(initiative.id);
                  const allMeasures = measuresResponse?.data || [];
                  
                  // Filter measures by organization
                  const filteredMeasures = allMeasures.filter(measure =>
                    !measure.organization || measure.organization === userOrgId
                  );

                  // Fetch main activities
                  const activitiesResponse = await mainActivities.getByInitiative(initiative.id);
                  const allActivities = activitiesResponse?.data || [];
                  
                  // Filter activities by organization
                  const filteredActivities = allActivities.filter(activity =>
                    !activity.organization || activity.organization === userOrgId
                  );

                  return {
                    ...initiative,
                    performance_measures: filteredMeasures,
                    main_activities: filteredActivities
                  };
                } catch (error) {
                  console.error(`Error fetching data for initiative ${initiative.id}:`, error);
                  return {
                    ...initiative,
                    performance_measures: [],
                    main_activities: []
                  };
                }
              })
            );

            // Set effective weight correctly
            const effectiveWeight = objective.planner_weight !== undefined && objective.planner_weight !== null
              ? objective.planner_weight
              : objective.weight;

            return {
              ...objective,
              effective_weight: effectiveWeight,
              initiatives: enrichedInitiatives
            };
          } catch (error) {
            console.error(`Error processing objective ${objective.id}:`, error);
            return {
              ...objective,
              effective_weight: objective.weight,
              initiatives: []
            };
          }
        })
      );

      console.log('Successfully enriched objectives with complete data');
      return enrichedObjectives;
    } catch (error) {
      console.error('Error in fetchCompleteObjectiveData:', error);
      throw error;
    }
  };

  // Load and process objectives data when modal opens or refreshes
  useEffect(() => {
    const loadObjectivesData = async () => {
      if (!isOpen || !userOrgId) return;

      try {
        setIsLoading(true);
        setError(null);
        
        console.log('Loading objectives data with refresh key:', refreshKey, internalRefreshKey);
        
        // Fetch complete data for all objectives
        const enrichedObjectives = await fetchCompleteObjectiveData(objectives);
        
        setProcessedObjectives(enrichedObjectives);
        console.log('Processed objectives updated:', enrichedObjectives.length);
      } catch (error) {
        console.error('Error loading objectives data:', error);
        setError('Failed to load complete plan data');
      } finally {
        setIsLoading(false);
      }
    };

    loadObjectivesData();
  }, [isOpen, objectives, userOrgId, refreshKey, internalRefreshKey]);
  
  // Function to refresh the preview data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    
    try {
      console.log('Manual refresh triggered');
      
      // Force refresh by incrementing internal key
      setInternalRefreshKey(prev => prev + 1);
      
      // Also re-fetch the data immediately
      if (userOrgId && objectives.length > 0) {
        const enrichedObjectives = await fetchCompleteObjectiveData(objectives);
        setProcessedObjectives(enrichedObjectives);
      }
      
    } catch (error) {
      console.error('Error during refresh:', error);
      setError('Failed to refresh plan data');
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // If the modal is not open, don't render anything
  if (!isOpen) return null;
  
  const handleExportExcel = () => {
    // Format data for export
    const dataFormatted = formatDataForExport();
    exportToExcel(
      dataFormatted,
      `moh-plan-${new Date().toISOString().slice(0, 10)}`,
      'en',
      {
        organization: organizationName,
        planner: plannerName,
        fromDate: fromDate,
        toDate: toDate,
        planType: planType
      }
    );
  };

  const handleExportPDF = () => {
    // Format data for export
    const dataFormatted = formatDataForExport();
    exportToPDF(
      dataFormatted,
      `moh-plan-${new Date().toISOString().slice(0, 10)}`,
      'en',
      {
        organization: organizationName,
        planner: plannerName,
        fromDate: fromDate,
        toDate: toDate,
        planType: planType
      }
    );
  };

  const formatDataForExport = (): any[] => {
    return processDataForExport(processedObjectives, 'en');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Plan Preview</h2>
          <div className="flex items-center gap-2">
            {/* Refresh button */}
            {/* <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Preview
                </>
              )}
            </button> */}
            {/* Excel button */}
            {/* <button
              onClick={handleExportExcel}
              disabled={isLoading || processedObjectives.length === 0}
              className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </button> */}
            {/* Close button */}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <span className="sr-only">Close</span>
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="p-12 text-center">
            <Loader className="h-10 w-10 mx-auto text-green-500 animate-spin" />
            <p className="mt-4 text-gray-600 text-lg">
              {isRefreshing ? 'Refreshing plan data...' : 'Loading complete plan data...'}
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Fetching objectives, initiatives, performance measures, and activities...
            </p>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <div className="rounded-full bg-red-100 p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Plan Data</h3>
            <p className="text-red-600">{error}</p>
            <div className="flex space-x-3 mt-4 justify-center">
              {/* <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </button> */}
              {/* <button
                onClick={handleExportPDF}
                disabled={processedObjectives.length === 0}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 flex items-center disabled:opacity-50"
              >
                <FilePdf className="h-4 w-4 mr-2" />
                Export PDF
              </button> */}
            </div>
          </div>
        ) : (
          <div className="p-6">
            {(processedObjectives && processedObjectives.length > 0) ? (
              <div>
                <PlanReviewTable
                  objectives={processedObjectives}
                  onSubmit={async () => {}}
                  isSubmitting={false}
                  organizationName={organizationName}
                  plannerName={plannerName}
                  fromDate={fromDate}
                  toDate={toDate}
                  planType={planType}
                  isPreviewMode={true}
                  plannerOrgId={userOrgId} // This should be the planner's org ID from the plan context
                  key={`${refreshKey}-${internalRefreshKey}`}
                />
              </div>
            ) : (
              <div className="p-8 text-center bg-yellow-50 rounded-lg border border-yellow-200">
                <Info className="h-10 w-10 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-yellow-800 mb-2">No Complete Data Available</h3>
                <p className="text-yellow-700 mb-4">
                  {objectives.length === 0 
                    ? "No objectives were found for this plan. Make sure you've selected at least one objective."
                    : "The objectives exist but don't have complete data (initiatives, measures, or activities). Please add content to your plan first."
                  }
                </p>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 transition-colors"
                >
                  <RefreshCw className="h-4 w-4 inline mr-2" /> Refresh Data
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanPreviewModal;
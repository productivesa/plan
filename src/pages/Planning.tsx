import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  Plus,
  Edit,
  Trash2,
  Save,
  Loader,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  Send,
  Calculator,
  DollarSign,
  Activity,
  BarChart3,
  FileSpreadsheet,
  Building2,
  User,
  Calendar,
  FileType,
  Info,
  RefreshCw,
  Clock,
  XCircle
} from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import {
  organizations,
  objectives,
  programs,
  initiatives,
  performanceMeasures,
  mainActivities,
  plans,
  auth,
  activityBudgets,
  api
} from '../lib/api';
import type {
  Organization,
  StrategicObjective,
  Program,
  StrategicInitiative
} from '../types/organization';
import type {
  Plan,
  PlanType,
  MainActivity,
  PerformanceMeasure,
  ActivityBudget,
  BudgetCalculationType,
  ActivityType
} from '../types/plan';
import { isPlanner, isAdmin } from '../types/user';
import { format } from 'date-fns';

// Component imports
import PlanTypeSelector from '../components/PlanTypeSelector';
import ObjectiveSelectionMode from '../components/ObjectiveSelectionMode';
import HorizontalObjectiveSelector from '../components/HorizontalObjectiveSelector';
import StrategicObjectivesList from '../components/StrategicObjectivesList';
import InitiativeList from '../components/InitiativeList';
import InitiativeForm from '../components/InitiativeForm';
import PerformanceMeasureList from '../components/PerformanceMeasureList';
import PerformanceMeasureForm from '../components/PerformanceMeasureForm';
import MainActivityList from '../components/MainActivityList';
import MainActivityForm from '../components/MainActivityForm';
import ActivityBudgetForm from '../components/ActivityBudgetForm';
import ActivityBudgetDetails from '../components/ActivityBudgetDetails';
import ActivityBudgetSummary from '../components/ActivityBudgetSummary';
import PlanReviewTable from '../components/PlanReviewTable';
import PlanSubmitForm from '../components/PlanSubmitForm';
import PlanPreviewModal from '../components/PlanPreviewModal';
import PlanningHeader from '../components/PlanningHeader';

// Costing tool imports
import TrainingCostingTool from '../components/TrainingCostingTool';
import MeetingWorkshopCostingTool from '../components/MeetingWorkshopCostingTool';
import PrintingCostingTool from '../components/PrintingCostingTool';
import SupervisionCostingTool from '../components/SupervisionCostingTool';
import ProcurementCostingTool from '../components/ProcurementCostingTool';

type PlanningStep =
  | 'plan-type'
  | 'objective-selection'
  | 'planning'
  | 'review'
  | 'submit';

// Success Modal Component
interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewPlans: () => void;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, onClose, onViewPlans }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Plan Submitted Successfully!</h3>
          <p className="text-sm text-gray-500 mb-6">
            Your plan has been submitted for review. You can track its status in your plans dashboard.
          </p>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Continue Planning
            </button>
            <button
              onClick={onViewPlans}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
            >
              View My Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Plan Status Modal Component
interface PlanStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewPlans: () => void;
  planStatus: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | null;
  message: string;
}

const PlanStatusModal: React.FC<PlanStatusModalProps> = ({
  isOpen,
  onClose,
  onViewPlans,
  planStatus,
  message
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (planStatus) {
      case 'SUBMITTED':
        return <Clock className="h-6 w-6 text-yellow-600" />;
      case 'APPROVED':
        return <CheckCircle className="h-6 w-6 text-green-600" />;
      case 'REJECTED':
        return <XCircle className="h-6 w-6 text-red-600" />;
      default:
        return <AlertCircle className="h-6 w-6 text-blue-600" />;
    }
  };

  const getTitle = () => {
    switch (planStatus) {
      case 'SUBMITTED':
        return 'Plan Already Submitted';
      case 'APPROVED':
        return 'Plan Already Approved';
      case 'REJECTED':
        return 'Plan Was Rejected';
      default:
        return 'Plan Status';
    }
  };

  const getButtonText = () => {
    switch (planStatus) {
      case 'REJECTED':
        return 'Create New Plan';
      default:
        return 'View My Plans';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
            {getIcon()}
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{getTitle()}</h3>
          <p className="text-sm text-gray-500 mb-6">{message}</p>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            <button
              onClick={onViewPlans}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium ${
                planStatus === 'REJECTED'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {getButtonText()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Plans Table Component
interface PlansTableProps {
  onCreateNewPlan: () => void;
  userOrgId: number | null;
}

const PlansTable: React.FC<PlansTableProps> = ({ onCreateNewPlan, userOrgId }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch user's plans
  const { data: plansResponse, isLoading, refetch } = useQuery({
    queryKey: ['user-plans', userOrgId],
    queryFn: async () => {
      if (!userOrgId) return [];

      try {
        const response = await api.get('/plans/', {
          params: { organization: userOrgId }
        });

        // Handle different response structures
        if (response.data?.results) {
          return response.data.results; // For paginated responses
        } else if (Array.isArray(response.data)) {
          return response.data; // For array responses
        } else {
          return [response.data]; // For single object responses
        }
      } catch (error) {
        console.error('Error fetching user plans:', error);
        return [];
      }
    },
    enabled: !!userOrgId,
    retry: 2
  });

  // Delete main activity mutation
  const deleteMainActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      console.log('Planning: Deleting main activity:', activityId);
      
      try {
        // Ensure user is authenticated
        await auth.getCurrentUser();
        
        // Use the main activities API service
        const response = await mainActivities.delete(activityId);
        console.log('Planning: Main activity deleted successfully');
        return response;
        
      } catch (error) {
        console.error('Planning: Delete main activity error:', error);
        
        // Handle specific production errors
        if (error.response?.status === 500) {
          throw new Error('Unable to delete main activity. It may have sub-activities that need to be removed first.');
        } else if (error.response?.status === 404) {
          throw new Error('Main activity not found or already deleted.');
        } else if (error.response?.status === 403) {
          throw new Error('You do not have permission to delete this main activity.');
        }
        
        throw error;
      }
    },
    onSuccess: () => {
      console.log('Planning: Main activity deletion successful, refreshing data');
      // Refresh the activities list
      queryClient.invalidateQueries({ queryKey: ['main-activities'] });
      queryClient.invalidateQueries({ queryKey: ['initiatives'] });
      setSuccess('Main activity deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (error: any) => {
      console.error('Planning: Delete main activity mutation error:', error);
      setError(error.message || 'Failed to delete main activity');
      setTimeout(() => setError(null), 5000);
    }
  });

  // Delete performance measure mutation
  const deletePerformanceMeasureMutation = useMutation({
    mutationFn: async (measureId: string) => {
      console.log('Planning: Deleting performance measure:', measureId);
      
      try {
        // Ensure user is authenticated
        await auth.getCurrentUser();
        
        // Use the performance measures API service
        const response = await performanceMeasures.delete(measureId);
        console.log('Planning: Performance measure deleted successfully');
        return response;
        
      } catch (error) {
        console.error('Planning: Delete performance measure error:', error);
        
        // Handle specific production errors
        if (error.response?.status === 500) {
          throw new Error('Unable to delete performance measure due to server constraints.');
        } else if (error.response?.status === 404) {
          throw new Error('Performance measure not found or already deleted.');
        } else if (error.response?.status === 403) {
          throw new Error('You do not have permission to delete this performance measure.');
        }
        
        throw error;
      }
    },
    onSuccess: () => {
      console.log('Planning: Performance measure deletion successful, refreshing data');
      // Refresh the measures list
      queryClient.invalidateQueries({ queryKey: ['performance-measures'] });
      queryClient.invalidateQueries({ queryKey: ['initiatives'] });
      setSuccess('Performance measure deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (error: any) => {
      console.error('Planning: Delete performance measure mutation error:', error);
      setError(error.message || 'Failed to delete performance measure');
      setTimeout(() => setError(null), 5000);
    }
  });

  // Delete initiative mutation
  const deleteInitiativeMutation = useMutation({
    mutationFn: async (initiativeId: string) => {
      try {
        console.log('Planning: Deleting initiative:', initiativeId);
        
        // Ensure authentication
        await auth.getCurrentUser();
        
        // Delete the initiative (backend will handle cascade)
        const response = await initiatives.delete(initiativeId);
        console.log('Planning: Initiative deleted successfully');
        return response;
        
      } catch (error) {
        console.error('Planning: Delete initiative error:', error);
        
        // Production error handling
        if (error.response?.status === 500) {
          throw new Error('Server error occurred. The initiative may have dependencies preventing deletion. Please contact support if this persists.');
        } else if (error.response?.status === 404) {
          throw new Error('Initiative not found. It may have already been deleted.');
        } else if (error.response?.status === 403) {
          throw new Error('Permission denied. You do not have permission to delete this initiative.');
        } else if (error.response?.data?.error) {
          throw new Error(error.response.data.error);
        }
        
        throw error;
      }
    },
    onSuccess: () => {
      console.log('Planning: Initiative delete mutation successful');
      setSuccess('Initiative deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      
      // Reset selected initiative if it was deleted
      if (selectedInitiative?.id === deleteInitiativeMutation.variables) {
        setSelectedInitiative(null);
      }
      
      console.log('Planning: Initiative deletion successful, refreshing data');
      // Refresh the initiatives list
      queryClient.invalidateQueries({ queryKey: ['initiatives'] });
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      setSuccess('Initiative deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (error: any) => {
      console.error('Planning: Delete initiative mutation error:', error);
      setError(error.message || 'Failed to delete initiative');
      setTimeout(() => setError(null), 5000);
      
      // Reset selected initiative if it was the deleted one
      setSelectedInitiativeData(null);
    }
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'SUBMITTED':
        return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'DRAFT':
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleViewPlan = (plan: any) => {
    navigate(`/plans/${plan.id}`, { state: { activeTab: 'submitted' } });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="h-6 w-6 animate-spin mr-2" />
        <span>Loading your plans...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Your Plans</h2>
          <button
            onClick={onCreateNewPlan}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Plan
          </button>
        </div>

        {(!plansResponse || plansResponse.length === 0) ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Plans Created</h3>
            <p className="text-gray-500 mb-4">You haven't created any plans yet.</p>
            <button
              onClick={onCreateNewPlan}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Plan
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Planning Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {plansResponse.map((plan: any) => (
                  <tr key={plan.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {plan.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {plan.from_date && plan.to_date 
                        ? `${formatDate(plan.from_date)} - ${formatDate(plan.to_date)}` 
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(plan.status || 'DRAFT')}`}>
                        {plan.status || 'DRAFT'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(plan.submitted_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleViewPlan(plan)}
                        className="text-blue-600 hover:text-blue-900 flex items-center"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const Planning: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State declarations
  const [selectedObjectives, setSelectedObjectives] = useState<StrategicObjective[]>([]);
  const [selectedObjectivesWeights, setSelectedObjectivesWeights] = useState<Record<string, number>>({});
  const [currentStep, setCurrentStep] = useState<PlanningStep>('plan-type');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [planStatusInfo, setPlanStatusInfo] = useState<{
    status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | null;
    message: string;
  }>({ status: null, message: '' });
  const [showPlansTable, setShowPlansTable] = useState(true);
  const [editingInitiative, setEditingInitiative] = useState<StrategicInitiative | null>(null);
  const [editingMeasure, setEditingMeasure] = useState<PerformanceMeasure | null>(null);
  const [editingActivity, setEditingActivity] = useState<MainActivity | null>(null);
  const [editingBudget, setEditingBudget] = useState<ActivityBudget | null>(null);
  const [editingSubActivity, setEditingSubActivity] = useState<any>(null);
  const [selectedMainActivity, setSelectedMainActivity] = useState<MainActivity | null>(null);
  const [showSubActivityTypeSelector, setShowSubActivityTypeSelector] = useState(false);
  const [showSubActivityCostingTool, setShowSubActivityCostingTool] = useState(false);
  const [selectedSubActivityType, setSelectedSubActivityType] = useState<ActivityType | null>(null);
  const [subActivityCostingData, setSubActivityCostingData] = useState<any>(null);
  const [showSubActivityDetails, setShowSubActivityDetails] = useState(false);
  const [viewingSubActivity, setViewingSubActivity] = useState<any>(null);
  const [showSubActivityForm, setShowSubActivityForm] = useState(false);
  const [subActivityCostingType, setSubActivityCostingType] = useState<ActivityType | null>(null);
  const [isEditingSubActivity, setIsEditingSubActivity] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<MainActivity | null>(null);
  const [budgetCalculationType, setBudgetCalculationType] = useState<BudgetCalculationType>('WITHOUT_TOOL');
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType | null>(null);
  const [costingToolData, setCostingToolData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewTableData, setReviewTableData] = useState<any[]>([]);
  const [isPreparingReview, setIsPreparingReview] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [initiativeRefreshKey, setInitiativeRefreshKey] = useState(0);
  const [isLoadingReviewData, setIsLoadingReviewData] = useState(false);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
  const [optimisticUpdates, setOptimisticUpdates] = useState<Set<string>>(new Set());
  const [authChecked, setAuthChecked] = useState(false);
  const [isUserPlanner, setIsUserPlanner] = useState(false);
  const [userOrgId, setUserOrgId] = useState<number | null>(null);
  const [userOrganization, setUserOrganization] = useState<Organization | null>(null);
  const [plannerName, setPlannerName] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedPlanType, setSelectedPlanType] = useState<PlanType>('ANNUAL');
  const [selectedObjective, setSelectedObjective] = useState<StrategicObjective | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [selectedInitiative, setSelectedInitiative] = useState<StrategicInitiative | null>(null);
  const [selectedInitiativeData, setSelectedInitiativeData] = useState<any>(null);
  const [showInitiativeForm, setShowInitiativeForm] = useState(false);
  const [showMeasureForm, setShowMeasureForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showBudgetDetails, setShowBudgetDetails] = useState(false);
  const [showCostingTool, setShowCostingTool] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showActivityTypeSelection, setShowActivityTypeSelection] = useState(false);
  const [showTrainingCostingTool, setShowTrainingCostingTool] = useState(false);
  const [showMeetingWorkshopCostingTool, setShowMeetingWorkshopCostingTool] = useState(false);
  const [showPrintingCostingTool, setShowPrintingCostingTool] = useState(false);
  const [showSupervisionCostingTool, setShowSupervisionCostingTool] = useState(false);
  const [showProcurementCostingTool, setShowProcurementCostingTool] = useState(false);
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Calculate total weight
  const totalWeight = useMemo(() => {
    return selectedObjectives.reduce((sum, obj) => {
      const weight = selectedObjectivesWeights[obj.id] || obj.effective_weight || obj.planner_weight || obj.weight || 0;
      return sum + weight;
    }, 0);
  }, [selectedObjectives, selectedObjectivesWeights]);

  // Debounced refresh
  const debouncedRefresh = useCallback(
    () => {
      let timeoutId: NodeJS.Timeout;
      return () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => setRefreshKey(prev => prev + 1), 300);
      };
    }, []
  )();

  // Fetch current user and organization
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const authData = await auth.getCurrentUser();
        if (!authData.isAuthenticated) {
          navigate('/login');
          return;
        }

        setIsUserPlanner(isPlanner(authData.userOrganizations));

        if (authData.userOrganizations && authData.userOrganizations.length > 0) {
          const userOrg = authData.userOrganizations[0];
          setUserOrgId(userOrg.organization);

          // Fetch organization details
          setUserOrgId(userOrg.organization);
          try {
            const orgData = await organizations.getById(userOrg.organization.toString());
            setUserOrganization(orgData);
          } catch (orgError) {
            console.error('Failed to fetch organization details:', orgError);
          }
        }

        // Set planner name
        const fullName = `${authData.user?.first_name || ''} ${authData.user?.last_name || ''}`.trim();
        setPlannerName(fullName || authData.user?.username || 'Unknown Planner');

        // Set default dates (current fiscal year)
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const fiscalYearStart = new Date(currentYear, 6, 1); // July 1st
        const fiscalYearEnd = new Date(currentYear + 1, 5, 30); // June 30th next year

        setFromDate(fiscalYearStart.toISOString().split('T')[0]);
        setToDate(fiscalYearEnd.toISOString().split('T')[0]);

        setAuthChecked(true);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        setError('Failed to load user information');
        setAuthChecked(true);
      }
    };

    fetchUserData();
  }, [navigate]);

  // Check for existing plans after user data is loaded
  useEffect(() => {
    const checkExistingPlans = async () => {
      if (!userOrgId || !authChecked) return;

      try {
        const response = await api.get('/plans/', {
          params: { organization: userOrgId }
        });

        // Handle different response structures
        const plansData = response.data?.results || response.data || [];
        const plans = Array.isArray(plansData) ? plansData : [];

        // Check for existing plans with specific statuses
        const submittedPlan = plans.find((p: any) => p.status === 'SUBMITTED');
        const approvedPlan = plans.find((p: any) => p.status === 'APPROVED');
        const rejectedPlan = plans.find((p: any) => p.status === 'REJECTED');

        if (approvedPlan) {
          setPlanStatusInfo({
            status: 'APPROVED',
            message: 'Your plan has been approved. You cannot create a new plan until the next planning cycle.'
          });
          setShowStatusModal(true);
          setShowPlansTable(true);
        } else if (submittedPlan) {
          setPlanStatusInfo({
            status: 'SUBMITTED',
            message: 'You have already submitted a plan for this period. Please wait for review before creating a new plan.'
          });
          setShowStatusModal(true);
          setShowPlansTable(true);
        } else if (rejectedPlan) {
          // Allow creating a new plan if the existing plan was rejected
          setPlanStatusInfo({
            status: 'REJECTED',
            message: 'Your previous plan was rejected. You can create a new plan.'
          });
          setShowStatusModal(true);
          setShowPlansTable(true);
        } else {
          // No existing plans, allow creating a new plan
          setShowPlansTable(true);
        }
      } catch (error) {
        console.error('Failed to check existing plans:', error);
        setError('Failed to check existing plans');
        setShowPlansTable(true);
      }
    };

    checkExistingPlans();
  }, [userOrgId, authChecked]);

  // Fetch objectives with details
  const fetchObjectivesWithDetails = useCallback(async () => {
    try {
      console.log('Planning: Fetching objectives with details...');

      if (!selectedObjectives || selectedObjectives.length === 0) {
        console.log('Planning: No selected objectives to fetch details for');
        return [];
      }

      const objectiveIds = selectedObjectives.map(obj => Number(obj.id)).filter(id => !isNaN(id));

      if (objectiveIds.length === 0) {
        console.log('Planning: No valid objective IDs found');
        return [];
      }

      console.log('Planning: Fetching details for objective IDs:', objectiveIds);

      const response = await objectives.getAll({
        include_details: true,
        organization: userOrgId
      });

      if (!response?.data || !Array.isArray(response.data)) {
        throw new Error('Invalid objectives response');
      }

      const fetchedObjectives = response.data.filter((obj: StrategicObjective) =>
        objectiveIds.includes(obj.id)
      );

      const updatedObjectives = fetchedObjectives.map((obj: StrategicObjective) => {
        const existingObj = selectedObjectives.find(so => so.id === obj.id);
        return {
          ...obj,
          planner_weight: existingObj?.planner_weight ?? obj.planner_weight,
          effective_weight: existingObj?.effective_weight ?? obj.effective_weight
        };
      });

      console.log('Planning: Fetched objectives with details:', {
        count: updatedObjectives.length,
        objectives: updatedObjectives.map((obj: StrategicObjective) => ({
          id: obj.id,
          title: obj.title,
          weight: obj.weight,
          planner_weight: obj.planner_weight,
          effective_weight: obj.effective_weight,
          initiatives_count: obj.initiatives?.length || 0,
          performance_measures_count: obj.initiatives?.reduce((sum, init) => sum + (init.performance_measures?.length || 0), 0) || 0,
          main_activities_count: obj.initiatives?.reduce((sum, init) => sum + (init.main_activities?.length || 0), 0) || 0,
          sub_activities_count: obj.initiatives?.reduce((sum, init) => {
            return sum + (init.main_activities?.reduce((actSum, act) => actSum + (act.sub_activities?.length || 0), 0) || 0);
          }, 0) || 0
        }))
      });

      return updatedObjectives;
    } catch (error) {
      console.error('Planning: Error fetching objectives with details:', error);
      throw error;
    }
  }, [selectedObjectives, userOrgId, selectedObjectivesWeights, setSubmitError, setIsSubmittingPlan]);

  // Handle review with fresh data
  const handleReviewPlan = async () => {
    try {
      setIsLoadingReviewData(true);
      setError(null);

      console.log('Planning: Preparing review data...');
      console.log('Planning: Current selected objectives:', selectedObjectives.length, {
        objectives: selectedObjectives.map(obj => ({
          id: obj.id,
          title: obj.title,
          weight: obj.effective_weight ?? obj.planner_weight ?? obj.weight
        })),
        totalWeight
      });

      if (Math.abs(totalWeight - 100) > 0.01) {
        setError(`Total objective weights must equal 100%. Current total: ${totalWeight.toFixed(2)}%`);
        setIsLoadingReviewData(false);
        return;
      }

      if (selectedObjectives.length === 0) {
        setError('No objectives selected. Please go back and select objectives.');
        setIsLoadingReviewData(false);
        return;
      }

      const freshObjectives = await fetchObjectivesWithDetails();
      setSelectedObjectives(freshObjectives);

      setReviewRefreshKey(prev => prev + 1);

      console.log('Planning: Proceeding to review step with fresh objectives:', freshObjectives.length);
      setCurrentStep('review');
    } catch (error: any) {
      console.error('Planning: Error preparing review data:', error);
      setError(error.message || 'Failed to prepare review data. Please try again.');
    } finally {
      setIsLoadingReviewData(false);
    }
  };

  // Handle submit plan with data refresh
  const handleSubmitPlan = async (data: any) => {
    try {
      setIsSubmittingPlan(true);
      setSubmitError(null);
      setSubmitSuccess(null);

      console.log('Planning: Starting plan submission...');

      if (!userOrganization?.name || !plannerName || !fromDate || !toDate) {
        setSubmitError('Please fill in all required fields (organization, planner, dates)');
        return;
      }

      // Validate that we have selected objectives
      if (!selectedObjectives || selectedObjectives.length === 0) {
        setSubmitError('No objectives selected. Please select at least one objective before submitting.');
        setIsSubmittingPlan(false);
        return;
      }
      
      // Validate that we have user organization ID
      if (!userOrgId) {
        setSubmitError('User organization not found. Please refresh the page and try again.');
        setIsSubmittingPlan(false);
        return;
      }

      if (selectedObjectives.length === 0) {
        setSubmitError('Please select at least one strategic objective');
        return;
      }

      if (Math.abs(totalWeight - 100) > 0.01) {
        setSubmitError(`Total objective weights must equal 100%. Current total: ${totalWeight.toFixed(2)}%`);
        return;
      }

      // Get user organization ID
      const authData = await auth.getCurrentUser();
      const plannerOrgId = authData.userOrganizations?.[0]?.organization;
      
      if (!plannerOrgId) {
        throw new Error('User organization not found. Please refresh and try again.');
      }
      
      // Filter selected objectives to only include those for the planner's organization
      const plannerObjectives = selectedObjectives.filter(obj => {
        // Always include default objectives
        if (obj.is_default) return true;
        
        // Include custom objectives that belong to the planner's organization
        if (!obj.is_default && obj.organization_id) {
          return Number(obj.organization_id) === Number(userOrgId);
        }
        return Number(obj.organization_id) === Number(plannerOrgId);
        // Include objectives with no organization (legacy)
        return !obj.organization_id;
      });
      
      console.log('Planning: Filtered objectives for planner org:', plannerObjectives.length);
      
      // Convert selected objectives to IDs only
      const selectedObjectiveIds = selectedObjectives.map(obj => {
        if (typeof obj === 'object' && obj.id) {
          return Number(obj.id);
        } else if (typeof obj === 'number' || typeof obj === 'string') {
          return Number(obj);
        }
        throw new Error(`Invalid objective format: ${typeof obj}`);
      });
      
      console.log('Planning: Selected objective IDs:', selectedObjectiveIds);
      
      // Validate that we have weights for all selected objectives
      const hasAllWeights = selectedObjectiveIds.every(id => 
        selectedObjectivesWeights[id] !== undefined
      );
      
      if (!hasAllWeights) {
        throw new Error('Missing weights for some selected objectives');
      }
      
      // Create weights mapping for submission
      const weightsForSubmission: Record<string, number> = {};
      selectedObjectiveIds.forEach(id => {
        const weight = selectedObjectivesWeights[id];
        if (weight !== undefined) {
          weightsForSubmission[String(id)] = Number(weight);
        }
      });
      
      // Validate filtered total weight
      const filteredTotalWeight = Object.values(weightsForSubmission).reduce(
        (sum, weight) => sum + weight, 
        0
      );
      
      if (Math.abs(filteredTotalWeight - 100) > 0.01) {
        throw new Error(`Objectives weights must total 100%. Current: ${filteredTotalWeight.toFixed(2)}%`);
      }
      
      const planData = {
        organization: userOrgId,
        planner_name: plannerName,
        type: selectedPlanType,
        fiscal_year: new Date(fromDate).getFullYear().toString(),
        from_date: fromDate,
        to_date: toDate,
        status: 'SUBMITTED',
        selected_objectives: selectedObjectiveIds,
        selected_objectives_weights: weightsForSubmission,
        strategic_objective: selectedObjectiveIds[0] || null
      };

      console.log('Planning: Submitting plan with data:', planData);

      const response = await plans.create(planData);

      if (response.error) {
        throw new Error(response.error);
      }

      console.log('Planning: Plan submitted successfully:', response);

      setSubmitSuccess('Plan submitted successfully!');
      setShowSuccessModal(true);

      await queryClient.invalidateQueries({ queryKey: ['user-plans'] });

    } catch (error: any) {
      console.error('Planning: Plan submission failed:', error);

      let errorMessage = 'Failed to submit plan';
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.non_field_errors) {
          errorMessage = Array.isArray(error.response.data.non_field_errors)
            ? error.response.data.non_field_errors.join(', ')
            : error.response.data.non_field_errors;
        } else {
          const fieldErrors = Object.entries(error.response.data)
            .map(([field, errors]) => {
              const errorList = Array.isArray(errors) ? errors : [errors];
              return `${field}: ${errorList.join(', ')}`;
            })
            .join('; ');
          errorMessage = fieldErrors || errorMessage;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      setSubmitError(errorMessage);
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  // Early return for auth check
  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="h-6 w-6 animate-spin mr-2" />
        <span>Loading...</span>
      </div>
    );
  }

  // Check permissions
  if (!isUserPlanner && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center p-8 bg-yellow-50 rounded-lg border border-yellow-200">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-yellow-800 mb-2">Access Restricted</h3>
          <p className="text-yellow-600">{t('planning.permissions.plannerRequired')}</p>
        </div>
      </div>
    );
  }

  // Show plans table with submission restrictions
  if (showPlansTable && currentStep === 'plan-type') {
    return (
      <div className="px-4 py-6 sm:px-0">
        <PlansTable
          onCreateNewPlan={() => {
            // Only allow creating a new plan if there is no SUBMITTED or APPROVED plan
            if (planStatusInfo.status === 'SUBMITTED' || planStatusInfo.status === 'APPROVED') {
              setShowStatusModal(true);
            } else {
              setShowPlansTable(false);
              setCurrentStep('plan-type');
            }
          }}
          userOrgId={userOrgId}
        />

        <PlanStatusModal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          onViewPlans={() => {
            setShowStatusModal(false);
            if (planStatusInfo.status === 'REJECTED') {
              setShowPlansTable(false);
              setCurrentStep('plan-type');
            } else {
              navigate('/dashboard', { state: { activeTab: 'submitted' } });
            }
          }}
          planStatus={planStatusInfo.status}
          message={planStatusInfo.message}
        />
      </div>
    );
  }

  // Step handlers
  const handlePlanTypeSelect = (type: PlanType) => {
    setSelectedPlanType(type);
    setCurrentStep('objective-selection');
  };

  const handleObjectivesSelected = (objectives: StrategicObjective[]) => {
    console.log('Objectives selected in Planning:', objectives);
    setSelectedObjectives(objectives);
    
    // Update the weights mapping
    const weightsMap: Record<string, number> = {};
    objectives.forEach(obj => {
      weightsMap[obj.id] = obj.effective_weight || obj.planner_weight || obj.weight;
    });
    setSelectedObjectivesWeights(weightsMap);

    if (objectives.length === 1) {
      setSelectedObjective(objectives[0]);
    }
  };

  const handleProceedToPlanning = () => {
    console.log('Proceeding to planning with objectives:', selectedObjectives);
    setCurrentStep('planning');
  };

  const handleSelectObjective = (objective: StrategicObjective) => {
    console.log('Objective selected:', objective);
    setSelectedObjective(objective);
    setSelectedProgram(null);
    setSelectedInitiative(null);
  };

  const handleSelectProgram = (program: Program) => {
    console.log('Program selected:', program);
    setSelectedProgram(program);
    setSelectedObjective(null);
    setSelectedInitiative(null);
  };

  const handleSelectInitiative = (initiative: StrategicInitiative) => {
    console.log('Initiative selected:', initiative);
    setSelectedInitiative(initiative);
  };

  // Initiative CRUD handlers
  const handleEditInitiative = (initiative: StrategicInitiative | {}) => {
    const initiativeWithWeight = {
      ...initiative,
      parentWeight: selectedObjective ? (
        selectedObjectives.find(obj => obj.id === selectedObjective.id)?.effective_weight ||
        selectedObjectives.find(obj => obj.id === selectedObjective.id)?.planner_weight ||
        selectedObjective.weight
      ) : selectedProgram?.strategic_objective?.weight || 100,
      selectedObjectiveData: selectedObjective ?
        selectedObjectives.find(obj => obj.id === selectedObjective.id) : null
    };

    setEditingInitiative(initiative as StrategicInitiative);
    setShowInitiativeForm(true);
  };

  const handleSaveInitiative = async (data: any) => {
    try {
      setError(null);
      console.log('Planning: Starting initiative save with data:', data);

      if (editingInitiative?.id) {
        console.log('Planning: Updating existing initiative:', editingInitiative.id);
        await initiatives.update(editingInitiative.id, data);
      } else {
        console.log('Planning: Creating new initiative');
        await initiatives.create(data);
      }

      setShowInitiativeForm(false);
      setEditingInitiative(null);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['initiatives'] }),
        queryClient.invalidateQueries({ queryKey: ['objectives'] })
      ]);

      setInitiativeRefreshKey(prev => prev + 1);
      setSuccess('Initiative saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Failed to save initiative:', error);
      setError(error.message || 'Failed to save initiative');
    }
  };

  // Performance measure CRUD handlers
  const handleEditMeasure = (measure: PerformanceMeasure | {}) => {
    setEditingMeasure(measure as PerformanceMeasure);
    setShowMeasureForm(true);
  };

  const handleSaveMeasure = async (data: any) => {
    try {
      setError(null);
      if (editingMeasure?.id) {
        await performanceMeasures.update(editingMeasure.id, data);
      } else {
        await performanceMeasures.create(data);
      }
      setShowMeasureForm(false);
      setEditingMeasure(null);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['performance-measures'] }),
        queryClient.invalidateQueries({ queryKey: ['initiatives'] }),
        queryClient.invalidateQueries({ queryKey: ['objectives'] })
      ]);
      setSuccess('Performance measure saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Failed to save performance measure:', error);
      setError(error.message || 'Failed to save performance measure');
    }
  };

  // Main activity CRUD handlers
  const handleEditActivity = (activity: MainActivity | {}) => {
    setEditingActivity(activity as MainActivity);
    setShowActivityForm(true);
  };

  const handleSaveActivity = async (data: any) => {
    try {
      setError(null);
      if (editingActivity?.id) {
        await mainActivities.update(editingActivity.id, data);
      } else {
        await mainActivities.create(data);
      }
      setShowActivityForm(false);
      setEditingActivity(null);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['main-activities'] }),
        queryClient.invalidateQueries({ queryKey: ['initiatives'] }),
        queryClient.invalidateQueries({ queryKey: ['objectives'] })
      ]);
      setSuccess('Main activity saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Failed to save main activity:', error);
      setError(error.message || 'Failed to save main activity');
    }
  };

  const handleDeleteActivity = (activityId: string) => {
    console.log('Planning: handleDeleteActivity called for:', activityId);
    
    if (!activityId) {
      console.error('Planning: Invalid activity ID for deletion');
      setError('Invalid activity ID');
      return;
    }
    
    // Find the activity to get its name and sub-activities count
    const activity = selectedInitiative?.main_activities?.find(act => act.id === activityId);
    if (!activity) {
      console.error('Planning: Activity not found in current data:', activityId);
      setError('Activity not found');
      return;
    }
    
    const subActivitiesCount = activity.sub_activities?.length || 0;
    let confirmMessage = `Are you sure you want to delete "${activity.name}"?`;
    
    if (subActivitiesCount > 0) {
      confirmMessage += `\n\nThis will also delete ${subActivitiesCount} sub-activities and their budgets.`;
    }
    
    confirmMessage += `\n\nThis action cannot be undone.`;
    
    try {
      if (window.confirm(confirmMessage)) {
        console.log('Planning: User confirmed delete for activity:', activityId);
        setError(null); // Clear any previous errors
        deleteMainActivityMutation.mutate(activityId);
      }
    } catch (error: any) {
      console.error('Planning: Error in handleDeleteActivity:', error);
      setError('Failed to initiate deletion. Please try again.');
    }
  };

  // Sub-activity CRUD handlers
  const handleCreateSubActivity = (mainActivity: MainActivity) => {
    console.log('Planning: Creating sub-activity for main activity:', mainActivity.id);
    setSelectedMainActivity(mainActivity);
    setEditingSubActivity({
      main_activity: mainActivity.id,
      name: '',
      activity_type: 'Other',
      description: '',
      budget_calculation_type: 'WITHOUT_TOOL',
      estimated_cost_with_tool: 0,
      estimated_cost_without_tool: 0,
      government_treasury: 0,
      sdg_funding: 0,
      partners_funding: 0,
      other_funding: 0
    });
    setShowSubActivityForm(true);
    setShowSubActivityDetails(false);
    setShowActivityTypeSelection(false);
    setShowTrainingCostingTool(false);
    setShowMeetingWorkshopCostingTool(false);
    setShowPrintingCostingTool(false);
    setShowSupervisionCostingTool(false);
    setShowProcurementCostingTool(false);
  };

  const handleEditSubActivity = (subActivity: any, mainActivity: MainActivity) => {
    console.log('Planning: Editing sub-activity:', subActivity.id);
    setSelectedMainActivity(mainActivity);
    setEditingSubActivity(subActivity);
    setShowSubActivityForm(true);
    setShowSubActivityDetails(false);
    setShowActivityTypeSelection(false);
  };

  const handleViewSubActivity = (subActivity: any, mainActivity: MainActivity) => {
    console.log('Planning: Viewing sub-activity:', subActivity.id);
    handleEditSubActivity(subActivity, mainActivity);
  };

  const handleDeleteSubActivity = async (subActivityId: string, mainActivity: MainActivity) => {
    try {
      console.log('Planning: Deleting sub-activity:', subActivityId);
      await api.delete(`/sub-activities/${subActivityId}/`);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['main-activities'] }),
        queryClient.invalidateQueries({ queryKey: ['initiatives'] }),
        queryClient.invalidateQueries({ queryKey: ['objectives'] })
      ]);
      setRefreshKey(prev => prev + 1);

      setSuccess('Sub-activity deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Failed to delete sub-activity:', error);
      setError(error.message || 'Failed to delete sub-activity');
    }
  };

  const handleSaveSubActivity = async (data: any) => {
    try {
      setError(null);
      console.log('Planning: Saving sub-activity with data:', data);

      if (editingSubActivity?.id) {
        console.log('Planning: Updating existing sub-activity:', editingSubActivity.id);
        await api.put(`/sub-activities/${editingSubActivity.id}/`, data);
      } else {
        console.log('Planning: Creating new sub-activity');
        await api.post('/sub-activities/', data);
      }

      setShowSubActivityForm(false);
      setEditingSubActivity(null);
      setSelectedMainActivity(null);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sub-activities'] }),
        queryClient.invalidateQueries({ queryKey: ['main-activities'] }),
        queryClient.invalidateQueries({ queryKey: ['initiatives'] }),
        queryClient.invalidateQueries({ queryKey: ['objectives'] })
      ]);
      setRefreshKey(prev => prev + 1);

      setSuccess(editingSubActivity?.id ? 'Sub-activity updated successfully' : 'Sub-activity created successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Failed to save sub-activity:', error);
      setError(error.message || 'Failed to save sub-activity');
    }
  };

  // Budget handlers
  const handleAddBudget = (activity: MainActivity, calculationType: BudgetCalculationType, activityType?: ActivityType) => {
    setSelectedActivity(activity);
    setBudgetCalculationType(calculationType);
    setSelectedActivityType(activityType || null);

    if (calculationType === 'WITH_TOOL' && activityType) {
      setShowCostingTool(true);
    } else {
      setShowBudgetForm(true);
    }
  };

  const handleEditBudget = (activity: MainActivity) => {
    setSelectedActivity(activity);
    setEditingBudget(activity.budget || null);

    if (activity.budget?.budget_calculation_type === 'WITH_TOOL') {
      setBudgetCalculationType('WITH_TOOL');
      setSelectedActivityType(activity.budget.activity_type || null);
    } else {
      setBudgetCalculationType('WITHOUT_TOOL');
      setSelectedActivityType(null);
    }

    setShowBudgetForm(true);
  };

  const handleViewBudget = (activity: MainActivity) => {
    setSelectedActivity(activity);
    setShowBudgetDetails(true);
  };

  const handleCostingToolComplete = (costingData: any) => {
    console.log('Costing tool completed with data:', costingData);
    setCostingToolData(costingData);
    setShowCostingTool(false);
    setShowBudgetForm(true);
  };

  const handleSaveBudget = async (budgetData: any) => {
    try {
      if (!selectedActivity?.id) {
        throw new Error('No activity selected for budget');
      }

      console.log('Saving budget for activity:', selectedActivity.id);
      await mainActivities.updateBudget(selectedActivity.id, budgetData);

      setShowBudgetForm(false);
      setSelectedActivity(null);
      setEditingBudget(null);
      setCostingToolData(null);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['main-activities'] }),
        queryClient.invalidateQueries({ queryKey: ['initiatives'] }),
        queryClient.invalidateQueries({ queryKey: ['objectives'] })
      ]);
      setSuccess('Budget saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Failed to save budget:', error);
      setError(error.message || 'Failed to save budget');
    }
  };

  // Manual refresh handler for review step
  const handleRefreshReviewData = async () => {
    try {
      setIsLoadingReviewData(true);
      const freshObjectives = await fetchObjectivesWithDetails();
      setSelectedObjectives(freshObjectives);
      setReviewRefreshKey(prev => prev + 1);
      console.log('Planning: Manual review data refresh completed');
    } catch (error: any) {
      console.error('Planning: Error during manual review data refresh:', error);
      setError(error.message || 'Failed to refresh review data');
    } finally {
      setIsLoadingReviewData(false);
    }
  };

  const handleCreateNewPlan = () => {
    setShowPlansTable(false);
    setCurrentStep('plan-type');
    setSelectedObjectives([]);
    setSelectedObjective(null);
    setSelectedProgram(null);
    setSelectedInitiative(null);
    setError(null);
    setSuccess(null);
    setReviewRefreshKey(0);
    setIsLoadingReviewData(false);
  };

  const handleViewMyPlans = () => {
    // Refresh plans data
    queryClient.invalidateQueries({ queryKey: ['user-plans'] });
    navigate('/dashboard', { state: { activeTab: 'submitted' } });
  };

  // Navigation handlers
  const handleBack = () => {
    switch (currentStep) {
      case 'objective-selection':
        setCurrentStep('plan-type');
        break;
      case 'planning':
        setCurrentStep('objective-selection');
        break;
      case 'review':
        setCurrentStep('planning');
        break;
      case 'submit':
        setCurrentStep('review');
        break;
      default:
        setShowPlansTable(true);
    }
  };

  const handleCancel = () => {
    setShowInitiativeForm(false);
    setShowMeasureForm(false);
    setShowActivityForm(false);
    setShowBudgetForm(false);
    setShowBudgetDetails(false);
    setShowCostingTool(false);
    setEditingInitiative(null);
    setEditingMeasure(null);
    setEditingActivity(null);
    setEditingBudget(null);
    setSelectedActivity(null);
    setCostingToolData(null);
    setError(null);
  };

  // Render costing tools
  const renderCostingTool = () => {
    if (!selectedActivityType || !selectedActivity) return null;

    const commonProps = {
      onCalculate: handleCostingToolComplete,
      onCancel: handleCancel,
      initialData: costingToolData
    };

    switch (selectedActivityType) {
      case 'Training':
        return <TrainingCostingTool {...commonProps} />;
      case 'Meeting':
      case 'Workshop':
        return <MeetingWorkshopCostingTool {...commonProps} />;
      case 'Supervision':
        return <SupervisionCostingTool {...commonProps} />;
      case 'Printing':
        return <PrintingCostingTool {...commonProps} />;
      case 'Procurement':
        return <ProcurementCostingTool {...commonProps} />;
      default:
        return null;
    }
  };

  // Main render
  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Error and Success Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
          <CheckCircle className="h-5 w-5 mr-2" />
          {success}
        </div>
      )}

      {isLoadingReviewData && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center">
          <Loader className="h-5 w-5 animate-spin mr-2 text-blue-600" />
          <span className="text-blue-700">Loading latest plan data for review...</span>
        </div>
      )}

      {currentStep === 'objective-selection' && totalWeight !== 100 && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center text-yellow-700">
          <AlertCircle className="h-5 w-5 mr-2" />
          Total objective weights must equal 100%. Current total: {totalWeight.toFixed(2)}%
        </div>
      )}

      <div className="mb-8">
        <nav aria-label="Progress">
          <ol className="flex items-center">
            {[
              { key: 'plan-type', label: 'Plan Type' },
              { key: 'objective-selection', label: 'Objectives' },
              { key: 'planning', label: 'Planning' },
              { key: 'review', label: 'Review' }
            ].map((step, index) => (
              <li key={step.key} className={`${index !== 3 ? 'pr-8 sm:pr-20' : ''} relative`}>
                <div className="flex items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                    currentStep === step.key
                      ? 'border-green-600 bg-green-600 text-white'
                      : ['plan-type', 'objective-selection'].includes(step.key) &&
                        ['objective-selection', 'planning', 'review'].includes(currentStep)
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-gray-300 bg-white text-gray-500'
                  }`}>
                    <span className="text-sm font-medium">{index + 1}</span>
                  </div>
                  <span className={`ml-4 text-sm font-medium ${
                    currentStep === step.key ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {index !== 3 && (
                  <div className="absolute top-4 left-4 -ml-px mt-0.5 h-full w-0.5 bg-gray-300" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div className="space-y-8">
        {currentStep === 'plan-type' && (
          <PlanTypeSelector onSelectPlanType={handlePlanTypeSelect} />
        )}

        {currentStep === 'objective-selection' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back
              </button>
              <h2 className="text-xl font-semibold text-gray-900">
                Select Strategic Objectives
              </h2>
              <div></div>
            </div>

            <HorizontalObjectiveSelector
              onObjectivesSelected={handleObjectivesSelected}
              onProceed={handleProceedToPlanning}
              initialObjectives={selectedObjectives}
            />
          </div>
        )}

        {currentStep === 'planning' && (
          <div className="space-y-6">
            <PlanningHeader
              organizationName={userOrganization?.name || 'Unknown Organization'}
              fromDate={fromDate}
              toDate={toDate}
              plannerName={plannerName}
              planType={selectedPlanType}
              onFromDateChange={setFromDate}
              onToDateChange={setToDate}
              onPlanTypeChange={setSelectedPlanType}
            />

            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Objectives
              </button>

              <div className="flex space-x-3">
                <button
                  onClick={handleReviewPlan}
                  disabled={isLoadingReviewData || Math.abs(totalWeight - 100) > 0.01}
                  className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {isLoadingReviewData ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Preparing Review...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Review & Submit
                    </>
                  )}
                </button>
                {currentStep === 'planning' && (
                  <button
                    onClick={handleRefreshReviewData}
                    disabled={isLoadingReviewData}
                    className="flex items-center px-3 py-2 border border-blue-300 rounded-md text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                  >
                    {isLoadingReviewData ? (
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refresh Data
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Target className="h-5 w-5 mr-2 text-blue-600" />
                  Selected Objectives
                </h3>
                <StrategicObjectivesList
                  onSelectObjective={handleSelectObjective}
                  selectedObjectiveId={selectedObjective?.id}
                  onSelectProgram={handleSelectProgram}
                  selectedObjectives={selectedObjectives}
                />
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
                  Strategic Initiatives
                </h3>
                {(selectedObjective || selectedProgram) ? (
                  (() => {
                    let effectiveWeight = 100;
                    let selectedObjectiveData = null;

                    if (selectedObjective) {
                      selectedObjectiveData = selectedObjectives.find(obj => obj.id === selectedObjective.id);
                      effectiveWeight = selectedObjectiveData?.effective_weight ??
                        selectedObjectiveData?.planner_weight ??
                        selectedObjective?.weight ?? 100;
                    } else if (selectedProgram) {
                      const parentObjective = selectedObjectives.find(obj =>
                        obj.id === selectedProgram.strategic_objective_id ||
                        obj.id === selectedProgram.strategic_objective?.id
                      );
                      effectiveWeight = parentObjective?.effective_weight ??
                        parentObjective?.planner_weight ??
                        selectedProgram.strategic_objective?.weight ?? 100;
                    }

                    return (
                      <InitiativeList
                        parentId={(selectedObjective?.id || selectedProgram?.id)?.toString() || ''}
                        parentType={selectedObjective ? 'objective' : 'program'}
                        parentWeight={effectiveWeight}
                        selectedObjectiveData={selectedObjectiveData}
                        onEditInitiative={handleEditInitiative}
                        onSelectInitiative={handleSelectInitiative}
                        planKey={`planning-${refreshKey}`}
                        isUserPlanner={isUserPlanner}
                        userOrgId={userOrgId}
                        refreshKey={refreshKey}
                      />
                    );
                  })()
                ) : (
                  <div className="text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Select an objective to view initiatives</p>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Activity className="h-5 w-5 mr-2 text-purple-600" />
                    Performance Measures
                  </h3>
                  {selectedInitiative ? (
                    <PerformanceMeasureList
                      initiativeId={selectedInitiative.id}
                      initiativeWeight={Number(selectedInitiative.weight)}
                      onEditMeasure={handleEditMeasure}
                      onSelectMeasure={() => {}}
                      planKey={`planning-${refreshKey}`}
                    />
                  ) : (
                    <div className="text-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                      <Activity className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Select an initiative to view performance measures</p>
                    </div>
                  )}
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <DollarSign className="h-5 w-5 mr-2 text-orange-600" />
                    Main Activities
                  </h3>
                  {selectedInitiative ? (
                    <div className="space-y-4">
                      <MainActivityList
                        initiativeId={selectedInitiative.id}
                        initiativeWeight={Number(selectedInitiative.weight)}
                        onEditActivity={handleEditActivity}
                        onSelectActivity={() => {}}
                        isUserPlanner={isUserPlanner}
                        userOrgId={userOrgId}
                        planKey={`planning-${refreshKey}`}
                        refreshKey={refreshKey}
                        onCreateSubActivity={handleCreateSubActivity}
                        onEditSubActivity={handleEditSubActivity}
                        onViewSubActivity={handleViewSubActivity}
                        onDeleteSubActivity={handleDeleteSubActivity}
                        onDeleteActivity={handleDeleteActivity}
                      />

                      {isUserPlanner && (
                        <div className="text-center pt-4">
                          <button
                            onClick={() => handleEditActivity({})}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Main Activity
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                      <DollarSign className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Select an initiative to view main activities</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'review' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Planning
              </button>
              <h2 className="text-xl font-semibold text-gray-900">Review Your Plan</h2>
              <button
                onClick={handleRefreshReviewData}
                disabled={isLoadingReviewData}
                className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {isLoadingReviewData ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Data
                  </>
                )}
              </button>
            </div>

            <PlanReviewTable
              objectives={selectedObjectives}
              onSubmit={handleSubmitPlan}
              isSubmitting={isSubmittingPlan}
              organizationName={userOrganization?.name || 'Unknown Organization'}
              plannerName={plannerName}
              fromDate={fromDate}
              toDate={toDate}
              planType={selectedPlanType}
              plannerOrgId={userOrgId}
              refetchData={fetchObjectivesWithDetails}
              key={`review-${reviewRefreshKey}`}
            />
          </div>
        )}
      </div>

      {showInitiativeForm && (selectedObjective || selectedProgram) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingInitiative?.id ? 'Edit Initiative' : 'Create Initiative'}
            </h3>

            {(() => {
              let formParentWeight = 100;
              let selectedObjectiveData = null;

              if (selectedObjective) {
                selectedObjectiveData = selectedObjectives.find(obj => obj.id === selectedObjective.id);
                formParentWeight = selectedObjectiveData?.effective_weight ??
                  selectedObjectiveData?.planner_weight ??
                  selectedObjective?.weight ?? 100;
              } else if (selectedProgram) {
                const parentObjective = selectedObjectives.find(obj =>
                  obj.id === selectedProgram.strategic_objective_id ||
                  obj.id === selectedProgram.strategic_objective?.id
                );
                formParentWeight = parentObjective?.effective_weight ??
                  parentObjective?.planner_weight ??
                  selectedProgram.strategic_objective?.weight ?? 100;
              }

              console.log('InitiativeForm Modal - Weight calculation:', {
                selectedObjective: selectedObjective?.title,
                selectedProgram: selectedProgram?.name,
                selectedObjectiveData: selectedObjectiveData ? 'found' : 'not found',
                formParentWeight,
                originalWeight: selectedObjective?.weight || selectedProgram?.strategic_objective?.weight
              });

              return (
                <InitiativeForm
                  parentId={(selectedObjective?.id || selectedProgram?.id)?.toString() || ''}
                  parentType={selectedObjective ? 'objective' : 'program'}
                  parentWeight={formParentWeight}
                  selectedObjectiveData={selectedObjectiveData}
                  currentTotal={0}
                  onSubmit={handleSaveInitiative}
                  onCancel={handleCancel}
                  initialData={editingInitiative}
                />
              );
            })()}
          </div>
        </div>
      )}

      {showMeasureForm && selectedInitiative && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingMeasure?.id ? 'Edit Performance Measure' : 'Create Performance Measure'}
            </h3>

            <PerformanceMeasureForm
              initiativeId={selectedInitiative.id}
              currentTotal={0}
              onSubmit={handleSaveMeasure}
              onCancel={handleCancel}
              initialData={editingMeasure}
            />
          </div>
        </div>
      )}

      {showActivityForm && selectedInitiative && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingActivity?.id ? 'Edit Main Activity' : 'Create Main Activity'}
            </h3>

            <MainActivityForm
              initiativeId={selectedInitiative.id}
              currentTotal={0}
              onSubmit={handleSaveActivity}
              onCancel={handleCancel}
              initialData={editingActivity}
              onSuccess={() => {
                setShowActivityForm(false);
                setEditingActivity(null);
              }}
            />
          </div>
        </div>
      )}

      {showCostingTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedActivityType} Cost Calculator
              </h3>
              {renderCostingTool()}
            </div>
          </div>
        </div>
      )}

      {showSubActivityForm && selectedMainActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingSubActivity?.id ? 'Edit Sub-Activity' : 'Create Sub-Activity'} - {selectedMainActivity.name}
            </h3>

            <ActivityBudgetForm
              activity={selectedMainActivity}
              budgetCalculationType={editingSubActivity?.budget_calculation_type || 'WITHOUT_TOOL'}
              activityType={editingSubActivity?.activity_type || 'Other'}
              onSubmit={handleSaveSubActivity}
              onCancel={() => {
                setShowSubActivityForm(false);
                setEditingSubActivity(null);
                setSelectedMainActivity(null);
              }}
              initialData={editingSubActivity}
              costingToolData={subActivityCostingData}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {showBudgetForm && selectedActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingBudget ? 'Edit Budget' : 'Add Budget'} - {selectedActivity.name}
            </h3>

            <ActivityBudgetForm
              activity={selectedActivity}
              budgetCalculationType={budgetCalculationType}
              activityType={selectedActivityType}
              onSubmit={handleSaveBudget}
              onCancel={handleCancel}
              initialData={editingBudget || costingToolData}
              costingToolData={costingToolData}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {showBudgetDetails && selectedActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <ActivityBudgetDetails
              activity={selectedActivity}
              onBack={handleCancel}
              onEdit={() => {
                setShowBudgetDetails(false);
                handleEditBudget(selectedActivity);
              }}
              isReadOnly={!isUserPlanner}
            />
          </div>
        </div>
      )}

      <PlanPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        objectives={selectedObjectives}
        organizationName={userOrganization?.name || 'Unknown Organization'}
        plannerName={plannerName}
        fromDate={fromDate}
        toDate={toDate}
        planType={selectedPlanType}
        refreshKey={refreshKey}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          handleCreateNewPlan(); // Reset form without showing plans table
        }}
        onViewPlans={handleViewMyPlans}
      />

      <PlanStatusModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        onViewPlans={() => {
          setShowStatusModal(false);
          if (planStatusInfo.status === 'REJECTED') {
            handleCreateNewPlan();
          } else {
            navigate('/dashboard', { state: { activeTab: 'submitted' } });
          }
        }}
        planStatus={planStatusInfo.status}
        message={planStatusInfo.message}
      />
    </div>
  );
};

export default Planning;
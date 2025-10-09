import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, Calendar, Eye, Building2, CheckCircle, XCircle, AlertCircle, Loader, RefreshCw, BarChart3, PieChart, DollarSign, LayoutGrid } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { plans, organizations, auth, api } from '../lib/api';
import { format } from 'date-fns';
import PlanReviewForm from '../components/PlanReviewForm';
import { isEvaluator } from '../types/user';

const EvaluatorDashboard: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'reviewed'>('pending');
  const [userOrgIds, setUserOrgIds] = useState<number[]>([]);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isEvaluatorOnly, setIsEvaluatorOnly] = useState(false);
  const [currentEvaluatorIds, setCurrentEvaluatorIds] = useState<number[]>([]);
  const [organizationsMap, setOrganizationsMap] = useState<Record<string, string>>({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Check user permissions once on mount
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const authData = await auth.getCurrentUser();
        if (!authData.isAuthenticated) {
          navigate('/login');
          return;
        }

        if (!isEvaluator(authData.userOrganizations)) {
          setError('You do not have permission to access the evaluator dashboard');
          setIsInitialLoad(false);
          return;
        }

        // Get user's organization IDs for filtering
        if (authData.userOrganizations && authData.userOrganizations.length > 0) {
          const orgIds = authData.userOrganizations.map(org => org.organization);
          setUserOrgIds(orgIds);

          // Get current user's OrganizationUser IDs (evaluator IDs)
          const evaluatorIds = authData.userOrganizations
            .filter(org => org.role === 'EVALUATOR')
            .map(org => org.id);
          setCurrentEvaluatorIds(evaluatorIds);

          // Check if user is only an evaluator (no other roles)
          const roles = authData.userOrganizations.map(org => org.role);
          const isOnlyEvaluator = roles.includes('EVALUATOR') &&
                                !roles.includes('ADMIN') &&
                                !roles.includes('PLANNER');
          setIsEvaluatorOnly(isOnlyEvaluator);

          // Pre-fetch organization names after setting up auth
          try {
            const orgsResponse = await organizations.getAll();
            const orgMap: Record<string, string> = {};
            if (orgsResponse?.data && Array.isArray(orgsResponse.data)) {
              orgsResponse.data.forEach((org: any) => {
                if (org?.id) {
                  orgMap[String(org.id)] = org.name;
                }
              });
              setOrganizationsMap(orgMap);
            }
          } catch (orgError) {
            console.warn('Failed to pre-fetch organizations:', orgError);
          }
        }

        setIsAuthChecked(true);
      } catch (error) {
        console.error('Failed to check permissions:', error);
        setError('Failed to verify your permissions');
      } finally {
        setIsInitialLoad(false);
      }
    };

    checkPermissions();
  }, [navigate]);

  // Optimized pending plans query - fetch SUBMITTED status plans immediately
  const { data: pendingPlans, isLoading: loadingPending, refetch } = useQuery({
    queryKey: ['evaluator-pending-plans', userOrgIds, currentEvaluatorIds],
    queryFn: async () => {
      if (userOrgIds.length === 0 || currentEvaluatorIds.length === 0) return { data: [] };

      try {
        const response = await api.get('/plans/', {
          params: {
            status: 'SUBMITTED',
            organization: userOrgIds.join(','),
            limit: 50
          }
        });

        const plans = response.data?.results || response.data || [];

        // Client-side filter: must be SUBMITTED status and NOT reviewed by current evaluator
        const filteredPlans = plans.filter((plan: any) => {
          if (plan.status !== 'SUBMITTED') return false;

          // Must NOT have been reviewed by current evaluator
          if (plan.reviews && Array.isArray(plan.reviews)) {
            return !plan.reviews.some((review: any) =>
              currentEvaluatorIds.includes(review.evaluator)
            );
          }

          return true;
        });

        // Add organization names from pre-fetched map
        const plansWithNames = filteredPlans.map((plan: any) => ({
          ...plan,
          organizationName: organizationsMap[String(plan.organization)] ||
                           `Organization ${plan.organization}`
        }));

        return { data: plansWithNames };
      } catch (error) {
        console.error('Error fetching pending reviews:', error);
        return { data: [] };
      }
    },
    enabled: isAuthChecked && userOrgIds.length > 0 && currentEvaluatorIds.length > 0,
    staleTime: 30000,
    gcTime: 60000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2
  });

  // Fetch reviewed plans with proper deduplication - only when tab is active
  const { data: reviewedPlans, isLoading: loadingReviewed } = useQuery({
    queryKey: ['evaluator-reviewed-plans', userOrgIds, currentEvaluatorIds],
    queryFn: async () => {
      if (userOrgIds.length === 0 || currentEvaluatorIds.length === 0) return { data: [] };

      try {
        // Fetch plans with APPROVED or REJECTED status
        const [approvedRes, rejectedRes] = await Promise.all([
          api.get('/plans/', {
            params: {
              status: 'APPROVED',
              organization: userOrgIds.join(','),
              limit: 50
            }
          }),
          api.get('/plans/', {
            params: {
              status: 'REJECTED',
              organization: userOrgIds.join(','),
              limit: 50
            }
          })
        ]);

        const allPlans = [
          ...(approvedRes.data?.results || approvedRes.data || []),
          ...(rejectedRes.data?.results || rejectedRes.data || [])
        ];

        // Filter and deduplicate plans
        const uniquePlansMap = new Map();

        allPlans.forEach((plan: any) => {
          if (plan.reviews && Array.isArray(plan.reviews)) {
            const currentEvaluatorReview = plan.reviews.find((review: any) =>
              currentEvaluatorIds.includes(review.evaluator)
            );

            if (currentEvaluatorReview && !uniquePlansMap.has(plan.id)) {
              uniquePlansMap.set(plan.id, {
                ...plan,
                organizationName: organizationsMap[String(plan.organization)] ||
                                 `Organization ${plan.organization}`,
                currentEvaluatorReview
              });
            }
          }
        });

        return { data: Array.from(uniquePlansMap.values()) };
      } catch (error) {
        console.error('Error fetching reviewed plans:', error);
        return { data: [] };
      }
    },
    enabled: isAuthChecked && activeTab === 'reviewed' && userOrgIds.length > 0 && currentEvaluatorIds.length > 0,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2
  });

  // Memoized statistics to avoid recalculation
  const statistics = useMemo(() => {
    // Count unique plans only (already filtered by queries)
    const uniquePendingPlans = new Set();
    const uniqueReviewedPlans = new Set();
    const uniqueApprovedPlans = new Set();
    const uniqueRejectedPlans = new Set();
    
    // Count pending plans (already filtered by query)
    pendingPlans?.data?.forEach((p: any) => {
      if (p.status === 'SUBMITTED') {
        uniquePendingPlans.add(p.id);
      }
    });
    
    // Count reviewed plans (already filtered by query)
    reviewedPlans?.data?.forEach((p: any) => {
      if (p.status === 'APPROVED' || p.status === 'REJECTED') {
        uniqueReviewedPlans.add(p.id);
        
        if (p.status === 'APPROVED') {
          uniqueApprovedPlans.add(p.id);
        } else if (p.status === 'REJECTED') {
          uniqueRejectedPlans.add(p.id);
        }
      }
    });

    return {
      pendingCount: uniquePendingPlans.size,
      reviewedCount: uniqueReviewedPlans.size,
      approvedCount: uniqueApprovedPlans.size,
      rejectedCount: uniqueRejectedPlans.size
    };
  }, [pendingPlans?.data, reviewedPlans?.data]);

  // Review mutation with optimized error handling
  const reviewMutation = useMutation({
    mutationFn: async (reviewData: { planId: string, status: 'APPROVED' | 'REJECTED', feedback: string }) => {
      try {
        const reviewPayload = {
          status: reviewData.status,
          feedback: reviewData.feedback || ''
        };
        
        const timestamp = new Date().getTime();
        
        if (reviewData.status === 'APPROVED') {
          const response = await api.post(`/plans/${reviewData.planId}/approve/?_=${timestamp}`, reviewPayload);
          return response;
        } else {
          const response = await api.post(`/plans/${reviewData.planId}/reject/?_=${timestamp}`, reviewPayload);
          return response;
        }
      } catch (error) {
        console.error('Review submission failed:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluator-pending-plans'] });
      queryClient.invalidateQueries({ queryKey: ['evaluator-reviewed-plans'] });
      setShowReviewModal(false);
      setSelectedPlan(null);
      setSuccess('Plan review submitted successfully');
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (error: any) => {
      console.error('Review mutation error:', error);
      setError(error.message || 'Failed to submit review');
      setTimeout(() => setError(null), 5000);
    },
  });

  const handleViewPlan = (plan: any) => {
    if (!plan || !plan.id) {
      setError('Invalid plan data for viewing');
      return;
    }
    console.log('Navigating to plan view:', plan.id);
    setError(null);
    navigate(`/plans/${plan.id}`);
  };

  const handleReviewPlan = (plan: any) => {
    if (!plan || !plan.id) {
      setError('Invalid plan data for review');
      return;
    }
    console.log('Opening review modal for plan:', plan.id);
    setSelectedPlan(plan);
    setShowReviewModal(true);
  };

  const handleReviewSubmit = async (data: { status: 'APPROVED' | 'REJECTED'; feedback: string }) => {
    if (!selectedPlan) return;
    
    console.log('Submitting review for plan:', selectedPlan.id, 'Status:', data.status);
    try {
      await reviewMutation.mutateAsync({
        planId: selectedPlan.id,
        status: data.status,
        feedback: data.feedback
      });
    } catch (error) {
      console.error('Failed to submit review:', error);
      
      let errorMessage = 'Failed to submit review';
      if (error.response?.status === 403) {
        errorMessage = 'Permission denied. You may not have evaluator permissions.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Plan not found or no longer available for review.';
      } else if (error.response?.status === 400) {
        errorMessage = 'Invalid review data. Please check your input.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
    }
  };

  // Memoized date formatting for better performance
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not available';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (e) {
      return 'Invalid date';
    }
  };

  // Memoized organization name getter
  const getOrganizationName = (plan: any) => {
    // Try multiple sources for organization name
    if (plan.organizationName && plan.organizationName !== 'Unknown Organization') {
      return plan.organizationName;
    }
    
    if (plan.organization_name) {
      return plan.organization_name;
    }
    
    // Fallback to organizationsMap
    const orgId = String(plan.organization);
    if (organizationsMap[orgId]) {
      return organizationsMap[orgId];
    }
    
    return `Organization ${plan.organization}`;
  };

  // Show loading state while checking authentication
  if (!isAuthChecked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin mx-auto text-green-600 mb-2" />
          <span className="text-lg">Loading evaluator dashboard...</span>
        </div>
      </div>
    );
  }

  // Show error state if no permission
  if (error && error.includes('permission')) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Access Denied</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Evaluator Dashboard</h1>
        <p className="text-gray-600">Review and evaluate plans from your assigned organizations</p>
      </div>

      {error && !error.includes('permission') && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700">
          <CheckCircle className="h-5 w-5 mr-2" />
          {success}
        </div>
      )}

      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-500">Pending Reviews</h3>
            <Bell className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-3xl font-semibold text-amber-600">
            {loadingPending ? (
              <Loader className="h-6 w-6 animate-spin" />
            ) : (
              statistics.pendingCount
            )}
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-500">Total Reviewed</h3>
            <LayoutGrid className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-3xl font-semibold text-blue-600">
            {activeTab === 'reviewed' && loadingReviewed ? (
              <Loader className="h-6 w-6 animate-spin" />
            ) : (
              statistics.reviewedCount
            )}
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-500">Approved Plans</h3>
            <CheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-3xl font-semibold text-green-600">
            {activeTab === 'reviewed' && loadingReviewed ? (
              <Loader className="h-6 w-6 animate-spin" />
            ) : (
              statistics.approvedCount
            )}
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-gray-500">Rejected Plans</h3>
            <XCircle className="h-5 w-5 text-red-500" />
          </div>
          <p className="text-3xl font-semibold text-red-600">
            {activeTab === 'reviewed' && loadingReviewed ? (
              <Loader className="h-6 w-6 animate-spin" />
            ) : (
              statistics.rejectedCount
            )}
          </p>
        </div>
      </div>

      {/* Optimized Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('pending')}
              className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'pending'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Pending Reviews
                {statistics.pendingCount > 0 && (
                  <span className="ml-2 bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs">
                    {statistics.pendingCount}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('reviewed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'reviewed'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 mr-2" />
                Reviewed Plans
                {statistics.reviewedCount > 0 && (
                  <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                    {statistics.reviewedCount}
                  </span>
                )}
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Pending Reviews Tab */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="sm:flex sm:items-center">
              <div className="sm:flex-auto">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Pending Reviews</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Plans submitted and waiting for your review.
                </p>
              </div>
              <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
                <button
                  onClick={() => refetch()}
                  disabled={loadingPending}
                  className="flex items-center px-4 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-md disabled:opacity-50"
                >
                  {loadingPending ? <Loader className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Refresh
                </button>
              </div>
            </div>

            {loadingPending ? (
              <div className="text-center py-12">
                <Loader className="h-8 w-8 animate-spin mx-auto text-green-600 mb-4" />
                <p className="text-gray-600">Loading pending plans...</p>
              </div>
            ) : !pendingPlans?.data || pendingPlans.data.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 mt-6">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No pending plans</h3>
                <p className="text-gray-500 max-w-lg mx-auto">
                  There are no plans waiting for your review. Check back later or refresh to see if any new plans have been submitted.
                </p>
              </div>
            ) : (
              <div className="mt-6 overflow-hidden overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Organization
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Planner
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Submitted Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Planning Period
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingPlans.data.map((plan: any) => (
                      <tr key={plan.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-900">{getOrganizationName(plan)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {plan.planner_name || 'Unknown Planner'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-500">
                              {plan.submitted_at ? formatDate(plan.submitted_at) : 'Not yet submitted'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {plan.from_date && plan.to_date ? 
                            `${formatDate(plan.from_date)} - ${formatDate(plan.to_date)}` :
                            'Date not available'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            {plan.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleViewPlan(plan)}
                              className="text-blue-600 hover:text-blue-900 flex items-center"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </button>
                            <button
                              onClick={() => handleReviewPlan(plan)}
                              className="text-green-600 hover:text-green-900 flex items-center ml-2"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Review
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reviewed Plans Tab */}
      {activeTab === 'reviewed' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 sm:p-6 lg:p-8">
            <div className="sm:flex sm:items-center">
              <div className="sm:flex-auto">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Reviewed Plans</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Plans you have already reviewed.
                </p>
              </div>
            </div>

            {loadingReviewed ? (
              <div className="text-center py-12">
                <Loader className="h-8 w-8 animate-spin mx-auto text-green-600 mb-4" />
                <p className="text-gray-600">Loading reviewed plans...</p>
              </div>
            ) : !reviewedPlans?.data || reviewedPlans.data.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 mt-6">
                <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No reviewed plans</h3>
                <p className="text-gray-500 max-w-lg mx-auto">
                  You haven't reviewed any plans yet, or there are no approved/rejected plans from your organizations.
                </p>
              </div>
            ) : (
              <div className="mt-6 overflow-hidden overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Organization
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Planner
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Planning Period
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reviewed Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Feedback
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reviewedPlans.data.map((plan: any) => (
                      <tr key={plan.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="text-sm font-medium text-gray-900">{getOrganizationName(plan)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {plan.planner_name || 'Unknown Planner'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {plan.from_date && plan.to_date ? 
                            `${formatDate(plan.from_date)} - ${formatDate(plan.to_date)}` :
                            'Date not available'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            plan.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {plan.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {plan.reviews && plan.reviews.length > 0 ? 
                            formatDate(plan.currentEvaluatorReview?.reviewed_at || plan.reviews[0]?.reviewed_at) : 
                            formatDate(plan.updated_at)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                          <div className="truncate" title={plan.currentEvaluatorReview?.feedback || 'No feedback'}>
                            {plan.reviews && plan.reviews.length > 0 ? 
                              (plan.currentEvaluatorReview?.feedback || 'No feedback from current evaluator') : 
                              'No reviews'}
                          </div>
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
      )}

      {/* Review Modal */}
      {showReviewModal && selectedPlan && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Review Plan: {getOrganizationName(selectedPlan)}
            </h3>
            
            <PlanReviewForm
              plan={selectedPlan}
              onSubmit={handleReviewSubmit}
              onCancel={() => {
                setShowReviewModal(false);
                setSelectedPlan(null);
              }}
              isSubmitting={reviewMutation.isPending}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EvaluatorDashboard;
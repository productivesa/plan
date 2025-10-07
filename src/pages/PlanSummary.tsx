import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileSpreadsheet, Download, Building2, User, Calendar, FileType, Target, Activity, DollarSign, AlertCircle, Info, Loader, CheckCircle } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { plans, auth, api } from '../lib/api';
import { format } from 'date-fns';
import PlanReviewTable from '../components/PlanReviewTable';
import { exportToExcel, exportToPDF } from '../lib/utils/export';
import { isEvaluator, isAdmin } from '../types/user';

const PlanSummary: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [userOrgId, setUserOrgId] = useState<number | null>(null);
  const [isUserEvaluator, setIsUserEvaluator] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user data and permissions
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const authData = await auth.getCurrentUser();
        if (!authData.isAuthenticated) {
          navigate('/login');
          return;
        }

        if (authData.userOrganizations && authData.userOrganizations.length > 0) {
          setUserOrgId(authData.userOrganizations[0].organization);
        }

        setIsUserEvaluator(isEvaluator(authData.userOrganizations));
        setIsUserAdmin(isAdmin(authData.userOrganizations));
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        setError('Failed to load user permissions');
      }
    };

    fetchUserData();
  }, [navigate]);

  // Fetch plan details
  const { data: planData, isLoading, error: planError } = useQuery({
    queryKey: ['plan', planId],
    queryFn: async () => {
      if (!planId) throw new Error('Plan ID is required');
      
      try {
        console.log('PlanSummary: Fetching plan details for ID:', planId);
        
        // Use direct API call instead of plans.getById to avoid potential issues
        const response = await api.get(`/plans/${planId}/`);
        console.log('PlanSummary: Plan data received:', response.data);
        
        if (!response.data) {
          throw new Error('Plan data not found');
        }
        
        const planData = response.data;
      
        // Apply planner's selected objective weights if they exist
        if (planData.objectives && planData.selected_objectives_weights) {
          console.log('PlanSummary: Applying selected objective weights:', planData.selected_objectives_weights);
          
          planData.objectives = planData.objectives.map((obj: any) => {
            const weightKey = obj.id?.toString();
            const selectedWeight = planData.selected_objectives_weights[weightKey];
            
            if (selectedWeight !== undefined && selectedWeight !== null) {
              console.log(`PlanSummary: Objective "${obj.title}" weight: ${obj.weight}% → ${selectedWeight}% (planner selected)`);
              return {
                ...obj,
                effective_weight: parseFloat(selectedWeight),
                planner_weight: parseFloat(selectedWeight),
                original_weight: obj.weight
              };
            }
            
            // Use existing effective_weight or weight as fallback
            const effectiveWeight = obj.effective_weight !== undefined ? obj.effective_weight : obj.weight;
            return {
              ...obj,
              effective_weight: effectiveWeight
            };
          });
        }
        
        // Ensure organization_name is set
        if (!planData.organization_name && planData.organization) {
          try {
            const orgResponse = await api.get(`/organizations/${planData.organization}/`);
            if (orgResponse.data && orgResponse.data.name) {
              planData.organization_name = orgResponse.data.name;
            }
          } catch (orgError) {
            console.warn('Failed to fetch organization name:', orgError);
          }
        }
        
        return { data: planData };
      } catch (error) {
        console.error('PlanSummary: Error fetching plan:', error);
        if (error.response?.status === 404) {
          throw new Error(`Plan with ID ${planId} not found`);
        }
        throw new Error(`Failed to load plan: ${error.message || 'Unknown error'}`);
      }
    },
    enabled: !!planId,
    retry: 1,
    refetchOnMount: true
  });

  const plan = planData?.data;

  // Calculate comprehensive budget summary
  const calculateBudgetSummary = () => {
    if (!plan?.objectives || !Array.isArray(plan.objectives)) {
      console.log('PlanSummary: No objectives data for budget calculation');
      return {
        totalRequired: 0,
        totalAllocated: 0,
        fundingGap: 0,
        governmentTreasury: 0,
        sdgFunding: 0,
        partnersFunding: 0,
        otherFunding: 0,
        activitiesCount: 0,
        measuresCount: 0
      };
    }

    let totalRequired = 0;
    let governmentTreasury = 0;
    let sdgFunding = 0;
    let partnersFunding = 0;
    let otherFunding = 0;
    let activitiesCount = 0;
    let measuresCount = 0;

    console.log('PlanSummary: Calculating budget from', plan.objectives.length, 'objectives');

    plan.objectives.forEach((objective: any) => {
      if (!objective) {
        console.log(`PlanSummary: Skipping null objective at index ${objIndex}`);
        return;
      }
      
      console.log(`PlanSummary: Processing objective "${objective.title}" with ${objective.initiatives?.length || 0} initiatives`);
      
      if (!objective.initiatives) return;

      objective.initiatives.forEach((initiative: any) => {
        if (!initiative) {
          console.log('PlanSummary: Skipping null initiative');
          return;
        }
        
        console.log(`PlanSummary: Processing initiative "${initiative.name}"`);

        // Count performance measures
        if (initiative.performance_measures) {
          console.log(`PlanSummary: Found ${initiative.performance_measures.length} performance measures`);
          measuresCount += initiative.performance_measures.length;
        }

        // Process main activities and their budgets
        if (initiative.main_activities) {
          console.log(`PlanSummary: Found ${initiative.main_activities.length} main activities`);
          
          initiative.main_activities.forEach((activity: any) => {
            if (!activity) {
              console.log('PlanSummary: Skipping null activity');
              return;
            }
            
            console.log(`PlanSummary: Processing activity "${activity.name}" with ${activity.sub_activities?.length || 0} sub-activities`);
            activitiesCount++;

            // Calculate budget from sub-activities (NEW MODEL)
            if (activity.sub_activities && Array.isArray(activity.sub_activities)) {
              console.log(`PlanSummary: Processing ${activity.sub_activities.length} sub-activities for activity "${activity.name}"`);
              
              activity.sub_activities.forEach((subActivity: any) => {
                if (!subActivity) {
                  console.log('PlanSummary: Skipping null sub-activity');
                  return;
                }
                
                try {
                  const cost = subActivity.budget_calculation_type === 'WITH_TOOL'
                    ? Number(subActivity.estimated_cost_with_tool || 0)
                    : Number(subActivity.estimated_cost_without_tool || 0);

                  totalRequired += cost;
                  governmentTreasury += Number(subActivity.government_treasury || 0);
                  sdgFunding += Number(subActivity.sdg_funding || 0);
                  partnersFunding += Number(subActivity.partners_funding || 0);
                  otherFunding += Number(subActivity.other_funding || 0);
                  
                  console.log(`PlanSummary: Sub-activity "${subActivity.name}": Required=${cost}, Gov=${subActivity.government_treasury}, Partners=${subActivity.partners_funding}, SDG=${subActivity.sdg_funding}, Other=${subActivity.other_funding}`);
                } catch (error) {
                  console.error('Error processing sub-activity budget:', error);
                }
              });
            }
            // Fallback to legacy budget (OLD MODEL)
            else if (activity.budget) {
              console.log(`PlanSummary: Processing legacy budget for activity "${activity.name}"`);
              
              try {
                const cost = activity.budget.budget_calculation_type === 'WITH_TOOL'
                  ? Number(activity.budget.estimated_cost_with_tool || 0)
                  : Number(activity.budget.estimated_cost_without_tool || 0);

                totalRequired += cost;
                governmentTreasury += Number(activity.budget.government_treasury || 0);
                sdgFunding += Number(activity.budget.sdg_funding || 0);
                partnersFunding += Number(activity.budget.partners_funding || 0);
                otherFunding += Number(activity.budget.other_funding || 0);
                
                console.log(`PlanSummary: Legacy budget for "${activity.name}": Required=${cost}, Gov=${activity.budget.government_treasury}`);
              } catch (error) {
                console.error('Error processing legacy budget:', error);
              }
            } else {
              console.log(`PlanSummary: Activity "${activity.name}" has no budget data`);
            }
          });
        }
      });
    });

    const totalAllocated = governmentTreasury + sdgFunding + partnersFunding + otherFunding;
    const fundingGap = Math.max(0, totalRequired - totalAllocated);

    const summary = {
      totalRequired,
      totalAllocated,
      fundingGap,
      governmentTreasury,
      sdgFunding,
      partnersFunding,
      otherFunding,
      activitiesCount,
      measuresCount
    };

    console.log('PlanSummary: Final budget summary:', summary);
    return summary;
  };

  const budgetSummary = calculateBudgetSummary();

  const handleExportExcel = () => {
    if (!plan?.objectives) return;
    
    try {
      exportToExcel(
        plan.objectives,
        `plan-${planId}-${new Date().toISOString().slice(0, 10)}`,
        'en',
        {
          organization: plan.organization_name,
          planner: plan.planner_name,
          fromDate: plan.from_date,
          toDate: plan.to_date,
          planType: plan.type
        }
      );
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    }
  };

  const handleExportPDF = () => {
    if (!plan?.objectives) return;
    
    try {
      exportToPDF(
        plan.objectives,
        `plan-${planId}-${new Date().toISOString().slice(0, 10)}`,
        'en',
        {
          organization: plan.organization_name,
          planner: plan.planner_name,
          fromDate: plan.from_date,
          toDate: plan.to_date,
          planType: plan.type
        }
      );
    } catch (error) {
      console.error('Error exporting to PDF:', error);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (e) {
      return 'Invalid date';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="h-6 w-6 animate-spin mr-2" />
        <span>Loading plan details...</span>
      </div>
    );
  }

  if (planError || !plan) {
    console.error('PlanSummary: Plan error or no plan data:', { planError, plan, planId });
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Plan</h3>
          <p className="text-red-600 mb-2">{(planError as Error)?.message || 'Plan not found'}</p>
          <p className="text-sm text-gray-600">Plan ID: {planId}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error</h3>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plan Summary</h1>
            <p className="text-gray-600 mt-1">
              View complete plan details and budget breakdown
            </p>
          </div>
          
          <div className="flex space-x-3">
           
          </div>
        </div>
      </div>

      {/* Plan Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Building2 className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Organization</p>
              <p className="font-medium text-gray-900" title={plan.organization_name || plan.organization?.name}>
                {plan.organization_name || plan.organization?.name || 'Organization Name Not Available'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <User className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Planner</p>
              <p className="font-medium text-gray-900" title={plan.planner_name || 'Unknown'}>
                {plan.planner_name || 'Planner Name Not Available'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <FileType className="h-8 w-8 text-purple-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Plan Type</p>
              <p className="font-medium text-gray-900" title={plan.type || 'Unknown'}>
                {plan.type || 'Plan Type Not Available'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-orange-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Period</p>
              <p className="font-medium text-gray-900">
                {plan.from_date && plan.to_date 
                  ? `${formatDate(plan.from_date)} - ${formatDate(plan.to_date)}`
                  : 'Period Not Available'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Budget Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 rounded-lg shadow-sm text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Total Budget Required</p>
              <p className="text-2xl font-bold">
                ETB {budgetSummary.totalRequired.toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 rounded-lg shadow-sm text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Allocated</p>
              <p className="text-2xl font-bold">
                ETB {budgetSummary.totalAllocated.toLocaleString()}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-200" />
          </div>
        </div>

        <div className={`bg-gradient-to-r ${budgetSummary.fundingGap > 0 ? 'from-red-500 to-red-600' : 'from-green-500 to-green-600'} p-4 rounded-lg shadow-sm text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`${budgetSummary.fundingGap > 0 ? 'text-red-100' : 'text-green-100'} text-sm`}>
                {budgetSummary.fundingGap > 0 ? 'Funding Gap' : 'Fully Funded'}
              </p>
              <p className="text-2xl font-bold">
                ETB {budgetSummary.fundingGap.toLocaleString()}
              </p>
            </div>
            {budgetSummary.fundingGap > 0 ? (
              <AlertCircle className="h-8 w-8 text-red-200" />
            ) : (
              <CheckCircle className="h-8 w-8 text-green-200" />
            )}
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 rounded-lg shadow-sm text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Plan Status</p>
              <p className="text-2xl font-bold">{plan.status}</p>
            </div>
            <Activity className="h-8 w-8 text-purple-200" />
          </div>
        </div>
      </div>

      {/* Funding Sources Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Government Treasury</p>
              <p className="text-xl font-semibold text-green-600">
                ETB {budgetSummary.governmentTreasury.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xs text-gray-500">
              {budgetSummary.totalRequired > 0 
                ? `${((budgetSummary.governmentTreasury / budgetSummary.totalRequired) * 100).toFixed(1)}% of total`
                : '0% of total'
              }
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">SDG Funding</p>
              <p className="text-xl font-semibold text-blue-600">
                ETB {budgetSummary.sdgFunding.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Target className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xs text-gray-500">
              {budgetSummary.totalRequired > 0 
                ? `${((budgetSummary.sdgFunding / budgetSummary.totalRequired) * 100).toFixed(1)}% of total`
                : '0% of total'
              }
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Partners Funding</p>
              <p className="text-xl font-semibold text-purple-600">
                ETB {budgetSummary.partnersFunding.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Building2 className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xs text-gray-500">
              {budgetSummary.totalRequired > 0 
                ? `${((budgetSummary.partnersFunding / budgetSummary.totalRequired) * 100).toFixed(1)}% of total`
                : '0% of total'
              }
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Other Funding</p>
              <p className="text-xl font-semibold text-orange-600">
                ETB {budgetSummary.otherFunding.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Activity className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xs text-gray-500">
              {budgetSummary.totalRequired > 0 
                ? `${((budgetSummary.otherFunding / budgetSummary.totalRequired) * 100).toFixed(1)}% of total`
                : '0% of total'
              }
            </div>
          </div>
        </div>
      </div>

      {/* Plan Statistics */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Plan Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{plan.objectives?.length || 0}</div>
            <div className="text-sm text-gray-500">Strategic Objectives</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {plan.objectives?.reduce((total: number, obj: any) => {
                if (!obj.initiatives) return total;
                
                // Filter initiatives by planner organization (same logic as budget calculation)
                const plannerInitiatives = obj.initiatives.filter((initiative: any) => {
                  if (!initiative) return false;
                  
                  // Include initiatives that belong to the planner's organization
                  const belongsToPlannerOrg = userOrgId && initiative.organization &&
                                            Number(initiative.organization) === Number(userOrgId);
                  
                  // Also include default initiatives (they belong to Ministry of Health)
                  const isDefaultInitiative = initiative.is_default === true;
                  
                  return belongsToPlannerOrg || isDefaultInitiative;
                });
                
                return total + plannerInitiatives.length;
              }, 0) || 0}
            </div>
            <div className="text-sm text-gray-500">Strategic Initiatives</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{budgetSummary.measuresCount}</div>
            <div className="text-sm text-gray-500">Performance Measures</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{budgetSummary.activitiesCount}</div>
            <div className="text-sm text-gray-500">Main Activities</div>
          </div>
        </div>
      </div>

      {/* Budget Analysis */}
      {budgetSummary.totalRequired > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Budget Analysis</h3>
          
          <div className="space-y-4">
            {/* Funding Coverage */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Funding Coverage</span>
                <span className="text-sm text-gray-500">
                  {((budgetSummary.totalAllocated / budgetSummary.totalRequired) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    budgetSummary.fundingGap === 0 ? 'bg-green-600' : 'bg-blue-600'
                  }`}
                  style={{ 
                    width: `${Math.min(100, (budgetSummary.totalAllocated / budgetSummary.totalRequired) * 100)}%` 
                  }}
                ></div>
              </div>
            </div>

            {/* Funding Sources Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {budgetSummary.governmentTreasury > 0 && (
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-600">
                    {((budgetSummary.governmentTreasury / budgetSummary.totalRequired) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600">Government</div>
                </div>
              )}
              
              {budgetSummary.sdgFunding > 0 && (
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">
                    {((budgetSummary.sdgFunding / budgetSummary.totalRequired) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600">SDG</div>
                </div>
              )}
              
              {budgetSummary.partnersFunding > 0 && (
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-lg font-bold text-purple-600">
                    {((budgetSummary.partnersFunding / budgetSummary.totalRequired) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600">Partners</div>
                </div>
              )}
              
              {budgetSummary.otherFunding > 0 && (
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-lg font-bold text-orange-600">
                    {((budgetSummary.otherFunding / budgetSummary.totalRequired) * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600">Other</div>
                </div>
              )}
            </div>

            {budgetSummary.fundingGap > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                  <p className="text-sm text-red-700">
                    <strong>Funding Gap:</strong> ETB {budgetSummary.fundingGap.toLocaleString()} additional funding needed
                  </p>
                </div>
              </div>
            )}

            {budgetSummary.fundingGap === 0 && budgetSummary.totalRequired > 0 && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <p className="text-sm text-green-700">
                    <strong>Fully Funded:</strong> This plan is completely funded with no gaps
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plan Review Table */}
      {plan.objectives && plan.objectives.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Detailed Plan Breakdown</h3>
            <p className="text-sm text-gray-600 mt-1">
              Complete breakdown of objectives, initiatives, measures, and activities with budget details
            </p>
            <div className="text-xs text-gray-500 mt-2">
              <p>Plan Organization: {plan.organization_name} (ID: {plan.organization})</p>
              <p>Objectives: {plan.objectives.length} | 
                 Total Initiatives: {plan.objectives.reduce((sum: number, obj: any) => sum + (obj.initiatives?.length || 0), 0)} |
                 Selected Objectives: {plan.selected_objectives?.length || 0}
              </p>
            </div>
          </div>
          
          <div className="p-6">
            <PlanReviewTable
              objectives={plan.objectives}
              onSubmit={async () => {}} // No submission needed in view mode
              isSubmitting={false}
              organizationName={plan.organization_name || plan.organization?.name || 'Organization Name Not Available'}
              plannerName={plan.planner_name || 'Planner Name Not Available'}
              fromDate={plan.from_date || ''}
              toDate={plan.to_date || ''}
              planType={plan.type || 'LEO/EO Plan'}
              isViewOnly={true}
              plannerOrgId={plan.organization ? Number(plan.organization) : null}
            />
          </div>
        </div>
      ) : (
        <div className="text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Objectives Data</h3>
          <p className="text-gray-500">
            This plan doesn't have complete objective data available for display.
          </p>
          <div className="mt-4 text-sm text-gray-400">
            <p>Plan ID: {planId}</p>
            <p>Organization: {plan?.organization_name || plan?.organization?.name || 'Not Available'}</p>
            <p>Status: {plan?.status || 'Unknown'}</p>
            <p>Objectives Available: {plan?.objectives ? 'Yes' : 'No'}</p>
            <p>Objectives Count: {plan?.objectives?.length || 0}</p>
          </div>
        </div>
      )}

      {/* Plan Reviews Section */}
      {plan.reviews && plan.reviews.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-6">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Plan Reviews</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {plan.reviews.map((review: any) => (
                <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        review.status === 'APPROVED' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {review.status}
                      </span>
                      <span className="ml-3 text-sm text-gray-600">
                        by {review.evaluator_name}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatDate(review.reviewed_at)}
                    </span>
                  </div>
                  <p className="text-gray-700">{review.feedback}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanSummary;
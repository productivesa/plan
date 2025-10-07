import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Users, CheckCircle, XCircle, AlertCircle, Loader, RefreshCw,
  Building2, DollarSign, TrendingUp, BarChart3, PieChart, Calendar,
  Eye, ClipboardCheck, Search, ChevronLeft, ChevronRight, Filter,
  Activity, Briefcase, GraduationCap, MessageSquare, Wrench, FileText, Package
} from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { organizations, auth, api } from '../lib/api';
import { format } from 'date-fns';
import { isAdmin } from '../types/user';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  PointElement,
  LineElement,
  Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  PointElement,
  LineElement,
  Filler
);

const AdminDashboard: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'reviewed' | 'budget-activity' | 'analytics' | 'executive-performance'>('overview');
  const [reviewedFilter, setReviewedFilter] = useState('all');
  const [reviewedOrgFilter, setReviewedOrgFilter] = useState('all');
  const [reviewedSearch, setReviewedSearch] = useState('');
  const [reviewedSortBy, setReviewedSortBy] = useState<'date' | 'organization' | 'status'>('date');
  const [reviewedSortOrder, setReviewedSortOrder] = useState<'asc' | 'desc'>('desc');
  const [reviewedCurrentPage, setReviewedCurrentPage] = useState(1);
  const [pendingCurrentPage, setPendingCurrentPage] = useState(1);
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingOrgFilter, setPendingOrgFilter] = useState('all');
  const [pendingSortBy, setPendingSortBy] = useState<'date' | 'organization' | 'planner'>('date');
  const [pendingSortOrder, setPendingSortOrder] = useState<'asc' | 'desc'>('desc');
  const [budgetActivityCurrentPage, setBudgetActivityCurrentPage] = useState(1);
  const [executiveCurrentPage, setExecutiveCurrentPage] = useState(1);
  const reviewedItemsPerPage = 10;
  const pendingItemsPerPage = 10;
  const budgetActivityItemsPerPage = 10;
  const executiveItemsPerPage = 10;

  // Organization hierarchy state
  const [organizationsMap, setOrganizationsMap] = useState<Record<string, string>>({});
  const [adminOrgId, setAdminOrgId] = useState<number | null>(null);
  const [adminOrgType, setAdminOrgType] = useState<string | null>(null);
  const [allowedOrgIds, setAllowedOrgIds] = useState<number[]>([]);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);

  // Check if user has admin permissions
  useEffect(() => {
    const initializeAdminAccess = async () => {
      try {
        const authData = await auth.getCurrentUser();
        if (!authData.isAuthenticated) {
          navigate('/login');
          return;
        }

        if (!isAdmin(authData.userOrganizations)) {
          setError('You do not have permission to access the admin dashboard');
          return;
        }

        // Get admin's organization ID and type
        if (authData.userOrganizations && authData.userOrganizations.length > 0) {
          const adminOrg = authData.userOrganizations[0].organization;
          setAdminOrgId(adminOrg);
          console.log('Admin organization ID:', adminOrg);
        }
        
        setIsAuthInitialized(true);
      } catch (error) {
        console.error('Failed to check admin permissions:', error);
        setError('Failed to verify admin permissions');
      }
    };
    
    initializeAdminAccess();
  }, [navigate]);

  // Fetch organizations and determine hierarchy access
  useEffect(() => {
    const setupOrganizationHierarchy = async () => {
      if (!adminOrgId || !isAuthInitialized) return;
      
      try {
        const response = await organizations.getAll();
        const orgMap: Record<string, string> = {};
        const allOrgs = Array.isArray(response) ? response : response?.data || [];
        
        if (allOrgs.length === 0) {
          console.warn('No organizations found');
          return;
        }
        
        // Create organizations map
        allOrgs.forEach((org: any) => {
          if (org && org.id) {
            orgMap[org.id] = org.name;
          }
        });
        setOrganizationsMap(orgMap);
        
        // Find admin's organization details
        const adminOrg = allOrgs.find((org: any) => org.id === adminOrgId);
        if (!adminOrg) {
          console.error('Admin organization not found');
          return;
        }
        
        setAdminOrgType(adminOrg.type);
        console.log('Admin organization type:', adminOrg.type);
        
        // Determine allowed organizations based on hierarchy
        const allOrgIds = allOrgs.map((org: any) => org.id);
        
        // Function to check if org is descendant of parent
        const isDescendantOf = (org: any, parentId: number, organizations: any[]): boolean => {
          if (!org.parent) return false;
          if (org.parent === parentId) return true;
          
          const parentOrg = organizations.find(o => o.id === org.parent);
          return parentOrg ? isDescendantOf(parentOrg, parentId, organizations) : false;
        };
        
        if (adminOrg.type === 'MINISTER') {
          // Minister admin can see all organizations
          setAllowedOrgIds(allOrgIds);
          console.log('Minister admin - allowed to see all organizations:', allOrgIds.length);
        } else {
          // Other parent organization admin can only see child organizations + self
          const childOrgIds = allOrgs.filter((org: any) => 
            org.id === adminOrgId || // Self
            org.parent === adminOrgId || // Direct children
            isDescendantOf(org, adminOrgId, allOrgs) // Indirect descendants
          ).map((org: any) => org.id);
          
          setAllowedOrgIds(childOrgIds);
          console.log(`${adminOrg.type} admin - allowed to see hierarchy organizations:`, childOrgIds.length);
        }
        
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
        setError('Failed to load organization data');
      }
    };
    
    setupOrganizationHierarchy();
  }, [adminOrgId, isAuthInitialized]);

  // Direct sub-activities data fetch
  const { data: directSubActivitiesData, isLoading: isLoadingDirectSubActivities } = useQuery({
    queryKey: ['sub-activities', 'direct', allowedOrgIds, adminOrgType],
    queryFn: async () => {
      try {
        console.log('Fetching sub-activities directly for admin dashboard');
        
        // Fetch sub-activities and main activities in parallel for better performance
        const [subActivitiesResponse, mainActivitiesResponse] = await Promise.all([
          api.get('/sub-activities/'),
          api.get('/main-activities/')
        ]);
        
        const allSubActivities = subActivitiesResponse.data?.results || subActivitiesResponse.data || [];
        const allMainActivities = mainActivitiesResponse.data?.results || mainActivitiesResponse.data || [];
        
        console.log(`Fetched ${allSubActivities.length} sub-activities and ${allMainActivities.length} main activities`);
        
        // Create main activity to organization mapping for fast lookup
        const mainActivityOrgMap = new Map();
        allMainActivities.forEach((activity: any) => {
          mainActivityOrgMap.set(activity.id, activity.organization);
        });
        
        // Filter sub-activities based on admin organization hierarchy
        let filteredSubActivities = allSubActivities;
        
        // CRITICAL: Apply organization filtering for non-Minister admins
        if (adminOrgType !== 'MINISTER' && allowedOrgIds.length > 0) {
          // Non-Minister admin: only show sub-activities from allowed organizations
          filteredSubActivities = allSubActivities.filter((subActivity: any) => {
            const activityOrg = mainActivityOrgMap.get(subActivity.main_activity);
            
            // ONLY include if belongs to allowed organizations (no legacy fallback)
            return activityOrg && allowedOrgIds.includes(Number(activityOrg));
          });
          
          console.log(`Non-Minister admin: filtered to ${filteredSubActivities.length} sub-activities from hierarchy`);
        } else {
          console.log(`Minister admin: showing all ${filteredSubActivities.length} sub-activities`);
        }
        
        // Enrich sub-activities with organization names
        const enrichedSubActivities = filteredSubActivities.map((subActivity: any) => {
          const activityOrg = mainActivityOrgMap.get(subActivity.main_activity);
          const organizationName = activityOrg ? organizationsMap[activityOrg] || 'Unknown Organization' : 'No Organization';
          
          return {
            ...subActivity,
            organization: activityOrg,
            organizationName
          };
        });
        
        console.log(`Enriched ${enrichedSubActivities.length} sub-activities with organization data`);
        
        return { data: enrichedSubActivities };
      } catch (error) {
        console.error('Error fetching direct sub-activities:', error);
        return { data: [] };
      }
    },
    enabled: isAuthInitialized && (allowedOrgIds.length > 0 || adminOrgType === 'MINISTER'),
    staleTime: 2 * 60 * 1000,
    retry: 2
  });

  // Helper function to calculate plan budget from sub-activities (MOVED UP TO AVOID REFERENCE ERROR)
  const calculatePlanBudgetFromSubActivities = (planId: string) => {
    const subActivities = directSubActivitiesData?.data || [];
    
    // For now, we'll estimate based on organization (more complex plan-to-subactivity mapping would require additional API calls)
    const planSubActivities = subActivities; // All sub-activities for simplicity
    
    return planSubActivities.reduce((sum, subActivity) => {
      const cost = subActivity.budget_calculation_type === 'WITH_TOOL'
        ? Number(subActivity.estimated_cost_with_tool || 0)
        : Number(subActivity.estimated_cost_without_tool || 0);
      return sum + cost;
    }, 0);
  };

  // Fetch all plans for admin overview
  const { data: allPlans, isLoading, refetch } = useQuery({
    queryKey: ['plans', 'admin-all', allowedOrgIds],
    queryFn: async () => {
      try {
        const params: any = {};
        
        // CRITICAL: Apply organization filtering for non-Minister admins
        if (allowedOrgIds.length > 0 && adminOrgType !== 'MINISTER') {
          // Non-Minister admin: filter by allowed organizations only
          params.organization__in = allowedOrgIds.join(',');
          console.log('Filtering plans by allowed organizations:', allowedOrgIds);
        } else {
          console.log('Minister admin: fetching all plans');
        }
        
        const response = await api.get('/plans/', { params });
        let plansData = response.data?.results || response.data || [];

        // ADDITIONAL CLIENT-SIDE FILTERING for non-Minister admins
        if (adminOrgType !== 'MINISTER' && allowedOrgIds.length > 0) {
          plansData = plansData.filter((plan: any) => 
            allowedOrgIds.includes(Number(plan.organization))
          );
          console.log(`After client-side filtering: ${plansData.length} plans for non-Minister admin`);
        }
        // Map organization names to plans
        plansData = plansData.map((plan: any) => {
          const organizationName = organizationsMap[plan.organization] ||
                                  plan.organization_name ||
                                  'Unknown Organization';

          return {
            ...plan,
            organizationName
          };
        });

        console.log(`Fetched ${plansData.length} plans for admin dashboard`);
        return { data: plansData };
      } catch (error) {
        console.error('Error fetching all plans:', error);
        return { data: [] };
      }
    },
    enabled: isAuthInitialized && (allowedOrgIds.length > 0 || adminOrgType === 'MINISTER'),
    retry: 2
  });

  // Helper function to get organization name
  const getOrganizationName = (plan: any) => {
    return plan.organizationName ||
           plan.organization_name ||
           (plan.organization && organizationsMap[plan.organization]) ||
           'Unknown Organization';
  };
  // FILTERED: Calculate summary statistics for plans (organization hierarchy applied)
  const reviewedPlansData = useMemo(() => {
    const plans = allPlans?.data || [];
    
    // CRITICAL: Apply organization filtering for non-Minister admins
    if (adminOrgType !== 'MINISTER' && allowedOrgIds.length > 0) {
      const filtered = plans.filter((plan: any) => 
        allowedOrgIds.includes(Number(plan.organization))
      );
      console.log(`Non-Minister admin: filtered to ${filtered.length} plans from ${plans.length} total`);
      return filtered;
    }
    
    console.log(`Minister admin: showing all ${plans.length} plans`);
    return plans;
  }, [allPlans?.data, allowedOrgIds, adminOrgType]);


  // FILTERED: Calculate counts (organization hierarchy applied)
  const { totalPlans, pendingCount, approvedCount, rejectedCount } = useMemo(() => {
    let total = 0;
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    console.log(`Calculating plan counts from ${reviewedPlansData.length} filtered plans`);
    reviewedPlansData.forEach(plan => {
      if (['SUBMITTED', 'APPROVED'].includes(plan.status)) {
        total++;
      }
      if (plan.status === 'SUBMITTED') pending++;
      if (plan.status === 'APPROVED') approved++;
      if (plan.status === 'REJECTED') rejected++;
    });

    console.log(`Plan counts - Total: ${total}, Pending: ${pending}, Approved: ${approved}, Rejected: ${rejected}`);
    return {
      totalPlans: total,
      pendingCount: pending,
      approvedCount: approved,
      rejectedCount: rejected
    };
  }, [reviewedPlansData]);

  // Calculate budget totals directly from sub-activities
  const budgetTotals = useMemo(() => {
    const subActivities = directSubActivitiesData?.data || [];
    const submittedAndApprovedPlans = reviewedPlansData.filter(plan => ['SUBMITTED', 'APPROVED'].includes(plan.status));
    const submittedAndApprovedOrgIds = submittedAndApprovedPlans.map(plan => Number(plan.organization));
    
    console.log(`Calculating budget totals from ${subActivities.length} sub-activities for ${submittedAndApprovedPlans.length} SUBMITTED/APPROVED plans`);
    
    if (subActivities.length === 0) {
      return {
        totalBudget: 0,
        totalFunding: 0,
        fundingGap: 0,
        governmentTotal: 0,
        partnersTotal: 0,
        sdgTotal: 0,
        otherTotal: 0
      };
    }
    
    let totalBudget = 0;
    let totalFunding = 0;
    let governmentTotal = 0;
    let partnersTotal = 0;
    let sdgTotal = 0;
    let otherTotal = 0;
    
    subActivities.forEach((subActivity: any) => {
      // CRITICAL: Only include sub-activities from organizations with SUBMITTED or APPROVED plans
      if (!submittedAndApprovedOrgIds.includes(Number(subActivity.organization))) {
        return; // Skip sub-activities from organizations with only REJECTED or DRAFT plans
      }
      
      const budget = subActivity.budget_calculation_type === 'WITH_TOOL'
        ? Number(subActivity.estimated_cost_with_tool || 0)
        : Number(subActivity.estimated_cost_without_tool || 0);
      
      const government = Number(subActivity.government_treasury || 0);
      const partners = Number(subActivity.partners_funding || 0);
      const sdg = Number(subActivity.sdg_funding || 0);
      const other = Number(subActivity.other_funding || 0);
      const funding = government + partners + sdg + other;
      
      totalBudget += budget;
      totalFunding += funding;
      governmentTotal += government;
      partnersTotal += partners;
      sdgTotal += sdg;
      otherTotal += other;
    });
    
    const fundingGap = Math.max(0, totalBudget - totalFunding);
    
    console.log('Budget totals calculated:', {
      totalBudget,
      totalFunding,
      fundingGap,
      subActivitiesCount: subActivities.length,
      submittedApprovedPlans: submittedAndApprovedPlans.length
    });
    
    return {
      totalBudget,
      totalFunding,
      fundingGap,
      governmentTotal,
      partnersTotal,
      sdgTotal,
      otherTotal
    };
  }, [directSubActivitiesData?.data, reviewedPlansData]);

  // Calculate activity type budgets directly from sub-activities
  const calculateActivityTypeBudgets = useMemo(() => {
    const subActivities = directSubActivitiesData?.data || [];
    const submittedAndApprovedPlans = reviewedPlansData.filter(plan => ['SUBMITTED', 'APPROVED'].includes(plan.status));
    const submittedAndApprovedOrgIds = submittedAndApprovedPlans.map(plan => Number(plan.organization));
    
    console.log(`Calculating activity type budgets from ${subActivities.length} sub-activities for ${submittedAndApprovedPlans.length} SUBMITTED/APPROVED plans`);

    const activityBudgets = {
      Training: { count: 0, budget: 0 },
      Meeting: { count: 0, budget: 0 },
      Workshop: { count: 0, budget: 0 },
      Supervision: { count: 0, budget: 0 },
      Procurement: { count: 0, budget: 0 },
      Printing: { count: 0, budget: 0 },
      Other: { count: 0, budget: 0 }
    };

    // Process sub-activities directly
    subActivities.forEach((subActivity: any) => {
      // CRITICAL: Only include sub-activities from organizations with SUBMITTED or APPROVED plans
      if (!submittedAndApprovedOrgIds.includes(Number(subActivity.organization))) {
        return; // Skip sub-activities from organizations with only REJECTED or DRAFT plans
      }
      
      const activityType = subActivity.activity_type || 'Other';
      const key = activityType as keyof typeof activityBudgets;
      
      if (activityBudgets[key]) {
        activityBudgets[key].count++;
        
        const cost = subActivity.budget_calculation_type === 'WITH_TOOL'
          ? Number(subActivity.estimated_cost_with_tool || 0)
          : Number(subActivity.estimated_cost_without_tool || 0);
        
        console.log(`Sub-activity ${subActivity.name}: type=${activityType}, cost=${cost}, org=${subActivity.organizationName}`);
        activityBudgets[key].budget += cost;
      }
    });

    console.log('Final activity type budgets (SUBMITTED/APPROVED only):', activityBudgets);
    return activityBudgets;
  }, [directSubActivitiesData?.data, reviewedPlansData]);

  // Calculate monthly trends
  const monthlyTrends = useMemo(() => {
    const submittedAndApprovedPlans = reviewedPlansData.filter(plan => ['SUBMITTED', 'APPROVED'].includes(plan.status));

    const monthlyData: Record<string, { submissions: number; budget: number }> = {};

    submittedAndApprovedPlans.forEach((plan: any) => {
      if (plan.submitted_at) {
        const month = format(new Date(plan.submitted_at), 'MMM yyyy');
        if (!monthlyData[month]) {
          monthlyData[month] = { submissions: 0, budget: 0 };
        }
        monthlyData[month].submissions++;
        // Calculate budget from sub-activities for this plan
        const planBudget = calculatePlanBudgetFromSubActivities(plan.id);
        monthlyData[month].budget += planBudget;
      }
    });

    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyData).sort((a, b) =>
      new Date(a).getTime() - new Date(b).getTime()
    );

    return {
      labels: sortedMonths,
      submissions: sortedMonths.map(month => monthlyData[month].submissions),
      budgets: sortedMonths.map(month => monthlyData[month].budget)
    };
  }, [reviewedPlansData, directSubActivitiesData?.data]);

  // Calculate organization performance for charts
  const orgPerformance = useMemo(() => {
    const submittedAndApprovedPlans = reviewedPlansData.filter(plan => ['SUBMITTED', 'APPROVED'].includes(plan.status));

    console.log(`Calculating org performance from ${submittedAndApprovedPlans.length} filtered submitted/approved plans`);
    const orgData: Record<string, { plans: number; budget: number; name: string }> = {};

    submittedAndApprovedPlans.forEach((plan: any) => {
      const orgId = plan.organization;
      const orgName = getOrganizationName(plan);

      if (!orgData[orgId]) {
        orgData[orgId] = { plans: 0, budget: 0, name: orgName };
      }

      orgData[orgId].plans++;
      // Calculate budget from sub-activities for this organization
      const orgSubActivities = (directSubActivitiesData?.data || []).filter(
        (subActivity: any) => subActivity.organization === orgId
      );
      const orgBudget = orgSubActivities.reduce((sum, subActivity) => {
        const cost = subActivity.budget_calculation_type === 'WITH_TOOL'
          ? Number(subActivity.estimated_cost_with_tool || 0)
          : Number(subActivity.estimated_cost_without_tool || 0);
        return sum + cost;
      }, 0);
      orgData[orgId].budget += orgBudget;
    });

    const sortedOrgs = Object.values(orgData)
      .sort((a, b) => b.plans - a.plans)
      .slice(0, 10);

    console.log(`Org performance calculated for ${sortedOrgs.length} organizations`);
    return {
      labels: sortedOrgs.map(org => org.name),
      plans: sortedOrgs.map(org => org.plans),
      budgets: sortedOrgs.map(org => org.budget)
    };
  }, [reviewedPlansData, directSubActivitiesData?.data]);

  // Calculate budget by activity type for table
  const budgetByActivityData = useMemo(() => {
    const subActivities = directSubActivitiesData?.data || [];
    
    console.log(`Calculating budget by activity data from ${subActivities.length} sub-activities`);

    const orgActivityData: Record<string, {
      organizationName: string;
      Training: { count: number; budget: number };
      Meeting: { count: number; budget: number };
      Workshop: { count: number; budget: number };
      Procurement: { count: number; budget: number };
      Printing: { count: number; budget: number };
      Other: { count: number; budget: number };
      totalCount: number;
      totalBudget: number;
    }> = {};

    // Process sub-activities directly by organization
    subActivities.forEach((subActivity: any) => {
      const orgId = subActivity.organization || 'unknown';
      const orgName = subActivity.organizationName || organizationsMap[orgId] || 'Unknown Organization';

      if (!orgActivityData[orgId]) {
        orgActivityData[orgId] = {
          organizationName: orgName,
          Training: { count: 0, budget: 0 },
          Meeting: { count: 0, budget: 0 },
          Workshop: { count: 0, budget: 0 },
          Procurement: { count: 0, budget: 0 },
          Printing: { count: 0, budget: 0 },
          Other: { count: 0, budget: 0 },
          totalCount: 0,
          totalBudget: 0
        };
      }

      const activityType = subActivity.activity_type || 'Other';
      const key = activityType as keyof typeof orgActivityData[typeof orgId];
      
      if (orgActivityData[orgId][key]) {
        orgActivityData[orgId][key].count++;
        orgActivityData[orgId].totalCount++;
        
        const cost = subActivity.budget_calculation_type === 'WITH_TOOL'
          ? Number(subActivity.estimated_cost_with_tool || 0)
          : Number(subActivity.estimated_cost_without_tool || 0);
        
        console.log(`Sub-activity ${subActivity.name}: type=${activityType}, cost=${cost} for org ${orgName}`);
        orgActivityData[orgId][key].budget += cost;
        orgActivityData[orgId].totalBudget += cost;
      }
    });

    const result = Object.values(orgActivityData);
    console.log(`Final budget by activity data:`, result.length, 'organizations');
    result.forEach(org => {
      console.log(`${org.organizationName}: ${org.totalCount} activities, ETB ${org.totalBudget.toLocaleString()} budget`);
    });
    
    return result;
  }, [directSubActivitiesData?.data, organizationsMap]);

  // Calculate executive performance data
  const executivePerformanceData = useMemo(() => {
    const submittedAndApprovedPlans = reviewedPlansData.filter(plan => ['SUBMITTED', 'APPROVED'].includes(plan.status));

    console.log(`Calculating executive performance from ${submittedAndApprovedPlans.length} filtered plans`);
    const executiveData: Record<string, {
      organizationName: string;
      totalPlans: number;
      approved: number;
      submitted: number;
      totalBudget: number;
      availableFunding: number;
      governmentBudget: number;
      sdgBudget: number;
      partnersBudget: number;
      fundingGap: number;
    }> = {};

    // CRITICAL: Only process organizations that are in the allowed hierarchy
    submittedAndApprovedPlans.forEach((plan: any) => {
      const orgId = plan.organization;
      
      // Skip if organization is not in allowed list for non-Minister admins
      if (adminOrgType !== 'MINISTER' && allowedOrgIds.length > 0 && !allowedOrgIds.includes(Number(orgId))) {
        return;
      }
      
      const orgName = getOrganizationName(plan);

      if (!executiveData[orgId]) {
        executiveData[orgId] = {
          organizationName: orgName,
          totalPlans: 0,
          approved: 0,
          submitted: 0,
          totalBudget: 0,
          availableFunding: 0,
          governmentBudget: 0,
          sdgBudget: 0,
          partnersBudget: 0,
          fundingGap: 0
        };
      }

      executiveData[orgId].totalPlans++;

      if (plan.status === 'APPROVED') {
        executiveData[orgId].approved++;
      } else if (plan.status === 'SUBMITTED') {
        executiveData[orgId].submitted++;
      }

      // Calculate budget from sub-activities for this organization
      const orgSubActivities = (directSubActivitiesData?.data || []).filter(
        (subActivity: any) => subActivity.organization === orgId
      );
      
      orgSubActivities.forEach((subActivity: any) => {
        const cost = subActivity.budget_calculation_type === 'WITH_TOOL'
          ? Number(subActivity.estimated_cost_with_tool || 0)
          : Number(subActivity.estimated_cost_without_tool || 0);
        
        const government = Number(subActivity.government_treasury || 0);
        const partners = Number(subActivity.partners_funding || 0);
        const sdg = Number(subActivity.sdg_funding || 0);
        const other = Number(subActivity.other_funding || 0);
        const funding = government + partners + sdg + other;
        
        executiveData[orgId].totalBudget += cost;
        executiveData[orgId].availableFunding += funding;
        executiveData[orgId].governmentBudget += government;
        executiveData[orgId].sdgBudget += sdg;
        executiveData[orgId].partnersBudget += partners;
        executiveData[orgId].fundingGap += Math.max(0, cost - funding);
      });
    });

    const result = Object.values(executiveData);
    console.log(`Executive performance calculated for ${result.length} organizations in hierarchy`);
    
    return result;
  }, [reviewedPlansData, directSubActivitiesData?.data]);

  // Calculate complete budget overview for analytics
  const completeBudgetOverview = useMemo(() => {
    const subActivities = directSubActivitiesData?.data || [];
    console.log(`Calculating complete budget overview from ${subActivities.length} sub-activities`);

    const orgBudgetData: Record<string, {
      organizationName: string;
      totalBudget: number;
      funding: number;
    }> = {};

    // Process sub-activities directly by organization
    subActivities.forEach((subActivity: any) => {
      const orgId = subActivity.organization || 'unknown';
      const orgName = subActivity.organizationName || organizationsMap[orgId] || 'Unknown Organization';

      if (!orgBudgetData[orgId]) {
        orgBudgetData[orgId] = {
          organizationName: orgName,
          totalBudget: 0,
          funding: 0
        };
      }

      const cost = subActivity.budget_calculation_type === 'WITH_TOOL'
        ? Number(subActivity.estimated_cost_with_tool || 0)
        : Number(subActivity.estimated_cost_without_tool || 0);
      
      const funding = Number(subActivity.government_treasury || 0) +
                     Number(subActivity.partners_funding || 0) +
                     Number(subActivity.sdg_funding || 0) +
                     Number(subActivity.other_funding || 0);
      
      orgBudgetData[orgId].totalBudget += cost;
      orgBudgetData[orgId].funding += funding;
    });

    const result = Object.values(orgBudgetData).sort((a, b) => b.totalBudget - a.totalBudget);
    console.log('Complete budget overview:', result.length, 'organizations');
    
    return result;
  }, [directSubActivitiesData?.data, organizationsMap]);

  // Filter and sort pending plans
  const getFilteredPendingPlans = useMemo(() => {
    // Start with plans already filtered by organization hierarchy
    let filtered = reviewedPlansData.filter(plan =>
      plan.status === 'SUBMITTED'
    );

    console.log(`Starting with ${filtered.length} pending plans from allowed organizations`);

    // Apply organization filter
    if (pendingOrgFilter !== 'all') {
      filtered = filtered.filter(plan => plan.organization === pendingOrgFilter);
      console.log(`After organization filter (${pendingOrgFilter}): ${filtered.length} plans`);
    }

    // Apply search filter
    if (pendingSearch) {
      filtered = filtered.filter(plan =>
        getOrganizationName(plan).toLowerCase().includes(pendingSearch.toLowerCase()) ||
        (plan.planner_name && plan.planner_name.toLowerCase().includes(pendingSearch.toLowerCase()))
      );
      console.log(`After search filter (${pendingSearch}): ${filtered.length} plans`);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (pendingSortBy) {
        case 'date':
          aValue = new Date(a.submitted_at || a.created_at).getTime();
          bValue = new Date(b.submitted_at || b.created_at).getTime();
          break;
        case 'organization':
          aValue = getOrganizationName(a).toLowerCase();
          bValue = getOrganizationName(b).toLowerCase();
          break;
        case 'planner':
          aValue = (a.planner_name || '').toLowerCase();
          bValue = (b.planner_name || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (pendingSortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Add REAL budget calculation for filtered plans from sub-activities
    const enrichedFiltered = filtered.map((plan: any) => {
      // Get PLAN-SPECIFIC sub-activities by finding main activities that belong to this plan
      const planSubActivities = (directSubActivitiesData?.data || []).filter((subActivity: any) => {
        // This is a simplified approach - in a real scenario, you'd need to link sub-activities to specific plans
        // For now, we'll use organization-based filtering which gives representative budget data
        return subActivity.organization === plan.organization;
      });
      
      console.log(`Plan ${plan.id} (${getOrganizationName(plan)}): found ${planSubActivities.length} sub-activities`);
      
      let totalBudget = 0;
      let totalFunding = 0;
      let government = 0;
      let partners = 0;
      let sdg = 0;
      let other = 0;
      
      // Calculate proportional budget for this plan (divide org budget by number of org plans)
      const orgPlans = reviewedPlansData.filter(p => 
        p.organization === plan.organization && ['SUBMITTED', 'APPROVED'].includes(p.status)
      );
      
      const planWeight = orgPlans.length > 0 ? 1 / orgPlans.length : 1;
      
      planSubActivities.forEach((subActivity: any) => {
        const cost = subActivity.budget_calculation_type === 'WITH_TOOL'
          ? Number(subActivity.estimated_cost_with_tool || 0)
          : Number(subActivity.estimated_cost_without_tool || 0);
        
        const gov = Number(subActivity.government_treasury || 0);
        const part = Number(subActivity.partners_funding || 0);
        const sdgFund = Number(subActivity.sdg_funding || 0);
        const otherFund = Number(subActivity.other_funding || 0);
        const funding = gov + part + sdgFund + otherFund;
        
        // Apply proportional weight to avoid double-counting when multiple plans per organization
        totalBudget += cost * planWeight;
        totalFunding += funding * planWeight;
        government += gov * planWeight;
        partners += part * planWeight;
        sdg += sdgFund * planWeight;
        other += otherFund * planWeight;
      });
      
      const gap = Math.max(0, totalBudget - totalFunding);
      
      console.log(`Plan ${plan.id} budget: total=${totalBudget}, funding=${totalFunding}, gap=${gap}`);
      
      return {
        ...plan,
        budget: {
          total: totalBudget,
          totalFunding,
          government,
          partners,
          sdg,
          other,
          gap
        }
      };
    });
    
    return enrichedFiltered;
  }, [reviewedPlansData, pendingOrgFilter, pendingSearch, pendingSortBy, pendingSortOrder, directSubActivitiesData?.data]);

  const filteredPendingPlans = getFilteredPendingPlans;

  // Pagination for pending plans
  const pendingTotalPages = Math.ceil(filteredPendingPlans.length / pendingItemsPerPage);
  const pendingStartIndex = (pendingCurrentPage - 1) * pendingItemsPerPage;
  const pendingPaginatedPlans = filteredPendingPlans.slice(
    pendingStartIndex,
    pendingStartIndex + pendingItemsPerPage
  );

  // Filter and sort reviewed plans
  const getFilteredReviewedPlans = useMemo(() => {
    // Start with plans already filtered by organization hierarchy
    let filtered = reviewedPlansData.filter(plan =>
      ['APPROVED', 'REJECTED'].includes(plan.status)
    );

    console.log(`Starting with ${filtered.length} approved/rejected plans from allowed organizations`);
    // Apply status filter
    if (reviewedFilter !== 'all') {
      filtered = filtered.filter(plan => plan.status === reviewedFilter);
      console.log(`After status filter (${reviewedFilter}): ${filtered.length} plans`);
    }

    // Apply organization filter
    if (reviewedOrgFilter !== 'all') {
      filtered = filtered.filter(plan => plan.organization === reviewedOrgFilter);
      console.log(`After organization filter (${reviewedOrgFilter}): ${filtered.length} plans`);
    }

    // Apply search filter
    if (reviewedSearch) {
      filtered = filtered.filter(plan =>
        getOrganizationName(plan).toLowerCase().includes(reviewedSearch.toLowerCase()) ||
        (plan.planner_name && plan.planner_name.toLowerCase().includes(reviewedSearch.toLowerCase()))
      );
      console.log(`After search filter (${reviewedSearch}): ${filtered.length} plans`);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (reviewedSortBy) {
        case 'date':
          aValue = new Date(a.submitted_at || a.created_at).getTime();
          bValue = new Date(b.submitted_at || b.created_at).getTime();
          break;
        case 'organization':
          aValue = getOrganizationName(a).toLowerCase();
          bValue = getOrganizationName(b).toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (reviewedSortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Add REAL budget calculation for filtered plans from sub-activities
    const enrichedFiltered = filtered.map((plan: any) => {
      // Get PLAN-SPECIFIC sub-activities by finding main activities that belong to this plan
      const planSubActivities = (directSubActivitiesData?.data || []).filter((subActivity: any) => {
        // This is a simplified approach - in a real scenario, you'd need to link sub-activities to specific plans
        // For now, we'll use organization-based filtering which gives representative budget data
        return subActivity.organization === plan.organization;
      });
      
      console.log(`Plan ${plan.id} (${getOrganizationName(plan)}): found ${planSubActivities.length} sub-activities`);
      
      let totalBudget = 0;
      let totalFunding = 0;
      let government = 0;
      let partners = 0;
      let sdg = 0;
      let other = 0;
      
      // Calculate proportional budget for this plan (divide org budget by number of org plans)
      const orgPlans = reviewedPlansData.filter(p => 
        p.organization === plan.organization && ['SUBMITTED', 'APPROVED'].includes(p.status)
      );
      
      const planWeight = orgPlans.length > 0 ? 1 / orgPlans.length : 1;
      
      planSubActivities.forEach((subActivity: any) => {
        const cost = subActivity.budget_calculation_type === 'WITH_TOOL'
          ? Number(subActivity.estimated_cost_with_tool || 0)
          : Number(subActivity.estimated_cost_without_tool || 0);
        
        const gov = Number(subActivity.government_treasury || 0);
        const part = Number(subActivity.partners_funding || 0);
        const sdgFund = Number(subActivity.sdg_funding || 0);
        const otherFund = Number(subActivity.other_funding || 0);
        const funding = gov + part + sdgFund + otherFund;
        
        // Apply proportional weight to avoid double-counting when multiple plans per organization
        totalBudget += cost * planWeight;
        totalFunding += funding * planWeight;
        government += gov * planWeight;
        partners += part * planWeight;
        sdg += sdgFund * planWeight;
        other += otherFund * planWeight;
      });
      
      const gap = Math.max(0, totalBudget - totalFunding);
      
      console.log(`Plan ${plan.id} budget: total=${totalBudget}, funding=${totalFunding}, gap=${gap}`);
      
      return {
        ...plan,
        budget: {
          total: totalBudget,
          totalFunding,
          government,
          partners,
          sdg,
          other,
          gap
        }
      };
    });
    
    return enrichedFiltered;
  }, [reviewedPlansData, reviewedFilter, reviewedOrgFilter, reviewedSearch, reviewedSortBy, reviewedSortOrder, directSubActivitiesData?.data]);

  const filteredReviewedPlans = getFilteredReviewedPlans;

  // Pagination for reviewed plans
  const reviewedTotalPages = Math.ceil(filteredReviewedPlans.length / reviewedItemsPerPage);
  const reviewedStartIndex = (reviewedCurrentPage - 1) * reviewedItemsPerPage;
  const reviewedPaginatedPlans = filteredReviewedPlans.slice(
    reviewedStartIndex,
    reviewedStartIndex + reviewedItemsPerPage
  );

  // Pagination for budget by activity
  const budgetActivityTotalPages = Math.ceil(budgetByActivityData.length / budgetActivityItemsPerPage);
  const budgetActivityStartIndex = (budgetActivityCurrentPage - 1) * budgetActivityItemsPerPage;
  const budgetActivityPaginatedData = budgetByActivityData.slice(
    budgetActivityStartIndex,
    budgetActivityStartIndex + budgetActivityItemsPerPage
  );

  // Pagination for executive performance
  const executiveTotalPages = Math.ceil(executivePerformanceData.length / executiveItemsPerPage);
  const executiveStartIndex = (executiveCurrentPage - 1) * executiveItemsPerPage;
  const executivePaginatedData = executivePerformanceData.slice(
    executiveStartIndex,
    executiveStartIndex + executiveItemsPerPage
  );

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not available';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (e) {
      return 'Invalid date';
    }
  };

  const formatCurrency = (amount: number): string => {
    return `ETB ${amount.toLocaleString('en-US')}`;
  };

  // Chart configurations
  const planStatusChartData = {
    labels: ['Approved', 'Rejected', 'Pending'],
    datasets: [{
      data: [approvedCount, rejectedCount, pendingCount],
      backgroundColor: ['#10B981', '#EF4444', '#F59E0B'],
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  };

  const budgetDistributionChartData = {
    labels: ['Government', 'Partners', 'SDG', 'Other', 'Gap'],
    datasets: [{
      data: [
        budgetTotals.governmentTotal,
        budgetTotals.partnersTotal,
        budgetTotals.sdgTotal,
        budgetTotals.otherTotal,
        budgetTotals.fundingGap
      ],
      backgroundColor: ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'],
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  };

  const monthlyTrendsChartData = {
    labels: monthlyTrends.labels,
    datasets: [
      {
        type: 'line' as const,
        label: 'Submissions',
        data: monthlyTrends.submissions,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        yAxisID: 'y',
        tension: 0.4
      },
      {
        type: 'bar' as const,
        label: 'Budget (ETB)',
        data: monthlyTrends.budgets,
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        yAxisID: 'y1'
      }
    ]
  };

  const orgPerformanceChartData = {
    labels: orgPerformance.labels,
    datasets: [
      {
        label: 'Plans Count',
        data: orgPerformance.plans,
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        yAxisID: 'y'
      },
      {
        label: 'Budget (ETB)',
        data: orgPerformance.budgets,
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        yAxisID: 'y1'
      }
    ]
  };

  // Complete Budget Overview Chart Data
  const completeBudgetChartData = {
    labels: completeBudgetOverview.map(org => org.organizationName),
    datasets: [
      {
        label: 'Total Budget',
        data: completeBudgetOverview.map(org => org.totalBudget),
        backgroundColor: completeBudgetOverview.map((_, index) => {
          const colors = [
            '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
            '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1',
            '#14B8A6', '#F59E0B', '#8B5CF6', '#06B6D4', '#84CC16'
          ];
          return colors[index % colors.length];
        }),
        borderWidth: 1,
        borderRadius: 4
      },
      {
        label: 'Available Funding',
        data: completeBudgetOverview.map(org => org.funding),
        backgroundColor: completeBudgetOverview.map((_, index) => {
          const colors = [
            '#93C5FD', '#86EFAC', '#FCD34D', '#FCA5A5', '#C4B5FD',
            '#67E8F9', '#BEF264', '#FDBA74', '#F9A8D4', '#A5B4FC',
            '#5EEAD4', '#FCD34D', '#C4B5FD', '#67E8F9', '#BEF264'
          ];
          return colors[index % colors.length];
        }),
        borderWidth: 1,
        borderRadius: 4
      }
    ]
  };

  // Show loading during initialization
  if (!isAuthInitialized || isLoading || isLoadingDirectSubActivities) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="h-6 w-6 animate-spin mr-2 text-blue-600" />
        <span className="text-lg">
          {!isAuthInitialized ? 'Checking admin permissions...' : 
           isLoadingDirectSubActivities ? 'Loading budget data...' : 
           'Loading admin dashboard...'}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
        <p className="text-red-600 mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 rounded-lg shadow-lg mb-8 overflow-hidden">
        <div className="px-8 py-12 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center mb-4">
                <Shield className="h-12 w-12 text-white mr-4" />
                <div>
                  <h1 className="text-4xl font-bold">
                    {adminOrgType === 'MINISTER' ? 'Higher Officials Dashboard' : 'State Minister Level Dashboard'}
                  </h1>
                  <p className="text-xl text-blue-100">
                    Ministry of Health - {adminOrgType === 'MINISTER' ? 'System-wide' : 'Hierarchy'} Plan Overview
                  </p>
                </div>
              </div>
              <p className="text-lg text-blue-100 max-w-2xl">
                Comprehensive monitoring and analysis of strategic planning activities across{' '}
                {adminOrgType === 'MINISTER' ? 'all organizational units' : 'your organizational hierarchy'}.
                Track plan submissions, budget allocations, and performance metrics in real-time.
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{totalPlans}</div>
              <div className="text-blue-100">Total Plans</div>
              <div className="text-sm text-blue-200 mt-2">
                {adminOrgType === 'MINISTER' ? 'System-wide' : `${adminOrgType} Hierarchy`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Debug information for troubleshooting */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-4 bg-gray-100 rounded-lg text-xs text-gray-600">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>Admin Org ID: {adminOrgId || 'Not set'}</div>
            <div>Admin Org Type: {adminOrgType || 'Not set'}</div>
            <div>Allowed Orgs: {allowedOrgIds.length}</div>
            <div>Total Plans: {reviewedPlansData.length}</div>
            <div>Organizations Map: {Object.keys(organizationsMap).length}</div>
            <div>Budget Total: {formatCurrency(budgetTotals.totalBudget)}</div>
            <div>Sub-Activities: {(directSubActivitiesData?.data || []).length}</div>
            <div>Auth Initialized: {isAuthInitialized ? 'Yes' : 'No'}</div>
            <div>Loading Sub-Activities: {isLoadingDirectSubActivities ? 'Yes' : 'No'}</div>
            <div>Activity Types Total: {Object.values(calculateActivityTypeBudgets).reduce((sum, type) => sum + type.count, 0)}</div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pending'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Reviews
              {pendingCount > 0 && (
                <span className="ml-2 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('reviewed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reviewed'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Reviewed Plans
              {(approvedCount + rejectedCount) > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                  {approvedCount + rejectedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('budget-activity')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'budget-activity'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Budget by Activity
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'analytics'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab('executive-performance')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'executive-performance'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Executive Performance
            </button>
          </nav>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Top Statistics Cards - Plan Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Total Plans</p>
                  <p className="text-3xl font-bold">{totalPlans}</p>
                  <p className="text-blue-100 text-xs">Submitted + Approved</p>
                </div>
                <ClipboardCheck className="h-12 w-12 text-blue-200" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm font-medium">Pending Review</p>
                  <p className="text-3xl font-bold">{pendingCount}</p>
                  <p className="text-amber-100 text-xs">Awaiting evaluation</p>
                </div>
                <AlertCircle className="h-12 w-12 text-amber-200" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Approved</p>
                  <p className="text-3xl font-bold">{approvedCount}</p>
                  <p className="text-green-100 text-xs">Successfully reviewed</p>
                </div>
                <CheckCircle className="h-12 w-12 text-green-200" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm font-medium">Rejected</p>
                  <p className="text-3xl font-bold">{rejectedCount}</p>
                  <p className="text-red-100 text-xs">Needs revision</p>
                </div>
                <XCircle className="h-12 w-12 text-red-200" />
              </div>
            </div>
          </div>

          {/* Budget Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-sm font-medium">Total Budget</p>
                  <p className="text-2xl font-bold">{formatCurrency(budgetTotals.totalBudget)}</p>
                  <p className="text-indigo-100 text-xs">All LEO/EO Plans</p>
                </div>
                <DollarSign className="h-10 w-10 text-indigo-200" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm font-medium">Available Funding</p>
                  <p className="text-2xl font-bold">{formatCurrency(budgetTotals.totalFunding)}</p>
                  <p className="text-emerald-100 text-xs">All sources combined</p>
                </div>
                <TrendingUp className="h-10 w-10 text-emerald-200" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-rose-100 text-sm font-medium">Funding Gap</p>
                  <p className="text-2xl font-bold">{formatCurrency(budgetTotals.fundingGap)}</p>
                  <p className="text-rose-100 text-xs">Additional funding needed</p>
                </div>
                <AlertCircle className="h-10 w-10 text-rose-200" />
              </div>
            </div>
          </div>

          {/* Budget by Activity Type Cards */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Budget by Activity Type</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg shadow-md p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <GraduationCap className="h-8 w-8 text-blue-100" />
                  <span className="text-xs bg-blue-600 px-2 py-1 rounded-full">
                    {calculateActivityTypeBudgets.Training.count}
                  </span>
                </div>
                <h4 className="font-medium text-sm">Training</h4>
                <p className="text-xs text-blue-100">{formatCurrency(calculateActivityTypeBudgets.Training.budget)}</p>
              </div>

              <div className="bg-gradient-to-br from-green-400 to-green-500 rounded-lg shadow-md p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <MessageSquare className="h-8 w-8 text-green-100" />
                  <span className="text-xs bg-green-600 px-2 py-1 rounded-full">
                    {calculateActivityTypeBudgets.Meeting.count}
                  </span>
                </div>
                <h4 className="font-medium text-sm">Meeting</h4>
                <p className="text-xs text-green-100">{formatCurrency(calculateActivityTypeBudgets.Meeting.budget)}</p>
              </div>

              <div className="bg-gradient-to-br from-purple-400 to-purple-500 rounded-lg shadow-md p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Users className="h-8 w-8 text-purple-100" />
                  <span className="text-xs bg-purple-600 px-2 py-1 rounded-full">
                    {calculateActivityTypeBudgets.Workshop.count}
                  </span>
                </div>
                <h4 className="font-medium text-sm">Workshop</h4>
                <p className="text-xs text-purple-100">{formatCurrency(calculateActivityTypeBudgets.Workshop.budget)}</p>
              </div>

              <div className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-lg shadow-md p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Eye className="h-8 w-8 text-orange-100" />
                  <span className="text-xs bg-orange-600 px-2 py-1 rounded-full">
                    {calculateActivityTypeBudgets.Supervision.count}
                  </span>
                </div>
                <h4 className="font-medium text-sm">Supervision</h4>
                <p className="text-xs text-orange-100">{formatCurrency(calculateActivityTypeBudgets.Supervision.budget)}</p>
              </div>

              <div className="bg-gradient-to-br from-teal-400 to-teal-500 rounded-lg shadow-md p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Package className="h-8 w-8 text-teal-100" />
                  <span className="text-xs bg-teal-600 px-2 py-1 rounded-full">
                    {calculateActivityTypeBudgets.Procurement.count}
                  </span>
                </div>
                <h4 className="font-medium text-sm">Procurement</h4>
                <p className="text-xs text-teal-100">{formatCurrency(calculateActivityTypeBudgets.Procurement.budget)}</p>
              </div>

              <div className="bg-gradient-to-br from-pink-400 to-pink-500 rounded-lg shadow-md p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <FileText className="h-8 w-8 text-pink-100" />
                  <span className="text-xs bg-pink-600 px-2 py-1 rounded-full">
                    {calculateActivityTypeBudgets.Printing.count}
                  </span>
                </div>
                <h4 className="font-medium text-sm">Printing</h4>
                <p className="text-xs text-pink-100">{formatCurrency(calculateActivityTypeBudgets.Printing.budget)}</p>
              </div>

              <div className="bg-gradient-to-br from-gray-400 to-gray-500 rounded-lg shadow-md p-4 text-white">
                <div className="flex items-center justify-between mb-2">
                  <Wrench className="h-8 w-8 text-gray-100" />
                  <span className="text-xs bg-gray-600 px-2 py-1 rounded-full">
                    {calculateActivityTypeBudgets.Other.count}
                  </span>
                </div>
                <h4 className="font-medium text-sm">Other</h4>
                <p className="text-xs text-gray-100">{formatCurrency(calculateActivityTypeBudgets.Other.budget)}</p>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Plan Status Distribution */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <PieChart className="h-5 w-5 mr-2 text-blue-600" />
                Plan Status Distribution
              </h3>
              <div className="h-64">
                <Doughnut
                  data={planStatusChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom' as const,
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Budget & Funding Distribution */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-green-600" />
                Budget & Funding Distribution
              </h3>
              <div className="h-64">
                <Doughnut
                  data={budgetDistributionChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom' as const,
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Monthly Submission Trends */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-purple-600" />
              Monthly Submission Trends
            </h3>
            <div className="h-80">
              <Line
                data={monthlyTrendsChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index' as const,
                    intersect: false,
                  },
                  scales: {
                    x: {
                      display: true,
                      title: {
                        display: true,
                        text: 'Month'
                      }
                    },
                    y: {
                      type: 'linear' as const,
                      display: true,
                      position: 'left' as const,
                      title: {
                        display: true,
                        text: 'Number of Submissions'
                      }
                    },
                    y1: {
                      type: 'linear' as const,
                      display: true,
                      position: 'right' as const,
                      title: {
                        display: true,
                        text: 'Budget Amount (ETB)'
                      },
                      grid: {
                        drawOnChartArea: false,
                      },
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Top Organizations by Plan Activity */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-indigo-600" />
              Top Executives by Plan Activity
            </h3>
            <div className="h-80">
              <Bar
                data={orgPerformanceChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      type: 'linear' as const,
                      display: true,
                      position: 'left' as const,
                      title: {
                        display: true,
                        text: 'Number of Plans'
                      }
                    },
                    y1: {
                      type: 'linear' as const,
                      display: true,
                      position: 'right' as const,
                      title: {
                        display: true,
                        text: 'Budget Amount (ETB)'
                      },
                      grid: {
                        drawOnChartArea: false,
                      },
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Pending Reviews Tab */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900">Pending Reviews</h3>
                <p className="mt-1 text-sm text-gray-500">
                  All plans awaiting review from{' '}
                  {adminOrgType === 'MINISTER' ? 'all organizations' : 'your organizational hierarchy'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search planner or organization..."
                    value={pendingSearch}
                    onChange={(e) => setPendingSearch(e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={pendingOrgFilter}
                  onChange={(e) => setPendingOrgFilter(e.target.value)}
                  className="text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">
                    {adminOrgType === 'MINISTER' ? 'All Executives' : 'All Hierarchy Executives'}
                  </option>
                  {Object.entries(organizationsMap)
                    .filter(([id]) => 
                      adminOrgType === 'MINISTER' || allowedOrgIds.includes(Number(id))
                    )
                    .map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                </select>
                <button
                  onClick={() => refetch()}
                  className="flex items-center px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-md"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </button>
              </div>
            </div>

            {filteredPendingPlans.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No pending plans found</h3>
                <p className="text-gray-500">
                  {pendingSearch || pendingOrgFilter !== 'all' 
                    ? "No plans match your current filters." 
                    : "No plans are currently awaiting review."}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => {
                            if (pendingSortBy === 'organization') {
                              setPendingSortOrder(pendingSortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setPendingSortBy('organization');
                              setPendingSortOrder('asc');
                            }
                          }}
                        >
                          <div className="flex items-center">
                            Organization
                            {pendingSortBy === 'organization' && (
                              <span className="ml-1">
                                {pendingSortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => {
                            if (pendingSortBy === 'planner') {
                              setPendingSortOrder(pendingSortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setPendingSortBy('planner');
                              setPendingSortOrder('asc');
                            }
                          }}
                        >
                          <div className="flex items-center">
                            Planner
                            {pendingSortBy === 'planner' && (
                              <span className="ml-1">
                                {pendingSortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Executive
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Plan Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fiscal Year
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => {
                            if (pendingSortBy === 'date') {
                              setPendingSortOrder(pendingSortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setPendingSortBy('date');
                              setPendingSortOrder('desc');
                            }
                          }}
                        >
                          <div className="flex items-center">
                            Submitted Date
                            {pendingSortBy === 'date' && (
                              <span className="ml-1">
                                {pendingSortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Planning Period
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Budget Analysis
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pendingPaginatedPlans.map((plan: any) => {
                        const budget = plan.budget;
                        const fundingCoverage = budget.total > 0 ? (budget.totalFunding / budget.total) * 100 : 0;

                        return (
                          <tr key={plan.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {getOrganizationName(plan)}
                                  </div>
                                  <div className="text-xs text-gray-500">ID: {plan.organization}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {plan.planner_name || 'Unknown Planner'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {plan.executive_name || 'Not specified'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {plan.type || 'Unknown Type'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-900">{plan.fiscal_year || 'N/A'}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                                <div className="text-sm text-gray-500">
                                  {plan.submitted_at ? formatDate(plan.submitted_at) : 'Not available'}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">
                                {plan.from_date && plan.to_date ? 
                                  `${formatDate(plan.from_date)} - ${formatDate(plan.to_date)}` :
                                  'Date not available'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm">
                                <div className="font-medium text-gray-900">
                                  {formatCurrency(budget.total)}
                                </div>
                                <div className="text-gray-500">
                                  Funding: {budget.total > 0 ? fundingCoverage.toFixed(1) : '0'}%
                                </div>
                                <div className="text-xs text-gray-400">
                                  Gap: {formatCurrency(budget.gap)}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">
                                {plan.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => navigate(`/admin/plans/${plan.id}`)}
                                className="text-blue-600 hover:text-blue-900 flex items-center justify-end"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination for Pending Plans */}
                {pendingTotalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
                    <div className="flex flex-1 justify-between sm:hidden">
                      <button
                        onClick={() => setPendingCurrentPage(Math.max(1, pendingCurrentPage - 1))}
                        disabled={pendingCurrentPage === 1}
                        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPendingCurrentPage(Math.min(pendingTotalPages, pendingCurrentPage + 1))}
                        disabled={pendingCurrentPage === pendingTotalPages}
                        className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Showing <span className="font-medium">{pendingStartIndex + 1}</span> to{' '}
                          <span className="font-medium">
                            {Math.min(pendingStartIndex + pendingItemsPerPage, filteredPendingPlans.length)}
                          </span>{' '}
                          of <span className="font-medium">{filteredPendingPlans.length}</span> results
                        </p>
                      </div>
                      <div>
                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                          <button
                            onClick={() => setPendingCurrentPage(Math.max(1, pendingCurrentPage - 1))}
                            disabled={pendingCurrentPage === 1}
                            className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          {Array.from({ length: Math.min(5, pendingTotalPages) }, (_, i) => {
                            const pageNum = i + 1;
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setPendingCurrentPage(pageNum)}
                                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                  pageNum === pendingCurrentPage
                                    ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                                    : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => setPendingCurrentPage(Math.min(pendingTotalPages, pendingCurrentPage + 1))}
                            disabled={pendingCurrentPage === pendingTotalPages}
                            className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Reviewed Plans Tab */}
      {activeTab === 'reviewed' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900">Reviewed Plans</h3>
                <p className="mt-1 text-sm text-gray-500">
                  All plans that have been reviewed (approved or rejected)
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search planner or organization..."
                    value={reviewedSearch}
                    onChange={(e) => setReviewedSearch(e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={reviewedFilter}
                  onChange={(e) => setReviewedFilter(e.target.value)}
                  className="text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
        <select
                    value={reviewedOrgFilter}
                    onChange={(e) => setReviewedOrgFilter(e.target.value)}
                    className="text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          >
                  <option value="all">
                    {adminOrgType === 'MINISTER' ? 'All Executives' : 'All Hierarchy Executives'}
                  </option>
                    {Object.entries(organizationsMap)
                    .filter(([id]) => 
            adminOrgType === 'MINISTER' || allowedOrgIds.includes(Number(id))
    )
    .map(([id, name]) => (
      <option key={id} value={id}>{name}</option>
    ))}
</select>
                <button
                  onClick={() => refetch()}
                  className="flex items-center px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-md">
                
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </button>
              </div>
            </div>

            {filteredReviewedPlans.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <ClipboardCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No reviewed plans found</h3>
                <p className="text-gray-500">No plans match your current filters.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => {
                            if (reviewedSortBy === 'organization') {
                              setReviewedSortOrder(reviewedSortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setReviewedSortBy('organization');
                              setReviewedSortOrder('asc');
                            }
                          }}
                        >
                          <div className="flex items-center">
                            Organization
                            {reviewedSortBy === 'organization' && (
                              <span className="ml-1">
                                {reviewedSortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Planner
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Plan Type
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => {
                            if (reviewedSortBy === 'date') {
                              setReviewedSortOrder(reviewedSortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setReviewedSortBy('date');
                              setReviewedSortOrder('desc');
                            }
                          }}
                        >
                          <div className="flex items-center">
                            Submitted Date
                            {reviewedSortBy === 'date' && (
                              <span className="ml-1">
                                {reviewedSortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => {
                            if (reviewedSortBy === 'status') {
                              setReviewedSortOrder(reviewedSortOrder === 'asc' ? 'desc' : 'asc');
                            } else {
                              setReviewedSortBy('status');
                              setReviewedSortOrder('asc');
                            }
                          }}
                        >
                          <div className="flex items-center">
                            Status
                            {reviewedSortBy === 'status' && (
                              <span className="ml-1">
                                {reviewedSortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Budget Analysis
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-230">
                      {reviewedPaginatedPlans.map((plan: any) => {
                        const budget = plan.budget;
                        const fundingCoverage = budget.total > 0 ? (budget.totalFunding / budget.total) * 100 : 0;

                        return (
                          <tr key={plan.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-900">
                                  {getOrganizationName(plan)}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {plan.planner_name || 'Unknown Planner'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {plan.type || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {plan.submitted_at ? formatDate(plan.submitted_at) : 'Not submitted'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                plan.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {plan.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm">
                                <div className="font-medium text-gray-900">
                                  {formatCurrency(budget.total)}
                                </div>
                                <div className="text-gray-500">
                                  Funding: {fundingCoverage.toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-400">
                                  Gap: {formatCurrency(budget.gap)}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => navigate(`/admin/plans/${plan.id}`)}
                                className="text-blue-600 hover:text-blue-900 flex items-center"
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination for Reviewed Plans */}
                {reviewedTotalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
                    <div className="flex flex-1 justify-between sm:hidden">
                      <button
                        onClick={() => setReviewedCurrentPage(Math.max(1, reviewedCurrentPage - 1))}
                        disabled={reviewedCurrentPage === 1}
                        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setReviewedCurrentPage(Math.min(reviewedTotalPages, reviewedCurrentPage + 1))}
                        disabled={reviewedCurrentPage === reviewedTotalPages}
                        className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Showing <span className="font-medium">{reviewedStartIndex + 1}</span> to{' '}
                          <span className="font-medium">
                            {Math.min(reviewedStartIndex + reviewedItemsPerPage, filteredReviewedPlans.length)}
                          </span>{' '}
                          of <span className="font-medium">{filteredReviewedPlans.length}</span> results
                        </p>
                      </div>
                      <div>
                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                          <button
                            onClick={() => setReviewedCurrentPage(Math.max(1, reviewedCurrentPage - 1))}
                            disabled={reviewedCurrentPage === 1}
                            className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          {Array.from({ length: Math.min(5, reviewedTotalPages) }, (_, i) => {
                            const pageNum = i + 1;
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setReviewedCurrentPage(pageNum)}
                                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                  pageNum === reviewedCurrentPage
                                    ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                                    : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => setReviewedCurrentPage(Math.min(reviewedTotalPages, reviewedCurrentPage + 1))}
                            disabled={reviewedCurrentPage === reviewedTotalPages}
                            className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Budget by Activity Tab */}
      {activeTab === 'budget-activity' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900">Budget by Activity Type</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Activity counts and budgets by Executives
                </p>
              </div>
            </div>

            {budgetByActivityData.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No activity data found</h3>
                <p className="text-gray-500">No budget activities have been recorded yet.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Executive Name
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Training
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Meeting
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Workshop
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Procurement
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Printing
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Other
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Count
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Budget
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {budgetActivityPaginatedData.map((orgData: any, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                              <span className="text-sm font-medium text-gray-900">
                                {orgData.organizationName}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {orgData.Training.count}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {orgData.Meeting.count}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {orgData.Workshop.count}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                              {orgData.Procurement.count}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                              {orgData.Printing.count}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {orgData.Other.count}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm font-medium text-gray-900">
                              {orgData.totalCount}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm font-medium text-green-600">
                              {formatCurrency(orgData.totalBudget)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination for Budget by Activity */}
                {budgetActivityTotalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
                    <div className="flex flex-1 justify-between sm:hidden">
                      <button
                        onClick={() => setBudgetActivityCurrentPage(Math.max(1, budgetActivityCurrentPage - 1))}
                        disabled={budgetActivityCurrentPage === 1}
                        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setBudgetActivityCurrentPage(Math.min(budgetActivityTotalPages, budgetActivityCurrentPage + 1))}
                        disabled={budgetActivityCurrentPage === budgetActivityTotalPages}
                        className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Showing <span className="font-medium">{budgetActivityStartIndex + 1}</span> to{' '}
                          <span className="font-medium">
                            {Math.min(budgetActivityStartIndex + budgetActivityItemsPerPage, budgetByActivityData.length)}
                          </span>{' '}
                          of <span className="font-medium">{budgetByActivityData.length}</span> results
                        </p>
                      </div>
                      <div>
                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                          <button
                            onClick={() => setBudgetActivityCurrentPage(Math.max(1, budgetActivityCurrentPage - 1))}
                            disabled={budgetActivityCurrentPage === 1}
                            className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          {Array.from({ length: Math.min(5, budgetActivityTotalPages) }, (_, i) => {
                            const pageNum = i + 1;
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setBudgetActivityCurrentPage(pageNum)}
                                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                  pageNum === budgetActivityCurrentPage
                                    ? 'z-10 bg-blue-600 text-white'
                                    : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => setBudgetActivityCurrentPage(Math.min(budgetActivityTotalPages, budgetActivityCurrentPage + 1))}
                            disabled={budgetActivityCurrentPage === budgetActivityTotalPages}
                            className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          {/* Complete Budget Overview by Executives */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
              Complete Budget Overview by Executives
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Budget analysis for organizations with submitted and approved plans
            </p>
            {completeBudgetOverview.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No budget data available</h3>
                <p className="text-gray-500">No Executives have submitted or approved plans with budget data.</p>
              </div>
            ) : (
              <div className="h-96">
                <Bar
                  data={completeBudgetChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top' as const,
                      },
                      title: {
                        display: true,
                        text: `Budget Overview - ${completeBudgetOverview.length} Organizations`
                      }
                    },
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: 'Organizations'
                        },
                        ticks: {
                          maxRotation: 45,
                          minRotation: 45
                        }
                      },
                      y: {
                        title: {
                          display: true,
                          text: 'Budget Amount (ETB)'
                        },
                        ticks: {
                          callback: function(value) {
                            return 'ETB ' + Number(value).toLocaleString();
                          }
                        }
                      }
                    },
                    interaction: {
                      intersect: false,
                      mode: 'index' as const
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Other Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Plan Status Distribution */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <PieChart className="h-5 w-5 mr-2 text-blue-600" />
                Plan Status Distribution
              </h3>
              <div className="h-64">
                <Doughnut
                  data={planStatusChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom' as const,
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Budget & Funding Distribution */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-green-600" />
                Budget & Funding Distribution
              </h3>
              <div className="h-64">
                <Doughnut
                  data={budgetDistributionChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom' as const,
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Monthly Submission Trends */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-purple-600" />
              Monthly Submission Trends
            </h3>
            <div className="h-80">
              <Line
                data={monthlyTrendsChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index' as const,
                    intersect: false,
                  },
                  scales: {
                    x: {
                      display: true,
                      title: {
                        display: true,
                        text: 'Month'
                      }
                    },
                    y: {
                      type: 'linear' as const,
                      display: true,
                      position: 'left' as const,
                      title: {
                        display: true,
                        text: 'Number of Submissions'
                      }
                    },
                    y1: {
                      type: 'linear' as const,
                      display: true,
                      position: 'right' as const,
                      title: {
                        display: true,
                        text: 'Budget Amount (ETB)'
                      },
                      grid: {
                        drawOnChartArea: false,
                      },
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Executive Performance Tab */}
      {activeTab === 'executive-performance' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-medium leading-6 text-gray-900">Executive Performance Overview</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Comprehensive performance metrics for all executive organizations
                </p>
              </div>
            </div>

            {executivePerformanceData.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">No performance data available</h3>
                <p className="text-gray-500">No executive performance data has been recorded yet.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Executives Name
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Plans
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Approved
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Submitted
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Budget
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Available Funding
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Government Budget
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          SDG Budget
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Partners Budget
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Funding Gap
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {executivePaginatedData.map((execData: any, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                              <span className="text-sm font-medium text-gray-900">
                                {execData.organizationName}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                            {execData.totalPlans}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {execData.approved}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              {execData.submitted}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                            {formatCurrency(execData.totalBudget)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-green-600">
                            {formatCurrency(execData.availableFunding)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-blue-600">
                            {formatCurrency(execData.governmentBudget)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-purple-600">
                            {formatCurrency(execData.sdgBudget)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-orange-600">
                            {formatCurrency(execData.partnersBudget)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                            <span className={execData.fundingGap > 0 ? 'text-red-600' : 'text-green-600'}>
                              {formatCurrency(execData.fundingGap)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination for Executive Performance */}
                {executiveTotalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
                    <div className="flex flex-1 justify-between sm:hidden">
                      <button
                        onClick={() => setExecutiveCurrentPage(Math.max(1, executiveCurrentPage - 1))}
                        disabled={executiveCurrentPage === 1}
                        className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setExecutiveCurrentPage(Math.min(executiveTotalPages, executiveCurrentPage + 1))}
                        disabled={executiveCurrentPage === executiveTotalPages}
                        className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          Showing <span className="font-medium">{executiveStartIndex + 1}</span> to{' '}
                          <span className="font-medium">
                            {Math.min(executiveStartIndex + executiveItemsPerPage, executivePerformanceData.length)}
                          </span>{' '}
                          of <span className="font-medium">{executivePerformanceData.length}</span> results
                        </p>
                      </div>
                      <div>
                        <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                          <button
                            onClick={() => setExecutiveCurrentPage(Math.max(1, executiveCurrentPage - 1))}
                            disabled={executiveCurrentPage === 1}
                            className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          {Array.from({ length: Math.min(5, executiveTotalPages) }, (_, i) => {
                            const pageNum = i + 1;
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setExecutiveCurrentPage(pageNum)}
                                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                  pageNum === executiveCurrentPage
                                    ? 'z-10 bg-blue-600 text-white'
                                    : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => setExecutiveCurrentPage(Math.min(executiveTotalPages, executiveCurrentPage + 1))}
                            disabled={executiveCurrentPage === executiveTotalPages}
                            className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
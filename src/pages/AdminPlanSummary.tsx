
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, User, Calendar, FileType, Activity, DollarSign, AlertCircle, Info, Loader, CheckCircle } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { auth, api } from '../lib/api';
import { format } from 'date-fns';

interface Objective {
  id: number;
  title: string;
  initiatives: Initiative[];
  effective_weight?: number;
  planner_weight?: number;
}

interface Initiative {
  id: number;
  name: string;
  performance_measures: PerformanceMeasure[];
  main_activities: MainActivity[];
}

interface PerformanceMeasure {
  id: number;
  name: string;
}

interface MainActivity {
  id: number;
  name: string;
  sub_activities: SubActivity[];
  budget: Budget | null;
}

interface SubActivity {
  id: number;
  name: string;
  estimated_cost_with_tool?: number;
  estimated_cost_without_tool?: number;
  government_treasury?: number;
  sdg_funding?: number;
  partners_funding?: number;
  other_funding?: number;
}

interface Budget {
  budget_calculation_type: string;
  estimated_cost_with_tool: number;
  estimated_cost_without_tool: number;
  government_treasury: number;
  sdg_funding: number;
  partners_funding: number;
  other_funding: number;
}

interface PlanReviewTableProps {
  objectives: Objective[];
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  organizationName: string;
  plannerName: string;
  fromDate: string;
  toDate: string;
  planType: string;
  isViewOnly: boolean;
  plannerOrgId: number | null;
}

const PlanReviewTable: React.FC<PlanReviewTableProps> = ({
  objectives,
  organizationName,
  plannerName,
  fromDate,
  toDate,
  planType,
  isViewOnly,
}) => {
  console.log('PlanReviewTable: Received objectives:', JSON.stringify(objectives, null, 2));

  return (
    <div>
      <div className="mb-4">
        <h4 className="text-md font-medium text-gray-900">Plan Details</h4>
        <p className="text-sm text-gray-600">
          Organization: {organizationName} | Planner: {plannerName} | Type: {planType} | Period:{' '}
          {fromDate && toDate ? `${format(new Date(fromDate), 'MMM d, yyyy')} - ${format(new Date(toDate), 'MMM d, yyyy')}` : 'N/A'}
        </p>
      </div>

      {objectives.length === 0 ? (
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No objectives found for this plan.</p>
        </div>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Objective</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Initiative</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance Measures</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Main Activities</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sub Activities</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget (ETB)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {objectives.map((objective) => {
              console.log(`PlanReviewTable: Rendering objective ${objective.id}:`, {
                title: objective.title,
                initiatives_count: objective.initiatives?.length || 0,
              });
              return (
                <React.Fragment key={objective.id}>
                  {objective.initiatives && objective.initiatives.length > 0 ? (
                    objective.initiatives.map((initiative: Initiative, initIndex: number) => {
                      console.log(`PlanReviewTable: Rendering initiative ${initiative.id}:`, {
                        name: initiative.name,
                        measures_count: initiative.performance_measures?.length || 0,
                        activities_count: initiative.main_activities?.length || 0,
                      });
                      return (
                        <tr key={initiative.id}>
                          {initIndex === 0 ? (
                            <td rowSpan={objective.initiatives.length} className="px-6 py-4 align-top">
                              <div>
                                <p className="font-medium">{objective.title}</p>
                                {objective.effective_weight && (
                                  <p className="text-sm text-gray-500">Weight: {objective.effective_weight}%</p>
                                )}
                              </div>
                            </td>
                          ) : null}
                          <td className="px-6 py-4">
                            <p className="font-medium">{initiative.name || 'Unnamed Initiative'}</p>
                          </td>
                          <td className="px-6 py-4">
                            {initiative.performance_measures && initiative.performance_measures.length > 0 ? (
                              <ul className="list-disc pl-4">
                                {initiative.performance_measures.map((measure) => (
                                  <li key={measure.id} className="text-sm">{measure.name || 'Unnamed Measure'}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500">No performance measures</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {initiative.main_activities && initiative.main_activities.length > 0 ? (
                              <ul className="list-disc pl-4">
                                {initiative.main_activities.map((activity) => (
                                  <li key={activity.id} className="text-sm">{activity.name || 'Unnamed Activity'}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500">No main activities</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {initiative.main_activities && initiative.main_activities.length > 0 ? (
                              <ul className="list-disc pl-4">
                                {initiative.main_activities.map((activity) =>
                                  activity.sub_activities && activity.sub_activities.length > 0 ? (
                                    activity.sub_activities.map((sub) => (
                                      <li key={sub.id} className="text-sm">{sub.name || 'Unnamed Sub-Activity'}</li>
                                    ))
                                  ) : (
                                    <li key={activity.id} className="text-sm text-gray-500">
                                      No sub-activities for {activity.name || 'Unnamed Activity'}
                                    </li>
                                  )
                                )}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500">No sub-activities</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {initiative.main_activities && initiative.main_activities.length > 0 ? (
                              initiative.main_activities.map((activity) =>
                                activity.budget ? (
                                  <div key={activity.id} className="mb-2">
                                    <p className="text-sm">
                                      {activity.name || 'Unnamed Activity'}: ETB{' '}
                                      {(activity.budget.budget_calculation_type === 'WITH_TOOL'
                                        ? activity.budget.estimated_cost_with_tool
                                        : activity.budget.estimated_cost_without_tool || 0
                                      ).toLocaleString()}
                                    </p>
                                  </div>
                                ) : (
                                  <p key={activity.id} className="text-sm text-gray-500">
                                    No budget for {activity.name || 'Unnamed Activity'}
                                  </p>
                                )
                              )
                            ) : (
                              <p className="text-sm text-gray-500">No budget data</p>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="px-6 py-4">
                        <p className="font-medium">{objective.title}</p>
                      </td>
                      <td className="px-6 py-4" colSpan={5}>
                        <p className="text-sm text-gray-500">No initiatives found for this objective.</p>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

const AdminPlanSummary: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [error, setError] = useState<string | null>(null);

  const { data: planData, isLoading, error: planError } = useQuery({
    queryKey: ['admin-plan-complete', planId],
    queryFn: async () => {
      if (!planId) throw new Error('Plan ID is required');

      console.log('AdminPlanSummary: Starting fetch for plan:', planId);

      try {
        const planResponse = await api.get(`/plans/${planId}/`);
        const plan = planResponse.data;
        console.log('AdminPlanSummary: Raw plan response:', JSON.stringify(planResponse.data, null, 2));

        if (!plan) throw new Error('Plan not found');

        console.log('AdminPlanSummary: Plan fetched:', {
          organization_name: plan.organization_name || plan.organization,
          organization_id: plan.organization,
          selected_objectives_count: plan.selected_objectives?.length || 0,
          selected_objectives: plan.selected_objectives,
        });

        if (!plan.selected_objectives || plan.selected_objectives.length === 0) {
          console.warn('AdminPlanSummary: No selected objectives found');
          return {
            ...plan,
            objectives: [],
            error: 'No selected objectives found in the plan.',
          };
        }

        const objectivesData = await Promise.all(
          plan.selected_objectives.map(async (objId: number) => {
            try {
              console.log(`AdminPlanSummary: Fetching objective ${objId}`);
              const objResp = await api.get(`/strategic-objectives/${objId}/`);
              const objective = objResp.data;
              console.log(`AdminPlanSummary: Raw objective ${objId} response:`, JSON.stringify(objResp.data, null, 2));

              if (!objective) {
                console.warn(`AdminPlanSummary: Objective ${objId} not found`);
                return null;
              }

              console.log(`AdminPlanSummary: Processing objective "${objective.title}"`);

              let allInitiatives: any[] = [];

              try {
                const initiativesResponse = await api.get('/strategic-initiatives/', {
                  params: {
                    strategic_objective: objId,
                    organization: plan.organization,
                  },
                });
                allInitiatives = initiativesResponse.data?.results || initiativesResponse.data || [];
                console.log(`AdminPlanSummary: Found ${allInitiatives.length} organization-specific initiatives for objective ${objId}`, JSON.stringify(allInitiatives, null, 2));

                if (allInitiatives.length === 0) {
                  const defaultInitiativesResponse = await api.get('/strategic-initiatives/', {
                    params: {
                      strategic_objective: objId,
                      is_default: true,
                    },
                  });
                  const defaultInitiatives = defaultInitiativesResponse.data?.results || defaultInitiativesResponse.data || [];
                  const filteredDefaultInitiatives = defaultInitiatives; // Temporarily remove filter for debugging
                  // Original: .filter((init: any) => !init.organization || init.organization === plan.organization);
                  allInitiatives = [...filteredDefaultInitiatives];
                  console.log(`AdminPlanSummary: Found ${filteredDefaultInitiatives.length} default initiatives for objective ${objId}`, JSON.stringify(filteredDefaultInitiatives, null, 2));
                }

                if (allInitiatives.length === 0) {
                  const allInitiativesResponse = await api.get('/strategic-initiatives/', {
                    params: { strategic_objective: objId },
                  });
                  const allInits = allInitiativesResponse.data?.results || allInitiativesResponse.data || [];
                  const filteredInitiatives = allInits; // Temporarily remove filter for debugging
                  // Original: .filter((init: any) => !init.organization || init.organization === plan.organization);
                  allInitiatives = [...filteredInitiatives];
                  console.log(`AdminPlanSummary: Found ${filteredInitiatives.length} total initiatives for objective ${objId}`, JSON.stringify(filteredInitiatives, null, 2));
                }

                if (allInitiatives.length === 0) {
                  const unfilteredResponse = await api.get('/strategic-initiatives/', {
                    params: { strategic_objective: objId },
                  });
                  allInitiatives = unfilteredResponse.data?.results || unfilteredResponse.data || [];
                  console.log(`AdminPlanSummary: Found ${allInitiatives.length} unfiltered initiatives for objective ${objId}`, JSON.stringify(allInitiatives, null, 2));
                }
              } catch (error) {
                console.error(`AdminPlanSummary: Error fetching initiatives for objective ${objId}:`, error);
                if (objective.initiatives && objective.initiatives.length > 0) {
                  const filteredInitiatives = objective.initiatives; // Temporarily remove filter for debugging
                  // Original: .filter((init: any) => !init.organization || init.organization === plan.organization);
                  allInitiatives = filteredInitiatives;
                  console.log(`AdminPlanSummary: Using ${filteredInitiatives.length} initiatives from objective serializer`, JSON.stringify(filteredInitiatives, null, 2));
                }
              }

              const completeInitiatives = await Promise.all(
                allInitiatives.map(async (initiative: any) => {
                  try {
                    let performanceMeasures: any[] = [];
                    try {
                      const measuresResponse = await api.get('/performance-measures/', {
                        params: {
                          initiative: initiative.id,
                          organization: plan.organization,
                        },
                      });
                      performanceMeasures = measuresResponse.data?.results || measuresResponse.data || [];
                      console.log(`AdminPlanSummary: Found ${performanceMeasures.length} performance measures for initiative ${initiative.id}`);

                      if (performanceMeasures.length === 0) {
                        const defaultMeasuresResponse = await api.get('/performance-measures/', {
                          params: {
                            initiative: initiative.id,
                            is_default: true,
                          },
                        });
                        const defaultMeasures = defaultMeasuresResponse.data?.results || defaultMeasuresResponse.data || [];
                        performanceMeasures = [...defaultMeasures];
                        console.log(`AdminPlanSummary: Found ${defaultMeasures.length} default performance measures for initiative ${initiative.id}`);
                      }

                      if (performanceMeasures.length === 0) {
                        const allMeasuresResponse = await api.get('/performance-measures/', {
                          params: { initiative: initiative.id },
                        });
                        const allMeasures = allMeasuresResponse.data?.results || allMeasuresResponse.data || [];
                        performanceMeasures = [...allMeasures];
                        console.log(`AdminPlanSummary: Found ${allMeasures.length} total performance measures for initiative ${initiative.id}`);
                      }
                    } catch (error) {
                      console.error(`AdminPlanSummary: Error fetching performance measures for initiative ${initiative.id}:`, error);
                    }

                    let mainActivities: any[] = [];
                    try {
                      const activitiesResponse = await api.get('/main-activities/', {
                        params: {
                          initiative: initiative.id,
                          organization: plan.organization,
                        },
                      });
                      mainActivities = activitiesResponse.data?.results || activitiesResponse.data || [];
                      console.log(`AdminPlanSummary: Found ${mainActivities.length} main activities for initiative ${initiative.id}`);

                      if (mainActivities.length === 0) {
                        const defaultActivitiesResponse = await api.get('/main-activities/', {
                          params: {
                            initiative: initiative.id,
                            is_default: true,
                          },
                        });
                        const defaultActivities = defaultActivitiesResponse.data?.results || defaultActivitiesResponse.data || [];
                        mainActivities = [...defaultActivities];
                        console.log(`AdminPlanSummary: Found ${defaultActivities.length} default main activities for initiative ${initiative.id}`);
                      }

                      if (mainActivities.length === 0) {
                        const allActivitiesResponse = await api.get('/main-activities/', {
                          params: { initiative: initiative.id },
                        });
                        const allActivities = allActivitiesResponse.data?.results || allActivitiesResponse.data || [];
                        mainActivities = [...allActivities];
                        console.log(`AdminPlanSummary: Found ${allActivities.length} total main activities for initiative ${initiative.id}`);
                      }
                    } catch (error) {
                      console.error(`AdminPlanSummary: Error fetching main activities for initiative ${initiative.id}:`, error);
                    }

                    const activitiesWithSubs = await Promise.all(
                      mainActivities.map(async (activity: any) => {
                        try {
                          let subActivities: any[] = [];
                          try {
                            const subResp = await api.get('/sub-activities/', {
                              params: {
                                main_activity: activity.id,
                                organization: plan.organization,
                              },
                            });
                            subActivities = subResp.data?.results || subResp.data || [];
                            console.log(`AdminPlanSummary: Found ${subActivities.length} sub-activities for activity ${activity.id}`);

                            if (subActivities.length === 0) {
                              const defaultSubsResponse = await api.get('/sub-activities/', {
                                params: {
                                  main_activity: activity.id,
                                  is_default: true,
                                },
                              });
                              const defaultSubs = defaultSubsResponse.data?.results || defaultSubsResponse.data || [];
                              subActivities = [...defaultSubs];
                              console.log(`AdminPlanSummary: Found ${defaultSubs.length} default sub-activities for activity ${activity.id}`);
                            }

                            if (subActivities.length === 0) {
                              const allSubsResponse = await api.get('/sub-activities/', {
                                params: { main_activity: activity.id },
                              });
                              const allSubs = allSubsResponse.data?.results || allSubsResponse.data || [];
                              subActivities = [...allSubs];
                              console.log(`AdminPlanSummary: Found ${allSubs.length} total sub-activities for activity ${activity.id}`);
                            }
                          } catch (error) {
                            console.error(`AdminPlanSummary: Error fetching sub-activities for activity ${activity.id}:`, error);
                          }

                          let budgetData = null;
                          try {
                            if (subActivities.length > 0) {
                              budgetData = {
                                budget_calculation_type: 'WITH_TOOL',
                                estimated_cost_with_tool: subActivities.reduce(
                                  (sum: number, sub: any) => sum + (Number(sub.estimated_cost_with_tool) || 0),
                                  0
                                ),
                                estimated_cost_without_tool: subActivities.reduce(
                                  (sum: number, sub: any) => sum + (Number(sub.estimated_cost_without_tool) || 0),
                                  0
                                ),
                                government_treasury: subActivities.reduce(
                                  (sum: number, sub: any) => sum + (Number(sub.government_treasury) || 0),
                                  0
                                ),
                                sdg_funding: subActivities.reduce(
                                  (sum: number, sub: any) => sum + (Number(sub.sdg_funding) || 0),
                                  0
                                ),
                                partners_funding: subActivities.reduce(
                                  (sum: number, sub: any) => sum + (Number(sub.partners_funding) || 0),
                                  0
                                ),
                                other_funding: subActivities.reduce(
                                  (sum: number, sub: any) => sum + (Number(sub.other_funding) || 0),
                                  0
                                ),
                              };
                            } else {
                              const budgetResponse = await api.get('/activity-budgets/', {
                                params: {
                                  main_activity: activity.id,
                                  organization: plan.organization,
                                },
                              });
                              const budgets = budgetResponse.data?.results || budgetResponse.data || [];
                              if (budgets.length > 0) {
                                budgetData = budgets[0];
                              } else {
                                const defaultBudgetResponse = await api.get('/activity-budgets/', {
                                  params: {
                                    main_activity: activity.id,
                                    is_default: true,
                                  },
                                });
                                const defaultBudgets = defaultBudgetResponse.data?.results || defaultBudgetResponse.data || [];
                                if (defaultBudgets.length > 0) {
                                  budgetData = defaultBudgets[0];
                                } else {
                                  const allBudgetResponse = await api.get('/activity-budgets/', {
                                    params: { main_activity: activity.id },
                                  });
                                  const allBudgets = allBudgetResponse.data?.results || allBudgetResponse.data || [];
                                  if (allBudgets.length > 0) {
                                    budgetData = allBudgets[0];
                                  }
                                }
                              }
                            }
                            console.log(`AdminPlanSummary: Budget data for activity ${activity.id}:`, budgetData);
                          } catch (error) {
                            console.error(`AdminPlanSummary: Error fetching budget for activity ${activity.id}:`, error);
                          }

                          return {
                            ...activity,
                            sub_activities: subActivities,
                            budget: budgetData,
                          };
                        } catch (error) {
                          console.error(`AdminPlanSummary: Error processing activity ${activity.id}:`, error);
                          return {
                            ...activity,
                            sub_activities: [],
                            budget: null,
                          };
                        }
                      })
                    );

                    return {
                      ...initiative,
                      performance_measures: performanceMeasures,
                      main_activities: activitiesWithSubs,
                    };
                  } catch (error) {
                    console.error(`AdminPlanSummary: Error processing initiative ${initiative.id}:`, error);
                    return {
                      ...initiative,
                      performance_measures: [],
                      main_activities: [],
                    };
                  }
                })
              );

              console.log(`AdminPlanSummary: Processed objective ${objId} with ${completeInitiatives.length} initiatives`);

              return {
                ...objective,
                initiatives: completeInitiatives || [],
              };
            } catch (error) {
              console.error(`AdminPlanSummary: Error processing objective ${objId}:`, error);
              return {
                id: objId,
                title: `Objective ${objId} (Failed to Load)`,
                initiatives: [],
              };
            }
          })
        );

        const validObjectives = objectivesData.filter((obj) => obj !== null);
        console.log(`AdminPlanSummary: Assembled ${validObjectives.length} valid objectives`);

        if (plan.selected_objectives_weights) {
          validObjectives.forEach((obj: any) => {
            const weightKey = obj.id?.toString();
            const selectedWeight = plan.selected_objectives_weights[weightKey];
            if (selectedWeight !== undefined) {
              obj.effective_weight = parseFloat(selectedWeight);
              obj.planner_weight = parseFloat(selectedWeight);
            }
          });
        }

        plan.objectives = validObjectives;

        console.log('AdminPlanSummary: Final plan data:', {
          objectives_count: plan.objectives.length,
          initiatives_count: plan.objectives.reduce((sum: number, obj: any) => sum + (obj.initiatives?.length || 0), 0),
        });

        return plan;
      } catch (error) {
        console.error('AdminPlanSummary: Critical error fetching plan:', error);
        throw error;
      }
    },
    enabled: !!planId,
  });

  const plan = planData;

  const calculateStatistics = () => {
    if (!plan?.objectives) {
      return {
        objectivesCount: 0,
        initiativesCount: 0,
        measuresCount: 0,
        activitiesCount: 0,
        subActivitiesCount: 0,
      };
    }

    let objectivesCount = plan.objectives.length;
    let initiativesCount = 0;
    let measuresCount = 0;
    let activitiesCount = 0;
    let subActivitiesCount = 0;

    plan.objectives.forEach((objective: Objective) => {
      if (objective.initiatives) {
        initiativesCount += objective.initiatives.length;
        objective.initiatives.forEach((initiative) => {
          if (initiative.performance_measures) {
            measuresCount += initiative.performance_measures.length;
          }
          if (initiative.main_activities) {
            activitiesCount += initiative.main_activities.length;
            initiative.main_activities.forEach((activity) => {
              if (activity.sub_activities) {
                subActivitiesCount += activity.sub_activities.length;
              }
            });
          }
        });
      }
    });

    return {
      objectivesCount,
      initiativesCount,
      measuresCount,
      activitiesCount,
      subActivitiesCount,
    };
  };

  const statistics = calculateStatistics();

  const calculateBudgetSummary = () => {
    let totalRequired = 0;
    let governmentTreasury = 0;
    let sdgFunding = 0;
    let partnersFunding = 0;
    let otherFunding = 0;

    console.log('AdminPlanSummary: Starting budget calculation for plan:', plan?.id);

    if (!plan?.objectives || plan.objectives.length === 0) {
      console.log('AdminPlanSummary: No objectives found in plan data');
      return {
        totalRequired: 0,
        totalAllocated: 0,
        fundingGap: 0,
        governmentTreasury: 0,
        sdgFunding: 0,
        partnersFunding: 0,
        otherFunding: 0,
      };
    }

    plan.objectives.forEach((objective: Objective) => {
      console.log(`AdminPlanSummary: Processing objective "${objective.title}" with ${objective.initiatives?.length || 0} initiatives`);
      if (!objective.initiatives) return;

      objective.initiatives.forEach((initiative) => {
        if (!initiative) {
          console.log('AdminPlanSummary: Skipping null initiative');
          return;
        }

        console.log(`AdminPlanSummary: Processing initiative "${initiative.name}"`);

        if (initiative.main_activities) {
          console.log(`AdminPlanSummary: Initiative "${initiative.name}" has ${initiative.main_activities.length} main activities`);

          initiative.main_activities.forEach((activity) => {
            console.log(`AdminPlanSummary: Processing activity "${activity.name}"`);

            if (activity.sub_activities && activity.sub_activities.length > 0) {
              console.log(`AdminPlanSummary: Activity "${activity.name}" has ${activity.sub_activities.length} sub-activities`);

              activity.sub_activities.forEach((subActivity) => {
                const cost = subActivity.budget_calculation_type === 'WITH_TOOL'
                  ? Number(subActivity.estimated_cost_with_tool || 0)
                  : Number(subActivity.estimated_cost_without_tool || 0);

                totalRequired += cost;
                governmentTreasury += Number(subActivity.government_treasury || 0);
                sdgFunding += Number(subActivity.sdg_funding || 0);
                partnersFunding += Number(subActivity.partners_funding || 0);
                otherFunding += Number(subActivity.other_funding || 0);

                console.log(`AdminPlanSummary: Sub-activity "${subActivity.name}": Cost=${cost}`);
              });
            } else if (activity.budget) {
              console.log(`AdminPlanSummary: Activity "${activity.name}" has activity-level budget`);

              const cost = activity.budget.budget_calculation_type === 'WITH_TOOL'
                ? Number(activity.budget.estimated_cost_with_tool || 0)
                : Number(activity.budget.estimated_cost_without_tool || 0);

              totalRequired += cost;
              governmentTreasury += Number(activity.budget.government_treasury || 0);
              sdgFunding += Number(activity.budget.sdg_funding || 0);
              partnersFunding += Number(activity.budget.partners_funding || 0);
              otherFunding += Number(activity.budget.other_funding || 0);

              console.log(`AdminPlanSummary: Activity budget for "${activity.name}": Cost=${cost}`);
            } else {
              console.log(`AdminPlanSummary: Activity "${activity.name}" has no budget data`);
            }
          });
        } else {
          console.log(`AdminPlanSummary: Initiative "${initiative.name}" has no main_activities array`);
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
    };

    console.log('AdminPlanSummary: Final budget summary:', summary);
    return summary;
  };

  const budgetSummary = calculateBudgetSummary();

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
        <span>Loading complete plan details...</span>
      </div>
    );
  }

  if (planError || !plan) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Plan</h3>
          <p className="text-red-600 mb-2">{(planError as Error)?.message || 'Plan not found'}</p>
          <button
            onClick={() => navigate('/admin')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (plan.error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Objectives Defined</h3>
          <p className="text-gray-500">{plan.error}</p>
          <button
            onClick={() => navigate('/admin')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <button 
          onClick={() => navigate('/admin')}
          className="flex items-center text-gray-600 hover:text-blue-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Admin Dashboard
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plan Summary (Admin View)</h1>
            <p className="text-gray-600 mt-1">
              Complete plan details and budget breakdown for {plan.organization_name}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Building2 className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Organization</p>
              <p className="font-medium text-gray-900">{plan.organization_name || 'Organization Name Not Available'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <User className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Planner</p>
              <p className="font-medium text-gray-900">{plan.planner_name || 'Planner Name Not Available'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <FileType className="h-8 w-8 text-purple-600 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Plan Type</p>
              <p className="font-medium text-gray-900">{plan.type || 'Plan Type Not Available'}</p>
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

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Plan Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{statistics.objectivesCount}</div>
            <div className="text-sm text-gray-500">Strategic Objectives</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{statistics.initiativesCount}</div>
            <div className="text-sm text-gray-500">Strategic Initiatives</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{statistics.measuresCount}</div>
            <div className="text-sm text-gray-500">Performance Measures</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{statistics.activitiesCount}</div>
            <div className="text-sm text-gray-500">Main Activities</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{statistics.subActivitiesCount}</div>
            <div className="text-sm text-gray-500">Sub Activities</div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-6">
        <h4 className="font-medium text-yellow-800 mb-2">Debug Information (Admin Only)</h4>
        <div className="text-sm text-yellow-700 grid grid-cols-2 gap-4">
          <div>
            <p>Plan ID: {planId}</p>
            <p>Organization: {plan.organization_name} (ID: {plan.organization})</p>
            <p>Selected Objectives: {plan.selected_objectives?.length || 0}</p>
            <p>Selected Objective IDs: {plan.selected_objectives?.join(', ') || 'None'}</p>
          </div>
          <div>
            <p>Processed Objectives: {statistics.objectivesCount}</p>
            <p>Total Initiatives: {statistics.initiativesCount}</p>
            <p>Total Measures: {statistics.measuresCount}</p>
            <p>Total Activities: {statistics.activitiesCount}</p>
            <p>Total Sub-Activities: {statistics.subActivitiesCount}</p>
            <p>Status: {plan.status}</p>
            <p>Fetch Error: {planError ? 'Yes' : 'No'}</p>
          </div>
        </div>
        <div className="mt-3 text-xs text-yellow-600">
          <p>Data Structure:</p>
          {plan.objectives?.map((obj: Objective, idx: number) => (
            <div key={idx} className="ml-4">
              <p>
                • Objective: {obj.title} (ID: {obj.id}, Weight: {obj.effective_weight || 'N/A'}%)
              </p>
              {obj.initiatives?.length > 0 ? (
                obj.initiatives.map((init: Initiative, initIdx: number) => (
                  <div key={initIdx} className="ml-8">
                    <p>
                      - Initiative: {init.name || 'Unnamed'} (ID: {init.id})
                    </p>
                    <p className="ml-12">
                      Measures: {init.performance_measures?.length || 0}
                    </p>
                    {init.performance_measures?.map((measure: PerformanceMeasure, mIdx: number) => (
                      <p key={mIdx} className="ml-16">
                        · {measure.name || 'Unnamed'}
                      </p>
                    ))}
                    <p className="ml-12">
                      Activities: {init.main_activities?.length || 0}
                    </p>
                    {init.main_activities?.map((activity: MainActivity, aIdx: number) => (
                      <div key={aIdx} className="ml-16">
                        <p>· Activity: {activity.name || 'Unnamed'}</p>
                        <p className="ml-4">
                          Sub-Activities: {activity.sub_activities?.length || 0}
                        </p>
                        {activity.sub_activities?.map((sub: SubActivity, sIdx: number) => (
                          <p key={sIdx} className="ml-8">
                            - {sub.name || 'Unnamed'}
                          </p>
                        ))}
                        <p className="ml-4">
                          Budget: {activity.budget ? `ETB ${activity.budget.estimated_cost_with_tool || activity.budget.estimated_cost_without_tool || 0}` : 'N/A'}
                        </p>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <p className="ml-8">No initiatives</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {plan.objectives && plan.objectives.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900">Complete Plan Details (Admin View)</h3>
            <p className="text-sm text-gray-600 mt-1">
              Showing all data for {plan.organization_name} - Admin unrestricted view
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Initiative Count Check: {statistics.initiativesCount} total initiatives loaded
            </p>
          </div>
          <div className="p-6">
            <PlanReviewTable
              objectives={plan.objectives}
              onSubmit={async () => {}}
              isSubmitting={false}
              organizationName={plan.organization_name || 'Organization Name Not Available'}
              plannerName={plan.planner_name || 'Planner Name Not Available'}
              fromDate={plan.from_date || ''}
              toDate={plan.to_date || ''}
              planType={plan.type || 'LEO/EO Plan'}
              isViewOnly={true}
              plannerOrgId={null}
            />
          </div>
        </div>
      ) : (
        <div className="text-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Complete Data</h3>
          <p className="text-gray-500">
            Could not load complete objectives data for this plan. 
            {plan?.selected_objectives?.length > 0 ? 
              ` Found ${plan.selected_objectives.length} selected objectives but failed to load their details.` :
              ' No selected objectives found in the plan.'
            }
          </p>
          <div className="mt-4 text-xs text-gray-400">
            <p>Plan Data Debug:</p>
            <p>• Selected Objectives IDs: {plan?.selected_objectives?.join(', ') || 'None'}</p>
            <p>• Organization: {plan?.organization_name} (ID: {plan?.organization})</p>
            <p>• Plan Status: {plan?.status}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPlanSummary;
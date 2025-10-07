export interface Organization {
  id: number;
  name: string;
  type: 'MINISTER' | 'STATE_MINISTER' | 'CHIEF_EXECUTIVE' | 'LEAD_EXECUTIVE' | 'EXECUTIVE' | 'TEAM_LEAD' | 'DESK';
  parent?: number;
  parentId?: number;
  vision?: string;
  mission?: string;
  core_values?: string[];
  coreValues?: string[];
  created_at?: string;
  updated_at?: string;
}

type OrganizationUserRole = 'ADMIN' | 'PLANNER' | 'EVALUATOR';

export interface OrganizationUser {
  id: number;
  userId: number;
  organizationId: number;
  role: OrganizationUserRole;
  createdAt: string;
  updatedAt: string;
}

export interface InitiativeFeed {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StrategicObjective {
  id: number;
  title: string;
  description: string;
  weight: number;
  planner_weight?: number | null;
  effective_weight?: number;
  is_default?: boolean;
  organization_id?: number;
  programs: Program[];
  initiatives: StrategicInitiative[];
  total_initiatives_weight?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Program {
  id: number;
  name: string;
  description: string;
  is_default?: boolean;
  organization_id?: number;
  strategic_objective_id?: number;
  strategic_objective?: StrategicObjective;
  initiatives: StrategicInitiative[];
  created_at?: string;
  updated_at?: string;
}

export interface StrategicInitiative {
  id: string;
  name: string;
  weight: number;
  is_default?: boolean;
  strategic_objective: string | null;
  program: string | null;
  organization_id?: number;
  organization?: number;
  organization_name?: string;
  performance_measures?: PerformanceMeasure[];
  main_activities?: MainActivity[];
  total_measures_weight?: number;
  total_activities_weight?: number;
  initiative_feed?: string;
  initiative_feed_id?: string;
  initiative_feed_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PerformanceMeasure {
  id: string;
  initiative: string;
  name: string;
  weight: number;
  baseline: string;
  target_type?: string;
  q1_target: number;
  q2_target: number;
  q3_target: number;
  q4_target: number;
  annual_target: number;
  selected_months?: string[];
  selected_quarters?: string[];
  organization?: number;
  organization_id?: number;
  organization_name?: string;
  created_at: string;
  updated_at: string;
}


export interface MainActivity {
  id: string;
  initiative: string;
  name: string;
  weight: number;
  selected_months: string[];
  selected_quarters: string[];
  baseline?: string;
  target_type?: string;
  q1_target: number;
  q2_target: number;
  q3_target: number;
  q4_target: number;
  annual_target: number;
  organization?: number;
  organization_id?: number;
  organization_name?: string;
  created_at?: string;
  updated_at?: string;
}
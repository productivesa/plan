export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface UserOrganization {
  id: number;
  user: number;
  organization: number;
  role: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  userOrganizations: UserOrganization[];
}

export const hasRole = (userOrganizations: UserOrganization[] | undefined, role: string): boolean => {
  if (!userOrganizations) return false;
  return userOrganizations.some(org => org.role === role);
};

export const isAdmin = (userOrganizations: UserOrganization[] | undefined): boolean => {
  return hasRole(userOrganizations, 'ADMIN');
};

export const isPlanner = (userOrganizations: UserOrganization[] | undefined): boolean => {
  return hasRole(userOrganizations, 'PLANNER');
};

export const isEvaluator = (userOrganizations: UserOrganization[] | undefined): boolean => {
  return hasRole(userOrganizations, 'EVALUATOR');
};
export const isTeamDeskPlanner = (userOrganizations: UserOrganization[] | undefined): boolean => {
  return hasRole(userOrganizations, 'TEAM_DESK_PLANNER');
};


export const getUserOrganizationIds = (userOrganizations: UserOrganization[] | undefined): number[] => {
  if (!userOrganizations) return [];
  return userOrganizations.map(org => org.organization);
};
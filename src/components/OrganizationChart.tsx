import React, { useState } from 'react';
import { Users, Building2, UserCircle, ChevronDown, ChevronUp, Activity, Briefcase } from 'lucide-react';
import type { Organization } from '../types/organization';

interface OrganizationChartProps {
  data: Organization[];
}

const getIcon = (type: Organization['type']) => {
  switch (type) {
    case 'MINISTER':
      return <Activity className="w-4 h-4 text-white" />;
    case 'STATE_MINISTER':
      return <UserCircle className="w-4 h-4 text-white" />;
    case 'CHIEF_EXECUTIVE':
      return <Briefcase className="w-4 h-4 text-white" />;
    case 'LEAD_EXECUTIVE':
      return <Building2 className="w-4 h-4 text-white" />;
    case 'EXECUTIVE':
      return <Building2 className="w-4 h-4 text-white" />;
    case 'TEAM_LEAD':
      return <Users className="w-4 h-4 text-white" />;
    case 'DESK':
      return <Users className="w-4 h-4 text-white" />;
    default:
      return <Users className="w-4 h-4 text-white" />;
  }
};

const getNodeColor = (type: Organization['type']) => {
  switch (type) {
    case 'MINISTER':
      return 'bg-green-700';
    case 'STATE_MINISTER':
      return 'bg-green-600';
    case 'CHIEF_EXECUTIVE':
      return 'bg-green-600';
    case 'LEAD_EXECUTIVE':
      return 'bg-green-500';
    case 'EXECUTIVE':
      return 'bg-green-500';
    case 'TEAM_LEAD':
      return 'bg-green-400';
    case 'DESK':
      return 'bg-green-300';
    default:
      return 'bg-gray-500';
  }
};

const OrganizationNode: React.FC<{ org: Organization; level: number }> = ({ org, level }) => {
  const nodeColor = getNodeColor(org.type);
  const sizeClass = level === 0 ? 'w-32' : level === 1 ? 'w-28' : 'w-24';
  const fontSizeClass = level === 0 ? 'text-sm' : 'text-xs';
  
  return (
    <div className="flex flex-col items-center">
      <div className={`${nodeColor} text-white rounded-lg shadow-sm p-2 ${sizeClass} flex flex-col items-center`}>
        <div className="rounded-full bg-white/20 p-1 mb-1">
          {getIcon(org.type)}
        </div>
        <div className={`font-medium text-center ${fontSizeClass} truncate w-full`} title={org.name}>
          {org.name}
        </div>
        <div className="text-xs opacity-80 truncate w-full" title={org.type.replace('_', ' ')}>
          {org.type.replace('_', ' ')}
        </div>
      </div>
    </div>
  );
};

const OrganizationChart: React.FC<OrganizationChartProps> = ({ data }) => {
  // Make sure data is an array
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="text-center p-4 text-gray-500">No organization data available</div>;
  }

  // Group organizations by level
  const rootOrgs = data.filter(org => !org.parent && !org.parentId);
  const stateMinisterOrgs = data.filter(org => 
    (org.parent && rootOrgs.some(root => root.id === org.parent)) || 
    (org.type === 'STATE_MINISTER' || org.type === 'CHIEF_EXECUTIVE')
  );
  const executiveOrgs = data.filter(org => 
    org.type === 'LEAD_EXECUTIVE' || 
    org.type === 'EXECUTIVE' || 
    (org.parent && stateMinisterOrgs.some(sm => sm.id === org.parent))
  );
  const teamOrgs = data.filter(org => 
    org.type === 'TEAM_LEAD' || 
    org.type === 'DESK' ||
    (org.parent && executiveOrgs.some(exec => exec.id === org.parent))
  );

  return (
    <div className="organization-chart p-4 bg-white rounded-lg border border-gray-200 mt-4">
      <h3 className="text-md font-medium text-gray-700 mb-4">Organization Chart</h3>
      <div className="flex flex-col items-center space-y-2">
        {/* Root Level (Minister) */}
        <div className="grid grid-cols-1 gap-4 justify-items-center">
          {rootOrgs.map(org => (
            <OrganizationNode key={org.id} org={org} level={0} />
          ))}
        </div>
        
        {/* Connector Line */}
        {rootOrgs.length > 0 && stateMinisterOrgs.length > 0 && (
          <div className="w-px h-4 bg-gray-300"></div>
        )}
        
        {/* Second Level (State Ministers / Chief Executives) */}
        {stateMinisterOrgs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 justify-items-center">
            {stateMinisterOrgs.map(org => (
              <OrganizationNode key={org.id} org={org} level={1} />
            ))}
          </div>
        )}
        
        {/* Connector Line */}
        {stateMinisterOrgs.length > 0 && executiveOrgs.length > 0 && (
          <div className="w-px h-4 bg-gray-300"></div>
        )}
        
        {/* Third Level (Executives) */}
        {executiveOrgs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 justify-items-center">
            {executiveOrgs.map(org => (
              <OrganizationNode key={org.id} org={org} level={2} />
            ))}
          </div>
        )}
        
        {/* Connector Line */}
        {executiveOrgs.length > 0 && teamOrgs.length > 0 && (
          <div className="w-px h-4 bg-gray-300"></div>
        )}
        
        {/* Fourth Level (Teams/Desks) */}
        {teamOrgs.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 justify-items-center">
            {teamOrgs.map(org => (
              <OrganizationNode key={org.id} org={org} level={3} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationChart;
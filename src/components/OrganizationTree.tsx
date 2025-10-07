import React, { useState } from 'react';
import { Users, Building2, UserCircle, ChevronDown, ChevronRight, Activity, Briefcase } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Organization } from '../types/organization';

interface OrganizationTreeProps {
  data: Organization[];
  onSelectOrganization?: (org: Organization) => void;
  selectedOrgId?: number;
}

const getIcon = (type: Organization['type']) => {
  switch (type) {
    case 'MINISTER':
      return <Activity className="w-6 h-6 text-green-600" />;
    case 'STATE_MINISTER':
      return <UserCircle className="w-6 h-6 text-green-600" />;
    case 'CHIEF_EXECUTIVE':
      return <Briefcase className="w-6 h-6 text-green-600" />;
    case 'LEAD_EXECUTIVE':
      return <Building2 className="w-6 h-6 text-green-600" />;
    case 'EXECUTIVE':
      return <Building2 className="w-6 h-6 text-green-600" />;
    case 'TEAM_LEAD':
      return <Users className="w-6 h-6 text-green-600" />;
    case 'DESK':
      return <Users className="w-6 h-6 text-green-600" />;
    default:
      return <Users className="w-6 h-6 text-green-600" />;
  }
};

const getTypeLabel = (type: Organization['type']) => {
  switch (type) {
    case 'MINISTER':
      return 'Minister';
    case 'STATE_MINISTER':
      return 'State Minister';
    case 'CHIEF_EXECUTIVE':
      return 'Chief Executive Office';
    case 'LEAD_EXECUTIVE':
      return 'Lead Executive';
    case 'EXECUTIVE':
      return 'Executive';
    case 'TEAM_LEAD':
      return 'Team Lead';
    case 'DESK':
      return 'Desk';
    default:
      return type;
  }
};

interface OrganizationNodeProps {
  org: Organization;
  allOrgs: Organization[];
  level: number;
  onSelect?: (org: Organization) => void;
  isSelected?: boolean;
}

const OrganizationNode: React.FC<OrganizationNodeProps> = ({ 
  org, 
  allOrgs, 
  level,
  onSelect,
  isSelected 
}) => {
  const [expanded, setExpanded] = useState(level < 2); // Auto-expand first two levels
  const children = allOrgs.filter((o) => o.parent === org.id || o.parentId === org.id);
  const hasChildren = children.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Always call onSelect, even if the org is already selected
    if (onSelect) {
      onSelect(org);
    }
    
    // Toggle expansion if has children
    if (hasChildren) {
      setExpanded(!expanded);
    }
  };

  return (
    <div className="organization-node">
      <div 
        className={cn(
          "flex items-center p-3 mb-2 rounded-lg transition-all cursor-pointer",
          hasChildren ? "hover:bg-green-50" : "hover:bg-green-50",
          level === 0 ? "bg-green-100 border-2 border-green-500" : "bg-white border border-gray-200 shadow-sm",
          isSelected ? "ring-2 ring-green-500" : ""
        )}
        onClick={handleClick}
      >
        <div className="flex-shrink-0 mr-3">
          {hasChildren && (
            <div className="w-5 h-5 flex items-center justify-center text-gray-500">
              {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 mr-3">
          {getIcon(org.type)}
        </div>
        <div className="flex-grow">
          <div className="font-medium text-gray-900">{org.name}</div>
          <div className="text-xs text-gray-500">{getTypeLabel(org.type)}</div>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className={cn(
          "pl-8 ml-6 border-l-2 border-green-200",
          level === 0 ? "ml-8" : ""
        )}>
          {children.map((child) => (
            <OrganizationNode
              key={child.id}
              org={child}
              allOrgs={allOrgs}
              level={level + 1}
              onSelect={onSelect}
              isSelected={child.id === isSelected}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const OrganizationTree: React.FC<OrganizationTreeProps> = ({ 
  data,
  onSelectOrganization,
  selectedOrgId 
}) => {
  // Make sure data is an array before filtering
  if (!Array.isArray(data)) {
    console.error('Organization data is not an array:', data);
    return (
      <div className="text-center p-4 text-gray-500">Invalid organization data structure</div>
    );
  }
  
  const rootOrgs = data.filter((org) => !org.parent && !org.parentId);

  if (data.length === 0) {
    return <div className="text-center p-4 text-gray-500">No organization data available</div>;
  }

  return (
    <div className="organogram p-4 overflow-auto">
      <div className="organogram-container">
        {rootOrgs.map((org) => (
          <OrganizationNode
            key={org.id}
            org={org}
            allOrgs={data}
            level={0}
            onSelect={onSelectOrganization}
            isSelected={org.id === selectedOrgId}
          />
        ))}
      </div>
    </div>
  );
};

export default OrganizationTree;
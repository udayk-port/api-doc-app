'use client';

import React, { useState, useMemo } from 'react';
import type { ServiceMetadata } from '@/services/portService';

interface SidebarProps {
  services: ServiceMetadata[];
  grouped: Record<string, ServiceMetadata[]>;
  sourceLabels: string[];
  onServiceSelect: (service: ServiceMetadata | null) => void;
  selectedService: ServiceMetadata | null;
}

// Collapsible group component
function SourceGroup({
  label,
  services,
  selectedService,
  onServiceSelect,
  defaultExpanded = true,
  isCollapsed = false,
}: {
  label: string;
  services: ServiceMetadata[];
  selectedService: ServiceMetadata | null;
  onServiceSelect: (service: ServiceMetadata | null) => void;
  defaultExpanded?: boolean;
  isCollapsed?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // In collapsed mode, show only icons/badges
  if (isCollapsed) {
    return (
      <div className="mb-2">
        <div className="flex flex-col items-center gap-1">
          {services.slice(0, 5).map((service) => {
            const isSelected = 
              selectedService?.service.identifier === service.service.identifier &&
              selectedService?.blueprintId === service.blueprintId;
            
            return (
              <button
                key={`${service.blueprintId}-${service.service.identifier}`}
                onClick={() => onServiceSelect(service)}
                title={service.service.title}
                className={`w-10 h-10 rounded-md flex items-center justify-center text-xs font-bold transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {service.service.title.substring(0, 2).toUpperCase()}
              </button>
            );
          })}
          {services.length > 5 && (
            <div className="text-xs text-slate-500 mt-1">+{services.length - 5}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2">
      {/* Group Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 rounded-md bg-slate-800/50 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-sm text-white">{label}</span>
        </div>
        <span className="text-xs text-slate-400">{services.length}</span>
      </button>

      {/* Group Items */}
      {isExpanded && (
        <div className="mt-1 ml-2 pl-2 border-l border-slate-700 space-y-1">
          {services.length === 0 ? (
            <div className="text-xs text-slate-500 py-2 px-2">
              No APIs in this group
            </div>
          ) : (
            services.map((service) => {
              const isSelected = 
                selectedService?.service.identifier === service.service.identifier &&
                selectedService?.blueprintId === service.blueprintId;
              
              return (
                <button
                  key={`${service.blueprintId}-${service.service.identifier}`}
                  onClick={() => onServiceSelect(service)}
                  className={`w-full text-left p-2 rounded-md transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800/30 text-slate-300 hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm truncate flex-1">{service.service.title}</span>
                  </div>
                  <div className={`text-xs mt-0.5 truncate ${
                    isSelected ? 'opacity-75' : 'text-slate-500'
                  }`}>
                    {service.service.identifier}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  services,
  grouped,
  sourceLabels,
  onServiceSelect,
  selectedService,
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter services based on search term across all groups
  const filteredGrouped = useMemo(() => {
    if (!searchTerm.trim()) {
      return grouped;
    }

    const term = searchTerm.toLowerCase();
    const result: Record<string, ServiceMetadata[]> = {};

    for (const [label, groupServices] of Object.entries(grouped)) {
      const filtered = groupServices.filter(service =>
        service.service.title.toLowerCase().includes(term) ||
        service.service.identifier.toLowerCase().includes(term)
      );
      if (filtered.length > 0) {
        result[label] = filtered;
      }
    }

    return result;
  }, [grouped, searchTerm]);

  const filteredLabels = Object.keys(filteredGrouped);
  const totalCount = services.length;

  // Collapsed sidebar view
  if (isCollapsed) {
    return (
      <aside className="w-16 bg-slate-900 border-r border-slate-700 h-full flex flex-col transition-all duration-300">
        {/* Expand Button */}
        <div className="p-2 border-b border-slate-700 flex justify-center">
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 transition-colors"
            title="Expand sidebar"
          >
            <svg
              className="w-5 h-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* API Count Badge */}
        <div className="p-2 flex justify-center">
          <div className="bg-blue-600 text-white text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center" title={`${totalCount} APIs`}>
            {totalCount}
          </div>
        </div>

        {/* Collapsed Groups */}
        <nav className="flex-1 overflow-y-auto p-2 flex flex-col items-center">
          {filteredLabels.map((label, index) => (
            <SourceGroup
              key={label}
              label={label}
              services={filteredGrouped[label]}
              selectedService={selectedService}
              onServiceSelect={onServiceSelect}
              defaultExpanded={index === 0}
              isCollapsed={true}
            />
          ))}
        </nav>
      </aside>
    );
  }

  // Expanded sidebar view
  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-700 h-full flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-white">API Documentation</h2>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 transition-colors"
            title="Collapse sidebar"
          >
            <svg
              className="w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          {sourceLabels.length} source{sourceLabels.length !== 1 ? 's' : ''} · {totalCount} API{totalCount !== 1 ? 's' : ''}
        </p>
        <div className="relative">
          <input
            type="text"
            placeholder="Search all APIs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Source Groups */}
      <nav className="flex-1 overflow-y-auto p-3">
        {filteredLabels.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-sm">No APIs found</p>
            <p className="text-xs mt-1">
              {searchTerm ? 'Try a different search term' : 'Configure OPENAPI_SOURCES to add blueprints'}
            </p>
          </div>
        ) : (
          filteredLabels.map((label, index) => (
            <SourceGroup
              key={label}
              label={label}
              services={filteredGrouped[label]}
              selectedService={selectedService}
              onServiceSelect={onServiceSelect}
              defaultExpanded={index === 0} // First group expanded by default
              isCollapsed={false}
            />
          ))
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <div className="text-xs text-slate-500">
          <p>OpenAPI specs from Port entities</p>
          <p className="mt-1 text-slate-600">
            {sourceLabels.length} blueprint{sourceLabels.length !== 1 ? 's' : ''} configured
          </p>
        </div>
      </div>
    </aside>
  );
}

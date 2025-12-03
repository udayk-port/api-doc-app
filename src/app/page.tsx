'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import ApiDocViewer from '@/components/ApiDocViewer';
import LoadingState from '@/components/LoadingState';
import type { ServiceMetadata, OpenAPISchema } from '@/services/portService';
import type { OpenAPISource } from '@/lib/config';

interface ApiResponse {
  config: {
    sources: OpenAPISource[];
  };
  services: ServiceMetadata[];
  grouped: Record<string, ServiceMetadata[]>;
  sourceLabels: string[];
  count: number;
}

// Extended metadata with loaded schema
interface LoadedService extends ServiceMetadata {
  schema?: OpenAPISchema;
  error?: string;
  isLoading?: boolean;
}

export default function Home() {
  const [services, setServices] = useState<ServiceMetadata[]>([]);
  const [grouped, setGrouped] = useState<Record<string, ServiceMetadata[]>>({});
  const [sourceLabels, setSourceLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selected service with its loaded schema
  const [selectedService, setSelectedService] = useState<ServiceMetadata | null>(null);
  const [loadedSchema, setLoadedSchema] = useState<OpenAPISchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Fetch service metadata on mount (fast - no schemas)
  useEffect(() => {
    fetchServiceMetadata();
  }, []);

  const fetchServiceMetadata = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/port/schemas');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch service metadata: ${response.statusText}`);
      }

      const data: ApiResponse = await response.json();
      setServices(data.services || []);
      setGrouped(data.grouped || {});
      setSourceLabels(data.sourceLabels || []);
    } catch (err) {
      console.error('Error fetching service metadata:', err);
      setError(err instanceof Error ? err.message : 'Failed to load API documentation');
    } finally {
      setLoading(false);
    }
  };

  // Fetch spec on-demand when a service is selected
  const fetchSpec = useCallback(async (service: ServiceMetadata) => {
    setSchemaLoading(true);
    setSchemaError(null);
    setLoadedSchema(null);

    try {
      // If the spec is embedded directly in the entity, use it
      if (service.embeddedSpec) {
        console.log('Using embedded spec for', service.service.title);
        setLoadedSchema(service.embeddedSpec);
        return;
      }
      
      // Otherwise fetch from URL
      if (!service.specUrl) {
        throw new Error('No spec URL or embedded spec available');
      }
      
      const response = await fetch(`/api/port/spec?url=${encodeURIComponent(service.specUrl)}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || `Failed to fetch spec: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Check if spec is too large to render
      if (data.tooLarge || data.error) {
        setSchemaError(data.error || 'Spec is too large to render');
        return;
      }
      
      setLoadedSchema(data.schema);
    } catch (err) {
      console.error('Error fetching spec:', err);
      setSchemaError(err instanceof Error ? err.message : 'Failed to load spec');
    } finally {
      setSchemaLoading(false);
    }
  }, []);

  // Handle service selection
  const handleServiceSelect = useCallback((service: ServiceMetadata | null) => {
    // Clear previous schema when switching
    setLoadedSchema(null);
    setSchemaError(null);
    setSelectedService(service);
    
    if (service) {
      fetchSpec(service);
    }
  }, [fetchSpec]);

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <LoadingState message="Loading API Documentation..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Failed to Load Documentation</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={fetchServiceMetadata}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex">
      {/* Sidebar with grouped data */}
      <Sidebar
        services={services}
        grouped={grouped}
        sourceLabels={sourceLabels}
        onServiceSelect={handleServiceSelect}
        selectedService={selectedService}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <header className="bg-slate-900 border-b border-slate-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">
                {loadedSchema?.info.title || selectedService?.service.title || 'API Documentation'}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {loadedSchema?.info.description || 
                 (selectedService ? `API documentation for ${selectedService.service.title}` : 'Select a service to view its API documentation')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {loadedSchema && (
                <span className="px-3 py-1 bg-blue-600/20 text-blue-400 text-sm rounded-full">
                  v{loadedSchema.info.version}
                </span>
              )}
              <button
                onClick={fetchServiceMetadata}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Refresh"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Service Info with Blueprint context */}
          {selectedService && (
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Blueprint:</span>
                <span className="text-sm text-cyan-400 font-medium">{selectedService.sourceLabel}</span>
              </div>
              {selectedService.specUrl && (
                <>
                  <span className="text-slate-600">|</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Spec:</span>
                    <a
                      href={selectedService.specUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:underline truncate max-w-sm"
                    >
                      {selectedService.specUrl}
                    </a>
                  </div>
                </>
              )}
              {selectedService.embeddedSpec && !selectedService.specUrl && (
                <>
                  <span className="text-slate-600">|</span>
                  <span className="text-sm text-slate-500">Embedded spec</span>
                </>
              )}
            </div>
          )}
        </header>

        {/* API Documentation Viewer */}
        <div className="flex-1 relative overflow-hidden">
          {!selectedService ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center p-8">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Select an API
                </h2>
                <p className="text-slate-400 max-w-md">
                  Choose an API from the sidebar to view its documentation.
                  APIs are organized by blueprint source.
                </p>
              </div>
            </div>
          ) : schemaLoading ? (
            <div className="h-full flex items-center justify-center">
              <LoadingState message={`Loading ${selectedService.service.title}...`} />
            </div>
          ) : schemaError ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Failed to Load Spec
                </h2>
                <p className="text-slate-400 max-w-md mb-4">
                  {schemaError}
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => fetchSpec(selectedService)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Retry
                  </button>
                  {selectedService.specUrl && (
                    <a
                      href={selectedService.specUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      View spec URL →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : loadedSchema ? (
            // Key prop forces Redoc to unmount/remount cleanly when switching APIs
            <ApiDocViewer 
              key={`${selectedService.blueprintId}-${selectedService.service.identifier}`}
              spec={loadedSchema} 
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

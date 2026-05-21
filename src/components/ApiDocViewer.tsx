'use client';

/**
 * API Documentation Viewer Component
 * Wraps Stoplight Elements with custom theming and configuration
 * Provides "Try it out" API Console and code snippets
 * 
 * Note: The React 19 "key prop spread" warning is a known issue with
 * Stoplight Elements internals and doesn't affect functionality.
 * See: https://github.com/stoplightio/elements/issues
 */

import { useEffect, useState, useMemo } from 'react';
// Note: Stoplight Elements uses react-query v3, not @tanstack/react-query v5
import { QueryClient, QueryClientProvider } from 'react-query';
import { useAuth } from '@/context/AuthContext';
import LoadingState, { ErrorState } from './LoadingState';

interface ApiDocViewerProps {
  specUrl?: string;
  spec?: object;
  className?: string;
}

// Type for the Stoplight Elements API component
interface ElementsAPIProps {
  apiDescriptionUrl?: string;
  apiDescriptionDocument?: object | string;
  router?: 'memory' | 'hash' | 'history';
  layout?: 'sidebar' | 'stacked';
  basePath?: string;
  tryItCredentialsPolicy?: 'omit' | 'include' | 'same-origin';
  tryItCorsProxy?: string;
}

// OpenAPI spec type (simplified for our needs)
interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  servers?: Array<{ url: string; description?: string }>;
  [key: string]: unknown;
}

export function ApiDocViewer({ specUrl, spec, className = '' }: ApiDocViewerProps) {
  const [ElementsAPI, setElementsAPI] = useState<React.ComponentType<ElementsAPIProps> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { baseUrl } = useAuth();

  // Create a stable QueryClient instance for React Query v3 (required by Stoplight Elements)
  const queryClient = useMemo(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }), []);

  // Modify the spec to include custom base URL if provided
  const modifiedSpec = useMemo(() => {
    if (!spec || !baseUrl) return spec;

    const specObj = spec as OpenAPISpec;
    
    // Create a new spec with the custom base URL prepended to servers
    return {
      ...specObj,
      servers: [
        { url: baseUrl, description: 'Custom Base URL' },
        ...(specObj.servers || []),
      ],
    };
  }, [spec, baseUrl]);

  useEffect(() => {
    // Dynamically import Stoplight Elements to avoid SSR issues
    const loadElements = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Import API component from Stoplight Elements
        // @ts-expect-error - Stoplight Elements has module resolution issues with TypeScript
        const elementsModule = await import('@stoplight/elements');
        
        // Import styles
        // @ts-ignore - CSS import may not have type declarations
        await import('@stoplight/elements/styles.min.css');
        
        setElementsAPI(() => elementsModule.API);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load Stoplight Elements:', err);
        setError(err instanceof Error ? err.message : 'Failed to load API documentation');
        setIsLoading(false);
      }
    };

    loadElements();
  }, []);

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          setError(null);
          setIsLoading(true);
          window.location.reload();
        }}
      />
    );
  }

  if (isLoading || !ElementsAPI) {
    return <LoadingState message="Loading API documentation..." />;
  }

  if (!specUrl && !spec) {
    return <ErrorState message="No API specification provided" />;
  }

  // Validate specUrl - only use if it's a valid URL
  const validSpecUrl = specUrl && specUrl.startsWith('http') ? specUrl : undefined;

  // Build props for ElementsAPI - prefer embedded spec over URL
  // This avoids the "Invalid URL" error when specUrl is undefined/invalid
  const elementsProps: ElementsAPIProps = {
    router: 'memory',
    layout: 'sidebar',
    tryItCredentialsPolicy: 'same-origin',
    tryItCorsProxy: '/api/proxy',
  };

  // Use embedded spec if available, otherwise use URL
  // When we have a custom base URL, we need to use the modified spec
  if (modifiedSpec) {
    elementsProps.apiDescriptionDocument = JSON.stringify(modifiedSpec);
  } else if (validSpecUrl) {
    elementsProps.apiDescriptionUrl = validSpecUrl;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div 
        className={`elements-container ${className}`}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden', // Let Elements handle its own scrolling
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ElementsAPI {...elementsProps} />
      </div>
    </QueryClientProvider>
  );
}

export default ApiDocViewer;

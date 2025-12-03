/**
 * Application configuration
 * All sensitive values come from environment variables (vault-ready)
 */

/**
 * OpenAPI source configuration
 * Defines a blueprint and property to fetch OpenAPI specs from
 */
export interface OpenAPISource {
  blueprintId: string;
  property: string;
  label?: string; // Display name in sidebar (defaults to blueprintId)
}

/**
 * Parse OPENAPI_SOURCES from environment variable
 * Falls back to legacy single-value env vars for backwards compatibility
 */
function parseOpenAPISources(): OpenAPISource[] {
  const sourcesJson = process.env.OPENAPI_SOURCES;
  
  if (sourcesJson) {
    try {
      const parsed = JSON.parse(sourcesJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((source: Partial<OpenAPISource>) => ({
          blueprintId: source.blueprintId || 'service',
          property: source.property || 'openapi_spec_url',
          label: source.label || source.blueprintId || 'Services',
        }));
      }
    } catch (error) {
      console.error('[Config] Failed to parse OPENAPI_SOURCES JSON:', error);
    }
  }
  
  // Fallback to legacy single-value env vars
  return [{
    blueprintId: process.env.OPENAPI_BLUEPRINT_ID || 'service',
    property: process.env.OPENAPI_SPEC_URL_PROPERTY || 'openapi_spec_url',
    label: process.env.OPENAPI_BLUEPRINT_ID || 'Services',
  }];
}

export const config = {
  // Port API Configuration
  port: {
    clientId: process.env.PORT_CLIENT_ID || '',
    clientSecret: process.env.PORT_CLIENT_SECRET || '',
    apiRegion: process.env.PORT_API_REGION || 'us',
    // Legacy token support
    apiToken: process.env.PORT_API_TOKEN || '',
  },

  // Token rotation settings
  token: {
    // Rotate 30 minutes before expiry (tokens typically last 3 hours)
    rotationIntervalMs: 2.5 * 60 * 60 * 1000, // 2.5 hours
    // Retry settings
    maxRetries: 3,
    retryDelayMs: 1000,
  },

  // OpenAPI spec source configuration
  openapi: {
    // Multiple sources parsed from OPENAPI_SOURCES or legacy env vars
    sources: parseOpenAPISources(),
    // Legacy single-value accessors (for backwards compatibility)
    get blueprintId() {
      return this.sources[0]?.blueprintId || 'service';
    },
    get specUrlProperty() {
      return this.sources[0]?.property || 'openapi_spec_url';
    },
  },

  // Application settings
  app: {
    name: 'Port API Documentation',
    version: '1.0.0',
  },

  // User authentication settings
  auth: {
    // Enable user-provided token authentication (alternative to server .env credentials)
    // Note: Also set NEXT_PUBLIC_ENABLE_USER_AUTH=true for client-side
    enableUserAuth: process.env.ENABLE_USER_AUTH === 'true',
  },
};

/**
 * Get the Port API base URL based on region
 */
export function getPortApiUrl(): string {
  const region = config.port.apiRegion.toLowerCase();
  
  const regionUrls: Record<string, string> = {
    'us': 'https://api.us.port.io',
    'eu': 'https://api.port.io',
    'us-api': 'https://api.us.port.io',
    'eu-api': 'https://api.port.io',
  };

  return regionUrls[region] || regionUrls['us'];
}

/**
 * Get the Port documentation/OpenAPI spec URL
 */
export function getPortDocsUrl(): string {
  const region = config.port.apiRegion.toLowerCase();
  
  // Port's OpenAPI spec is available at /swagger/json
  const baseUrl = region.includes('eu') 
    ? 'https://api.port.io' 
    : 'https://api.us.port.io';
  
  return `${baseUrl}/swagger/json`;
}

/**
 * Validate that required configuration is present
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for either client credentials or API token
  const hasClientCredentials = config.port.clientId && config.port.clientSecret;
  const hasApiToken = config.port.apiToken;

  if (!hasClientCredentials && !hasApiToken) {
    errors.push(
      'Missing authentication: Set PORT_CLIENT_ID and PORT_CLIENT_SECRET, or PORT_API_TOKEN'
    );
  }

  // Validate OpenAPI sources
  if (config.openapi.sources.length === 0) {
    errors.push('No OpenAPI sources configured');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export type Config = typeof config;

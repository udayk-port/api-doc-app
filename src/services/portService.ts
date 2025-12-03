/**
 * Port API Service
 * Handles fetching and processing API schemas from Port
 * Following port-pr-chart pattern
 */

import axios from 'axios';
import { tokenManager } from './tokenManager';
import { getPortApiUrl, getPortDocsUrl, config, OpenAPISource } from '@/lib/config';

interface OpenAPISchema {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  summary?: string;
  description?: string;
}

interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: unknown[];
  requestBody?: unknown;
  responses?: Record<string, unknown>;
}

interface ApiEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  kind: string;
  type: 'REST' | 'GraphQL';
}

interface OrganizedApis {
  byKind: Record<string, ApiEndpoint[]>;
  byType: Record<string, ApiEndpoint[]>;
  byTag: Record<string, ApiEndpoint[]>;
  all: ApiEndpoint[];
}

interface ServiceEntity {
  identifier: string;
  title: string;
  properties: Record<string, string | undefined>;
}

interface ServiceSpec {
  service: {
    identifier: string;
    title: string;
  };
  specUrl: string;
  schema?: OpenAPISchema;
  error?: string;
  blueprintId: string;   // Which blueprint this entity came from
  sourceLabel: string;   // Display label for grouping in UI
}

// Lightweight metadata type - no schema, for initial page load
interface ServiceMetadata {
  service: {
    identifier: string;
    title: string;
  };
  specUrl?: string;           // URL to fetch spec from (if external)
  embeddedSpec?: OpenAPISchema; // Embedded spec object (if stored in Port)
  blueprintId: string;
  sourceLabel: string;
}

// Cache for the schema
let schemaCache: {
  schema: OpenAPISchema | null;
  timestamp: number;
} = {
  schema: null,
  timestamp: 0,
};

// Cache for service specs - keyed by blueprint ID
const serviceSpecsCache: Map<string, {
  specs: ServiceSpec[];
  timestamp: number;
}> = new Map();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch the Port OpenAPI schema (Port's own API)
 */
export async function fetchPortSchema(): Promise<OpenAPISchema> {
  // Check cache
  if (schemaCache.schema && Date.now() - schemaCache.timestamp < CACHE_TTL_MS) {
    console.log('[PortService] Returning cached schema');
    return schemaCache.schema;
  }

  try {
    const docsUrl = getPortDocsUrl();
    console.log(`[PortService] Fetching schema from ${docsUrl}`);

    const response = await axios.get(docsUrl, {
      headers: {
        Accept: 'application/json, application/yaml, text/yaml',
      },
    });

    let schema: OpenAPISchema;

    // Handle response (could be JSON or YAML)
    if (typeof response.data === 'string') {
      // Try JSON first, then YAML
      try {
        schema = JSON.parse(response.data);
      } catch {
        const yaml = await import('yaml');
        schema = yaml.parse(response.data);
      }
    } else {
      schema = response.data;
    }

    // Update cache
    schemaCache = {
      schema,
      timestamp: Date.now(),
    };

    console.log(`[PortService] Schema fetched successfully: ${schema.info?.title || 'Unknown'} v${schema.info?.version || '?'}`);
    return schema;
  } catch (error) {
    console.error('[PortService] Failed to fetch schema:', error);
    throw new Error('Failed to fetch Port API schema');
  }
}

/**
 * Fetch entities from a specific blueprint that have OpenAPI specs
 * @param source - The OpenAPI source configuration
 * @param userToken - Optional user-provided token (overrides server credentials)
 */
export async function fetchEntitiesWithSpecs(source: OpenAPISource, userToken?: string): Promise<ServiceEntity[]> {
  const { blueprintId, property } = source;

  try {
    // Use user-provided token if available, otherwise get from tokenManager
    const token = userToken || await tokenManager.getToken();
    const baseUrl = getPortApiUrl();

    console.log(`[PortService] Fetching entities from blueprint '${blueprintId}' with property '${property}'`);

    // List all entities from the blueprint
    const response = await axios.get(
      `${baseUrl}/v1/blueprints/${blueprintId}/entities`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Filter entities that have the spec URL property
    const entities = response.data.entities || [];
    
    // Debug: log all property names from first entity
    if (entities.length > 0) {
      const allProps = Object.keys(entities[0].properties || {});
      console.log(`[PortService] Available properties on '${blueprintId}': ${allProps.join(', ')}`);
    }
    
    const filtered = entities.filter((entity: ServiceEntity) => 
      entity.properties?.[property]
    );
    
    console.log(`[PortService] Found ${filtered.length} entities with '${property}' out of ${entities.length} total in blueprint '${blueprintId}'`);
    return filtered;
  } catch (error) {
    console.error(`[PortService] Failed to fetch entities from blueprint '${blueprintId}':`, error);
    return [];
  }
}

/**
 * Legacy function: Fetch entities from the first configured source
 * @deprecated Use fetchEntitiesWithSpecs(source) instead
 */
export async function fetchServicesWithSpecs(): Promise<ServiceEntity[]> {
  const source = config.openapi.sources[0];
  if (!source) return [];
  return fetchEntitiesWithSpecs(source);
}

/**
 * Extract spec info from a property value
 * Returns either a URL string or an embedded OpenAPI spec object
 */
type SpecSource = 
  | { type: 'url'; url: string }
  | { type: 'embedded'; spec: OpenAPISchema }
  | null;

function extractSpecSource(value: unknown): SpecSource {
  // Direct URL string
  if (typeof value === 'string') {
    return { type: 'url', url: value };
  }
  
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    
    // Check if it's an embedded OpenAPI spec (has openapi/swagger and paths)
    if (('openapi' in obj || 'swagger' in obj) && 'paths' in obj) {
      console.log(`[PortService] Found embedded OpenAPI spec`);
      return { type: 'embedded', spec: obj as unknown as OpenAPISchema };
    }
    
    // Try common property names for URLs in objects
    for (const key of ['url', 'spec_url', 'specUrl', 'value', 'href']) {
      if (typeof obj[key] === 'string') {
        return { type: 'url', url: obj[key] as string };
      }
    }
    
    console.warn(`[PortService] Could not extract spec from object. Keys: ${Object.keys(obj).join(', ')}`);
  }
  return null;
}

/**
 * Fetch metadata only from a single source (no schema fetching)
 * This is fast because it only lists entities, doesn't fetch their specs
 * @param source - The OpenAPI source configuration
 * @param userToken - Optional user-provided token (overrides server credentials)
 */
export async function fetchMetadataFromSource(source: OpenAPISource, userToken?: string): Promise<ServiceMetadata[]> {
  const { blueprintId, property, label } = source;
  const sourceLabel = label || blueprintId;

  const entities = await fetchEntitiesWithSpecs(source, userToken);
  const results: ServiceMetadata[] = [];
  
  for (const entity of entities) {
    const specSource = extractSpecSource(entity.properties[property]);
    if (!specSource) continue;
    
    const metadata: ServiceMetadata = {
      service: {
        identifier: entity.identifier,
        title: entity.title,
      },
      blueprintId,
      sourceLabel,
    };
    
    if (specSource.type === 'url') {
      metadata.specUrl = specSource.url;
    } else {
      metadata.embeddedSpec = specSource.spec;
    }
    
    results.push(metadata);
  }
  
  return results;
}

/**
 * Fetch metadata from all configured sources (no schema fetching)
 * Much faster than fetchAllSources() - use for initial page load
 * @param userToken - Optional user-provided token (overrides server credentials)
 */
export async function fetchAllMetadata(userToken?: string): Promise<ServiceMetadata[]> {
  const sources = config.openapi.sources;
  console.log(`[PortService] Fetching metadata from ${sources.length} configured source(s)${userToken ? ' (using user token)' : ''}`);

  const allMetadata: ServiceMetadata[] = [];

  for (const source of sources) {
    try {
      const metadata = await fetchMetadataFromSource(source, userToken);
      allMetadata.push(...metadata);
    } catch (error) {
      console.error(`[PortService] Failed to fetch metadata from source '${source.blueprintId}':`, error);
    }
  }

  console.log(`[PortService] Total services found: ${allMetadata.length}`);
  return allMetadata;
}

/**
 * Group metadata by their source label
 */
export function groupMetadataBySource(metadata: ServiceMetadata[]): Record<string, ServiceMetadata[]> {
  const grouped: Record<string, ServiceMetadata[]> = {};
  
  for (const item of metadata) {
    const label = item.sourceLabel;
    if (!grouped[label]) {
      grouped[label] = [];
    }
    grouped[label].push(item);
  }

  return grouped;
}

/**
 * Fetch an OpenAPI spec from a URL
 */
export async function fetchSpecFromUrl(url: string): Promise<OpenAPISchema> {
  const response = await axios.get(url, {
    headers: {
      Accept: 'application/json, application/yaml, text/yaml, */*',
    },
    timeout: 10000,
  });

  let schema: OpenAPISchema;

  if (typeof response.data === 'string') {
    // Try to parse as YAML
    const yaml = await import('yaml');
    schema = yaml.parse(response.data);
  } else {
    schema = response.data;
  }

  return schema;
}

/**
 * Fetch OpenAPI specs from a single source (blueprint)
 */
export async function fetchSpecsFromSource(source: OpenAPISource, refresh = false): Promise<ServiceSpec[]> {
  const { blueprintId, property, label } = source;
  const sourceLabel = label || blueprintId;

  // Check cache
  const cached = serviceSpecsCache.get(blueprintId);
  if (!refresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[PortService] Returning cached specs for blueprint '${blueprintId}'`);
    return cached.specs;
  }

  const entities = await fetchEntitiesWithSpecs(source);
  const specs: ServiceSpec[] = [];

  for (const entity of entities) {
    const specUrl = entity.properties[property];
    if (!specUrl) continue;

    const spec: ServiceSpec = {
      service: {
        identifier: entity.identifier,
        title: entity.title,
      },
      specUrl,
      blueprintId,
      sourceLabel,
    };

    try {
      spec.schema = await fetchSpecFromUrl(specUrl);
      console.log(`[PortService] Fetched spec for ${entity.title} from blueprint '${blueprintId}'`);
    } catch (error) {
      spec.error = error instanceof Error ? error.message : 'Failed to fetch spec';
      console.error(`[PortService] Failed to fetch spec for ${entity.title}:`, error);
    }

    specs.push(spec);
  }

  // Update cache
  serviceSpecsCache.set(blueprintId, {
    specs,
    timestamp: Date.now(),
  });

  return specs;
}

/**
 * Fetch all OpenAPI specs from all configured sources
 */
export async function fetchAllSources(refresh = false): Promise<ServiceSpec[]> {
  const sources = config.openapi.sources;
  console.log(`[PortService] Fetching specs from ${sources.length} configured source(s)`);

  const allSpecs: ServiceSpec[] = [];

  for (const source of sources) {
    try {
      const specs = await fetchSpecsFromSource(source, refresh);
      allSpecs.push(...specs);
    } catch (error) {
      console.error(`[PortService] Failed to fetch specs from source '${source.blueprintId}':`, error);
    }
  }

  console.log(`[PortService] Total specs fetched: ${allSpecs.length}`);
  return allSpecs;
}

/**
 * Legacy function: Fetch all OpenAPI specs from the first configured source
 * @deprecated Use fetchAllSources() instead
 */
export async function fetchServiceSpecs(refresh = false): Promise<ServiceSpec[]> {
  return fetchAllSources(refresh);
}

/**
 * Group specs by their source label
 */
export function groupSpecsBySource(specs: ServiceSpec[]): Record<string, ServiceSpec[]> {
  const grouped: Record<string, ServiceSpec[]> = {};
  
  for (const spec of specs) {
    const label = spec.sourceLabel;
    if (!grouped[label]) {
      grouped[label] = [];
    }
    grouped[label].push(spec);
  }

  return grouped;
}

/**
 * Determine the API kind based on path and tags
 */
function determineApiKind(path: string, tags: string[]): string {
  // Check tags first
  const tagLower = tags.map(t => t.toLowerCase()).join(' ');
  
  if (tagLower.includes('scorecard')) return 'Scorecards';
  if (tagLower.includes('integration')) return 'Integrations';
  if (tagLower.includes('action')) return 'Self-Service Actions';
  if (tagLower.includes('blueprint')) return 'Blueprints';
  if (tagLower.includes('entity') || tagLower.includes('entities')) return 'Entities';
  if (tagLower.includes('auth')) return 'Authentication';
  if (tagLower.includes('webhook')) return 'Webhooks';
  if (tagLower.includes('search')) return 'Search';
  if (tagLower.includes('audit')) return 'Audit Log';
  
  // Check path patterns
  const pathLower = path.toLowerCase();
  
  if (pathLower.includes('/scorecards')) return 'Scorecards';
  if (pathLower.includes('/integrations')) return 'Integrations';
  if (pathLower.includes('/actions')) return 'Self-Service Actions';
  if (pathLower.includes('/blueprints')) return 'Blueprints';
  if (pathLower.includes('/entities')) return 'Entities';
  if (pathLower.includes('/auth')) return 'Authentication';
  if (pathLower.includes('/webhooks')) return 'Webhooks';
  if (pathLower.includes('/search')) return 'Search';
  if (pathLower.includes('/audit')) return 'Audit Log';
  
  return 'Other';
}

/**
 * Parse the schema and organize endpoints by kind and type
 */
export function organizeEndpoints(schema: OpenAPISchema): OrganizedApis {
  const endpoints: ApiEndpoint[] = [];
  const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;

  for (const [path, pathItem] of Object.entries(schema.paths)) {
    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      const tags = operation.tags || ['Untagged'];
      const kind = determineApiKind(path, tags);

      endpoints.push({
        path,
        method: method.toUpperCase(),
        operationId: operation.operationId,
        summary: operation.summary,
        description: operation.description,
        tags,
        kind,
        type: 'REST', // Port API is REST-based
      });
    }
  }

  // Organize by different dimensions
  const byKind: Record<string, ApiEndpoint[]> = {};
  const byType: Record<string, ApiEndpoint[]> = {};
  const byTag: Record<string, ApiEndpoint[]> = {};

  for (const endpoint of endpoints) {
    // By kind
    if (!byKind[endpoint.kind]) {
      byKind[endpoint.kind] = [];
    }
    byKind[endpoint.kind].push(endpoint);

    // By type
    if (!byType[endpoint.type]) {
      byType[endpoint.type] = [];
    }
    byType[endpoint.type].push(endpoint);

    // By tag
    for (const tag of endpoint.tags) {
      if (!byTag[tag]) {
        byTag[tag] = [];
      }
      byTag[tag].push(endpoint);
    }
  }

  return {
    byKind,
    byType,
    byTag,
    all: endpoints,
  };
}

/**
 * Filter schema to only include paths matching certain kinds
 */
export function filterSchemaByKinds(schema: OpenAPISchema, kinds: string[]): OpenAPISchema {
  const organized = organizeEndpoints(schema);
  const allowedPaths = new Set<string>();

  for (const kind of kinds) {
    const endpoints = organized.byKind[kind] || [];
    for (const endpoint of endpoints) {
      allowedPaths.add(endpoint.path);
    }
  }

  const filteredPaths: Record<string, PathItem> = {};
  for (const [path, pathItem] of Object.entries(schema.paths)) {
    if (allowedPaths.has(path)) {
      filteredPaths[path] = pathItem;
    }
  }

  return {
    ...schema,
    paths: filteredPaths,
  };
}

/**
 * Get available API kinds from the schema
 */
export async function getAvailableKinds(): Promise<string[]> {
  const schema = await fetchPortSchema();
  const organized = organizeEndpoints(schema);
  return Object.keys(organized.byKind).sort();
}

/**
 * Get schema statistics
 */
export async function getSchemaStats(): Promise<{
  totalEndpoints: number;
  byKind: Record<string, number>;
  byMethod: Record<string, number>;
  tags: string[];
}> {
  const schema = await fetchPortSchema();
  const organized = organizeEndpoints(schema);

  const byMethod: Record<string, number> = {};
  for (const endpoint of organized.all) {
    byMethod[endpoint.method] = (byMethod[endpoint.method] || 0) + 1;
  }

  const byKind: Record<string, number> = {};
  for (const [kind, endpoints] of Object.entries(organized.byKind)) {
    byKind[kind] = endpoints.length;
  }

  return {
    totalEndpoints: organized.all.length,
    byKind,
    byMethod,
    tags: Object.keys(organized.byTag).sort(),
  };
}

/**
 * Make an authenticated request to Port API
 */
export async function makeAuthenticatedRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    data?: unknown;
    params?: Record<string, string | number>;
  } = {}
): Promise<T> {
  const { method = 'GET', data, params } = options;
  const token = await tokenManager.getToken();
  const baseUrl = getPortApiUrl();

  try {
    const response = await axios({
      method,
      url: `${baseUrl}${endpoint}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data,
      params,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Handle auth errors by refreshing token
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.log('[PortService] Auth error, refreshing token and retrying...');
        await tokenManager.forceRefresh();
        
        const newToken = await tokenManager.getToken();
        const retryResponse = await axios({
          method,
          url: `${baseUrl}${endpoint}`,
          headers: {
            Authorization: `Bearer ${newToken}`,
            'Content-Type': 'application/json',
          },
          data,
          params,
        });

        return retryResponse.data;
      }

      throw new Error(error.response?.data?.message || error.message);
    }
    throw error;
  }
}

/**
 * Clear all schema caches
 */
export function clearSchemaCache(): void {
  schemaCache = {
    schema: null,
    timestamp: 0,
  };
  serviceSpecsCache.clear();
  console.log('[PortService] Schema cache cleared');
}

export type { OpenAPISchema, ApiEndpoint, OrganizedApis, PathItem, Operation, ServiceSpec, ServiceEntity, ServiceMetadata };

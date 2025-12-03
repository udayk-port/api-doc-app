/**
 * API Route: /api/port/spec
 * Fetches a single OpenAPI spec on-demand
 * Used for lazy-loading specs when a service is selected
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchSpecFromUrl } from '@/services/portService';

// Limits to prevent browser crashes from large specs
// Stoplight Elements handles larger specs better than Redoc
const MAX_PATHS = 1000;
const MAX_SIZE_MB = 5; // Max spec size in megabytes

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const specUrl = searchParams.get('url');

  if (!specUrl) {
    return NextResponse.json(
      { error: 'Missing required "url" query parameter' },
      { status: 400 }
    );
  }

  try {
    console.log(`[API] Fetching spec from: ${specUrl}`);
    const schema = await fetchSpecFromUrl(specUrl);
    
    // Check spec size - very large specs can impact performance
    const pathCount = Object.keys(schema.paths || {}).length;
    const specJson = JSON.stringify(schema);
    const sizeMB = specJson.length / (1024 * 1024);
    
    if (pathCount > MAX_PATHS) {
      console.warn(`[API] Spec has too many paths: ${pathCount} (max ${MAX_PATHS})`);
      return NextResponse.json({
        schema: null,
        specUrl,
        info: schema.info,
        error: `Spec is too large to render (${pathCount} endpoints). Maximum supported: ${MAX_PATHS}`,
        tooLarge: true,
        pathCount,
        sizeMB: Math.round(sizeMB * 100) / 100,
      });
    }
    
    if (sizeMB > MAX_SIZE_MB) {
      console.warn(`[API] Spec too large: ${sizeMB.toFixed(2)}MB (max ${MAX_SIZE_MB}MB)`);
      return NextResponse.json({
        schema: null,
        specUrl,
        info: schema.info,
        error: `Spec is too large to render (${sizeMB.toFixed(1)}MB). Maximum supported: ${MAX_SIZE_MB}MB`,
        tooLarge: true,
        pathCount,
        sizeMB: Math.round(sizeMB * 100) / 100,
      });
    }
    
    console.log(`[API] Spec loaded: ${schema.info?.title} (${pathCount} paths, ${sizeMB.toFixed(2)}MB)`);
    
    return NextResponse.json({
      schema,
      specUrl,
      info: schema.info,
      pathCount,
      sizeMB: Math.round(sizeMB * 100) / 100,
    });
  } catch (error) {
    console.error(`[API] Error fetching spec from ${specUrl}:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to fetch OpenAPI spec',
        details: errorMessage,
        specUrl,
      },
      { status: 500 }
    );
  }
}

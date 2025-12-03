/**
 * API Route: /api/port/schemas
 * Returns service metadata only (no full schemas) for fast initial load
 * Schemas are fetched on-demand via /api/port/spec
 */

import { NextResponse } from 'next/server';
import { fetchAllMetadata, groupMetadataBySource, type ServiceMetadata } from '@/services/portService';
import { config } from '@/lib/config';

export async function GET() {
  try {
    // Fetch metadata only (no schemas) - this is fast
    const allMetadata = await fetchAllMetadata();
    
    // Group by source label for organized display
    const grouped = groupMetadataBySource(allMetadata);
    
    return NextResponse.json({
      // Current configuration (all sources)
      config: {
        sources: config.openapi.sources,
      },
      // Service metadata (no schemas - they're fetched on-demand)
      services: allMetadata,
      // Grouped by source label
      grouped,
      // Stats
      count: allMetadata.length,
      // Source labels for easy iteration
      sourceLabels: Object.keys(grouped),
    });
  } catch (error) {
    console.error('[API] Error fetching service metadata:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to fetch service API metadata',
        details: errorMessage,
        config: {
          sources: config.openapi.sources,
        },
      },
      { status: 500 }
    );
  }
}

// POST endpoint for refreshing cache
export async function POST() {
  try {
    // Note: metadata fetching doesn't use the spec cache, so this just re-fetches
    const allMetadata = await fetchAllMetadata();
    const grouped = groupMetadataBySource(allMetadata);
    
    return NextResponse.json({
      message: 'Metadata refreshed successfully',
      config: {
        sources: config.openapi.sources,
      },
      services: allMetadata,
      grouped,
      count: allMetadata.length,
      sourceLabels: Object.keys(grouped),
    });
  } catch (error) {
    console.error('[API] Error refreshing metadata:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to refresh metadata',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

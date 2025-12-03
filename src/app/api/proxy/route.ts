import { NextRequest, NextResponse } from 'next/server';

/**
 * CORS Proxy for Stoplight Elements "Try it out" feature
 * 
 * This proxy forwards API requests to external endpoints that may have CORS restrictions.
 * It's used by the "Try it out" console in Stoplight Elements to test API endpoints.
 */

// Maximum request body size (5MB)
const MAX_BODY_SIZE = 5 * 1024 * 1024;

// Allowed HTTP methods
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

// Headers that should not be forwarded
const EXCLUDED_REQUEST_HEADERS = [
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
  'upgrade',
  'proxy-connection',
];

// Headers that should not be returned to client
const EXCLUDED_RESPONSE_HEADERS = [
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
];

export async function GET(request: NextRequest) {
  return handleProxy(request);
}

export async function POST(request: NextRequest) {
  return handleProxy(request);
}

export async function PUT(request: NextRequest) {
  return handleProxy(request);
}

export async function PATCH(request: NextRequest) {
  return handleProxy(request);
}

export async function DELETE(request: NextRequest) {
  return handleProxy(request);
}

export async function OPTIONS(request: NextRequest) {
  // Handle CORS preflight
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
}

async function handleProxy(request: NextRequest): Promise<NextResponse> {
  try {
    // Get the target URL from query parameter
    const targetUrl = request.nextUrl.searchParams.get('url');
    
    if (!targetUrl) {
      return NextResponse.json(
        { error: 'Missing required "url" query parameter' },
        { status: 400 }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL provided' },
        { status: 400 }
      );
    }

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: 'Only HTTP and HTTPS protocols are allowed' },
        { status: 400 }
      );
    }

    // Build request headers
    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (!EXCLUDED_REQUEST_HEADERS.includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }

    // Set the Host header to the target
    headers.set('Host', parsedUrl.host);

    // Get request body for methods that support it
    let body: ReadableStream<Uint8Array> | null = null;
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      body = request.body;
    }

    // Make the proxied request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'follow',
    });

    // Build response headers
    const responseHeaders = new Headers();
    for (const [key, value] of response.headers.entries()) {
      if (!EXCLUDED_RESPONSE_HEADERS.includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    }

    // Add CORS headers
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    // Return the proxied response
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[Proxy] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Proxy request failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 502,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
}


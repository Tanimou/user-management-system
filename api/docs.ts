import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

/**
 * Swagger UI HTML template for API documentation
 */
const SWAGGER_UI_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Management API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css" />
    <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5.10.3/favicon-32x32.png" sizes="32x32" />
    <style>
      html {
        box-sizing: border-box;
        overflow: -moz-scrollbars-vertical;
        overflow-y: scroll;
      }

      *, *:before, *:after {
        box-sizing: inherit;
      }

      body {
        margin:0;
        background: #fafafa;
      }

      .swagger-ui .topbar {
        display: none;
      }
      
      .swagger-ui .info {
        margin: 50px 0;
      }
      
      .swagger-ui .info .title {
        color: #3b82f6;
      }
      
      .swagger-ui .scheme-container {
        background: #fff;
        box-shadow: 0 1px 2px 0 rgba(0,0,0,0.1);
      }
    </style>
  </head>

  <body>
    <div id="swagger-ui"></div>

    <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = function() {
        // Begin Swagger UI call region
        const ui = SwaggerUIBundle({
          url: '/api/docs/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          plugins: [
            SwaggerUIBundle.plugins.DownloadUrl
          ],
          layout: "StandaloneLayout",
          persistAuthorization: true,
          displayRequestDuration: true,
          filter: true,
          tryItOutEnabled: true,
          requestInterceptor: function(request) {
            // Add custom headers if needed
            return request;
          },
          responseInterceptor: function(response) {
            // Handle responses if needed
            return response;
          },
          onComplete: function() {
            console.log('Swagger UI loaded successfully');
          }
        });
        // End Swagger UI call region

        window.ui = ui;
      };
    </script>
  </body>
</html>`;

/**
 * API Documentation endpoint
 * 
 * Serves Swagger UI for interactive API documentation.
 * Also provides the OpenAPI specification in JSON format.
 * 
 * @param req - Vercel request object
 * @param res - Vercel response object
 * 
 * Routes:
 * - GET /api/docs - Swagger UI HTML interface
 * - GET /api/docs/openapi.json - OpenAPI specification in JSON format
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS for documentation endpoints
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if requesting OpenAPI spec in JSON format
    if (req.url?.endsWith('/openapi.json') || req.query.format === 'json') {
      const yamlPath = join(process.cwd(), 'api', 'openapi.yml');
      const yamlContent = readFileSync(yamlPath, 'utf8');
      const openApiSpec = yaml.load(yamlContent);
      
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json(openApiSpec);
    }

    // Serve Swagger UI HTML
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(SWAGGER_UI_HTML);

  } catch (error) {
    console.error('Documentation endpoint error:', error);
    
    // Return a simple error page
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>API Documentation Error</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .error { color: #d32f2f; background: #ffebee; padding: 16px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>API Documentation Error</h1>
          <div class="error">
            <p>Unable to load API documentation. This may be due to:</p>
            <ul>
              <li>Missing OpenAPI specification file</li>
              <li>Invalid YAML format in specification</li>
              <li>File system access issues</li>
            </ul>
            <p>Please contact the development team for assistance.</p>
          </div>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(errorHtml);
  }
}
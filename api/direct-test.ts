import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[Direct Test] ${req.method} ${req.url}`);
  
  return res.status(200).json({
    message: 'Direct API handler working',
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    cwd: process.cwd(),
    nodeVersion: process.version
  });
}
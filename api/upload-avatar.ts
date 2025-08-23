import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import formidable from 'formidable';
import { readFile } from 'fs/promises';
import {
  withAuth,
  withCORS,
  withErrorHandling,
  type AuthenticatedRequest,
} from './lib/middleware/index.js';
import prisma, { USER_SELECT_FIELDS } from './lib/prisma.js';

// Allowed image types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Parse multipart/form-data
async function parseFormData(req: VercelRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: MAX_FILE_SIZE,
      maxFiles: 1,
    });

    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
}

// Upload handler
const uploadHandler = withCORS(
  withErrorHandling(
    withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
      await handleUpload(req, res);
    })
  )
);

export default async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    await uploadHandler(req, res);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleUpload(req: AuthenticatedRequest, res: VercelResponse) {
  try {
    const userId = req.user.id;
    
    // Parse multipart form data
    const { files } = await parseFormData(req);
    
    // Get the uploaded file
    const uploadedFile = Array.isArray(files.avatar) ? files.avatar[0] : files.avatar;
    
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(uploadedFile.mimetype || '')) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' 
      });
    }

    // Validate file size
    if (uploadedFile.size > MAX_FILE_SIZE) {
      return res.status(400).json({ 
        error: `File size too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` 
      });
    }

    // Read file content
    const fileContent = await readFile(uploadedFile.filepath);
    
    // Generate unique filename
    const fileExtension = uploadedFile.originalFilename?.split('.').pop() || 'jpg';
    const fileName = `avatars/${userId}-${Date.now()}.${fileExtension}`;
    
    // Upload to Vercel Blob
    const blob = await put(fileName, fileContent, {
      access: 'public',
    });

    // Update user's avatarUrl in database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        avatarUrl: blob.url,
        updatedAt: new Date()
      },
      select: USER_SELECT_FIELDS,
    });

    return res.status(200).json({
      message: 'Avatar uploaded successfully',
      data: {
        user: updatedUser,
        avatarUrl: blob.url,
      },
    });

  } catch (error) {
    console.error('Avatar upload error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('maxFileSize')) {
        return res.status(400).json({ error: 'File size too large' });
      }
      if (error.message.includes('maxFiles')) {
        return res.status(400).json({ error: 'Too many files uploaded' });
      }
    }
    
    return res.status(500).json({ error: 'Failed to upload avatar' });
  }
}
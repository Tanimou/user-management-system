import { hashPassword } from '../lib/auth.js';
import { validateBody, withAuth, withCORS, withErrorHandling, } from '../lib/middleware/index.js';
import prisma, { USER_SELECT_FIELDS } from '../lib/prisma.js';
import { updateUserSchema } from '../lib/schemas/user.js';
// GET /api/me - Get current user profile
const getProfileHandler = withCORS(withErrorHandling(withAuth(async (req, res) => {
    await handleGetProfile(req, res);
})));
// PUT /api/me - Update current user profile
const updateProfileHandler = withCORS(withErrorHandling(withAuth(validateBody(updateUserSchema.fork(['email', 'roles', 'isActive'], schema => schema.forbidden()))(async (req, res) => {
    await handleUpdateProfile(req, res);
}))));
export default async function handler(req, res) {
    if (req.method === 'GET') {
        await getProfileHandler(req, res);
    }
    else if (req.method === 'PUT') {
        await updateProfileHandler(req, res);
    }
    else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}
async function handleGetProfile(req, res) {
    const userId = req.user.id;
    console.log(`[me-debug] Fetching user id=${userId}`);
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: USER_SELECT_FIELDS,
    });
    console.log(`[me-debug] Found user:`, JSON.stringify(user, null, 2));
    if (!user || !user.isActive) {
        return res.status(404).json({ error: 'User not found or inactive' });
    }
    return res.status(200).json({ data: user });
}
async function handleUpdateProfile(req, res) {
    // Body is already validated by middleware
    const userId = req.user.id;
    const { name, password, avatarUrl } = req.body;
    // Build update data (only name, password, and avatarUrl allowed for self-updates)
    const updateData = { updatedAt: new Date() };
    if (name !== undefined) {
        updateData.name = name;
    }
    if (password !== undefined) {
        updateData.password = await hashPassword(password);
    }
    if (avatarUrl !== undefined) {
        updateData.avatarUrl = avatarUrl;
    }
    // If no valid updates provided
    if (Object.keys(updateData).length === 1) {
        // Only updatedAt
        return res.status(400).json({ error: 'No valid fields to update' });
    }
    // Update user profile
    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: USER_SELECT_FIELDS,
    });
    return res.status(200).json({
        message: 'Profile updated successfully',
        data: updatedUser,
    });
}

/**
 * Script to update admin user password
 * Updates the admin@example.com user password using the database directly
 */

import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { validatePasswordPolicy } from '../lib/validation.js';

const prisma = new PrismaClient();

async function updateAdminPassword() {
  console.log('🔐 Updating admin password...');

  try {
    // Define the new secure password that meets all policy requirements
    const newPassword = 'AdminSecure2024!@#';
    
    console.log('🔍 Validating new password policy...');
    
    // Validate password meets policy requirements
    const validation = validatePasswordPolicy(newPassword);
    if (!validation.isValid) {
      console.error('❌ Password does not meet policy requirements.');
      // For security, individual policy requirements are not logged.
      process.exit(1);
    }

    console.log('✅ Password validation passed');
    
    // Check if admin user exists
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@example.com' },
      select: { id: true, name: true, email: true, roles: true, isActive: true }
    });

    if (!adminUser) {
      console.error('❌ Admin user with email admin@example.com not found');
      process.exit(1);
    }

    if (!adminUser.isActive) {
      console.error('❌ Admin user is inactive');
      process.exit(1);
    }

    console.log(`📧 Found admin user: ${adminUser.name} (${adminUser.email})`);
    console.log(`🔑 Roles: ${adminUser.roles.join(', ')}`);

    // Hash the new password using the same settings as the app
    console.log('🔒 Hashing new password...');
    const hashedPassword = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 65536 KB
      timeCost: 3,
      parallelism: 1,
    });

    // Update the user's password
    console.log('💾 Updating password in database...');
    const updatedUser = await prisma.user.update({
      where: { id: adminUser.id },
      data: { 
        password: hashedPassword,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
        isActive: true,
        updatedAt: true
      }
    });

    console.log('✅ Password updated successfully!');
    console.log('');
    console.log('🎉 Admin password update completed:');
    console.log(`📧 Email: ${updatedUser.email}`);
    console.log(`👤 Name: ${updatedUser.name}`);
    console.log(`🔑 New Password: ${newPassword}`);
    console.log(`⏰ Updated At: ${updatedUser.updatedAt}`);
    console.log('');
    console.log('🚨 IMPORTANT: Please save this password securely and change it after first login!');

    // Create audit log entry for this change
    try {
      await prisma.auditLog.create({
        data: {
          actorId: adminUser.id, // Self-update
          action: 'PASSWORD_UPDATE',
          entity: 'User',
          entityId: adminUser.id,
          payload: {
            updatedBy: 'system-script',
            userEmail: adminUser.email,
            timestamp: new Date().toISOString(),
            reason: 'Admin password update via script'
          }
        }
      });
      console.log('📝 Audit log entry created');
    } catch (auditError) {
      console.warn('⚠️  Could not create audit log (non-critical):', auditError);
    }

  } catch (error) {
    console.error('❌ Error updating admin password:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the script
console.log('🚀 Starting admin password update script...');
console.log('');

updateAdminPassword()
  .then(() => {
    console.log('');
    console.log('✨ Script completed successfully!');
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
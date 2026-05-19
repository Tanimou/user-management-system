/**
 * Script to test admin password update via API
 * This demonstrates how to update a user's password using the API endpoints
 */

const API_BASE_URL = 'http://localhost:3004/api';

interface LoginResponse {
  token: string;
  expiresIn: number;
  user: {
    id: number;
    name: string;
    email: string;
    roles: string[];
    isActive: boolean;
  };
}

interface UsersResponse {
  data: any[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
  };
}

interface ProfileUpdateResponse {
  message: string;
  data: any;
}

async function testAdminPasswordUpdate() {
  console.log('🧪 Testing admin password update via API...');
  console.log('');

  try {
    // Step 1: Login with the old credentials first to verify they work
    console.log('🔑 Step 1: Testing login with OLD password...');
    
    const oldLoginResponse = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'password123' // Old password
      }),
    });

    if (oldLoginResponse.ok) {
      console.log('❌ ERROR: Old password still works! The update may have failed.');
      const oldLoginData = await oldLoginResponse.json() as LoginResponse;
      console.log(`   Logged in as: ${oldLoginData.user.name} (${oldLoginData.user.email})`);
      return;
    } else {
      console.log('✅ Good: Old password no longer works (as expected)');
    }

    // Step 2: Login with the new password
    console.log('🔑 Step 2: Testing login with NEW password...');
    
    const loginResponse = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'AdminSecure2024!@#' // New password from the script
      }),
    });

    if (!loginResponse.ok) {
      const errorData = await loginResponse.json();
      console.error('❌ Failed to login with new password:', errorData);
      return;
    }

    const loginData = await loginResponse.json() as LoginResponse;
    console.log('✅ Login successful with new password!');
    console.log(`   User: ${loginData.user.name} (${loginData.user.email})`);
    console.log(`   Roles: ${loginData.user.roles.join(', ')}`);
    console.log(`   Token expires in: ${loginData.expiresIn} seconds`);

    // Step 3: Test admin functionality by listing users
    console.log('');
    console.log('👥 Step 3: Testing admin functionality - listing users...');
    
    const usersResponse = await fetch(`${API_BASE_URL}/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!usersResponse.ok) {
      const errorData = await usersResponse.json();
      console.error('❌ Failed to fetch users:', errorData);
      return;
    }

    const usersData = await usersResponse.json() as UsersResponse;
    console.log('✅ Admin can successfully fetch users!');
    console.log(`   Total users: ${usersData.pagination.total}`);
    console.log(`   Users on page: ${usersData.data.length}`);

    // Step 4: Test another password update via the API (optional)
    console.log('');
    console.log('🔄 Step 4: Testing password update via /me API endpoint...');
    
    const newTestPassword = 'AdminSecure2024!@#Updated';
    const profileUpdateResponse = await fetch(`${API_BASE_URL}/me`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        password: newTestPassword
      }),
    });

    if (!profileUpdateResponse.ok) {
      const errorData = await profileUpdateResponse.json();
      console.error('❌ Failed to update password via API:', errorData);
      return;
    }

    const profileData = await profileUpdateResponse.json() as ProfileUpdateResponse;
    console.log('✅ Password updated successfully via API!');
    console.log(`   Message: ${profileData.message}`);

    // Step 5: Test login with the newest password
    console.log('');
    console.log('🔑 Step 5: Testing login with the NEWEST password...');
    
    const finalLoginResponse = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: newTestPassword
      }),
    });

    if (!finalLoginResponse.ok) {
      const errorData = await finalLoginResponse.json();
      console.error('❌ Failed to login with newest password:', errorData);
      return;
    }

    console.log('✅ Login successful with newest password!');
    
    console.log('');
    console.log('🎉 All tests passed! Admin password update functionality is working correctly.');
    console.log('');
    console.log('📝 Summary:');
    console.log('  ✅ Old password no longer works');
    console.log('  ✅ New password works for login');
    console.log('  ✅ Admin functionality is preserved');
    console.log('  ✅ API password update works');
    console.log('  ✅ Updated password works for login');
    
  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

// Execute the test
console.log('🚀 Starting API password update test...');
console.log('⚠️  Note: Make sure the API server is running on localhost:3004');
console.log('');

testAdminPasswordUpdate()
  .then(() => {
    console.log('');
    console.log('✨ Test completed!');
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
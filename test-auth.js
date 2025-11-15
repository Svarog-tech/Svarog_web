// Test Supabase Auth Connection
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ccgxtldxeerwacyekzyk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjZ3h0bGR4ZWVyd2FjeWVrenlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTI4NDEsImV4cCI6MjA3ODMyODg0MX0.SY_7cC1op-rR6-4NDdHkAJBL0viYEsbr_rFlkyOdYMk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuth() {
  console.log('🧪 Testing Supabase Auth...\n');

  // Test 1: Check connection
  console.log('1️⃣ Testing connection...');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.log('❌ Session error:', sessionError.message);
  } else {
    console.log('✅ Connection OK');
  }

  // Test 2: Try to sign up
  console.log('\n2️⃣ Testing sign up...');
  const testEmail = `test-${Date.now()}@test.com`;
  const testPassword = 'TestPassword123';

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        first_name: 'Test',
        last_name: 'User'
      }
    }
  });

  if (signUpError) {
    console.log('❌ Sign up error:', signUpError.message);
    console.log('Error details:', JSON.stringify(signUpError, null, 2));
  } else {
    console.log('✅ Sign up successful!');
    console.log('User ID:', signUpData.user?.id);
    console.log('Email:', signUpData.user?.email);
    console.log('Email confirmed:', signUpData.user?.email_confirmed_at ? 'YES' : 'NO');
    console.log('\n⚠️ Check Supabase Dashboard -> Authentication -> Users');
  }
}

testAuth().catch(console.error);

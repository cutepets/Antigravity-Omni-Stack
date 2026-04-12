(async () => {
  try {
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.accessToken;
    console.log('JWT:', Buffer.from(token.split('.')[1], 'base64').toString());

    const petRes = await fetch('http://localhost:3001/api/pets/PET000001', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const text = await petRes.text();
    console.log('Pet fetch status:', petRes.status);
    console.log('Pet fetch response:', text.slice(0, 150));
  } catch (err) {
    console.error(err);
  }
})();

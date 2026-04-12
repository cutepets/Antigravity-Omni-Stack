const axios = require('axios');

(async () => {
  try {
    const res = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin_password'
    });
    console.log('Login success');
    const token = res.data.accessToken;

    const petRes = await axios.get('http://localhost:3001/api/pets/PET000031', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Pet fetch success:', JSON.stringify(petRes.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.log('Error:', err.response.status, err.response.data);
    } else {
      console.log('Error:', err.message);
    }
  }
})();

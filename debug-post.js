const http = require('http');

async function test() {
    const creds = { email: "debug_user@example.com", password: "StrongPassword123!", fullName: "Debug" };
    let req = await fetch('http://localhost:5000/auth/register', { method: 'POST', body: JSON.stringify(creds), headers: { 'Content-Type': 'application/json' } });

    req = await fetch('http://localhost:5000/auth/login', { method: 'POST', body: JSON.stringify({ email: creds.email, password: creds.password }), headers: { 'Content-Type': 'application/json' } });
    let loginData = await req.json();
    let token = loginData.accessToken;

    let res = await fetch('http://localhost:5000/projects', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: "Proj", key: "PRJ", description: "Desc" })
    });
    console.log(res.status, await res.text());
}
test();

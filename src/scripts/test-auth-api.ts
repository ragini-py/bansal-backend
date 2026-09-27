async function testApi() {
  console.log("Checking /api/health...");
  const healthRes = await fetch("http://localhost:4000/api/health");
  console.log("Health:", await healthRes.json());

  console.log("\nChecking /api/ready...");
  const readyRes = await fetch("http://localhost:4000/api/ready");
  console.log("Ready:", await readyRes.json());

  console.log("\nTesting Admin Login API...");
  const adminRes = await fetch("http://localhost:4000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "bansalnxindia@gmail.com", password: "Admin@12345" }),
  });
  const adminData = await adminRes.json();
  console.log("Admin login status:", adminRes.status);
  console.log("Admin user:", adminData.user);

  console.log("\nTesting User Login API...");
  const userRes = await fetch("http://localhost:4000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "user@bansalnx.com", password: "User@12345" }),
  });
  const userData = await userRes.json();
  console.log("User login status:", userRes.status);
  console.log("User user:", userData.user);
}

testApi()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("API test error:", err);
    process.exit(1);
  });

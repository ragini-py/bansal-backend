import "dotenv/config";
import { connectDb, disconnectDb } from "../db/connect.js";
import { User } from "../modules/auth/models/user.model.js";
import { hashPassword } from "../utils/password.js";

export const SEEDED_ACCOUNTS = {
  admin: {
    email: "bansalnxindia@gmail.com",
    password: "Admin@12345",
    firstName: "Bansal",
    lastName: "Admin",
    phone: "+91 98765 43210",
    role: "admin" as const,
    status: "active" as const,
  },
  user: {
    email: "user@bansalnx.com",
    password: "User@12345",
    firstName: "Priya",
    lastName: "Sharma",
    phone: "+91 98765 12345",
    role: "customer" as const,
    status: "active" as const,
  },
};

async function seedUsers(): Promise<void> {
  await connectDb();
  console.log("Connected to MongoDB for user seeding.");

  for (const [key, account] of Object.entries(SEEDED_ACCOUNTS)) {
    const passwordHash = await hashPassword(account.password);
    const existing = await User.findOne({ email: account.email.toLowerCase() });

    if (existing) {
      existing.passwordHash = passwordHash;
      existing.firstName = account.firstName;
      existing.lastName = account.lastName;
      existing.phone = account.phone;
      existing.role = account.role;
      existing.status = account.status;
      await existing.save();
      console.log(`✓ Updated existing ${key} user: ${account.email}`);
    } else {
      await User.create({
        email: account.email.toLowerCase(),
        passwordHash,
        firstName: account.firstName,
        lastName: account.lastName,
        phone: account.phone,
        role: account.role,
        status: account.status,
      });
      console.log(`✓ Created new ${key} user: ${account.email}`);
    }
  }

  console.log("\nSeeding finished successfully!");
  console.log("-----------------------------------------");
  console.log(`Admin Account: ${SEEDED_ACCOUNTS.admin.email} / ${SEEDED_ACCOUNTS.admin.password}`);
  console.log(`User Account:  ${SEEDED_ACCOUNTS.user.email} / ${SEEDED_ACCOUNTS.user.password}`);
  console.log("-----------------------------------------");

  await disconnectDb();
}

seedUsers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to seed users:", err);
    process.exit(1);
  });

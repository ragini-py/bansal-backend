import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer;
let server: Server;
let base: string;
let disconnectDb: () => Promise<void>;
let adminToken: string;
let customerToken: string;
let seededProductId: string;

function readJson(res: Response): Promise<any> {
  return res.json();
}

const productInput = {
  slug: "test-silk-saree",
  productCode: "BNS-TS-001",
  styleNumber: "BS-001",
  dressName: "Test Silk Saree",
  name: "Test Silk Saree",
  material: "Silk",
  clothMaterial: "Raw Silk",
  price: 10000,
  mrp: 12000,
  discountedPrice: 9000,
  discountPercentage: 10,
  quantity: 15,
  currency: "INR" as const,
  images: ["/products/test.jpg"],
  category: "Sarees",
  collections: ["test-collection"],
  tags: ["silk", "wedding"],
  badge: null,
  shortDescription: "A test saree.",
  description: "A test saree used for e2e coverage.",
  details: ["Test detail"],
  care: ["Dry clean only"],
  sizes: ["Free Size", "M"],
  colours: ["Gold", "Ivory"],
  availableSizes: ["Free Size", "M"],
  colorOptions: ["Gold", "Ivory"],
  additionalComment: "Great for festive occasions.",
  variants: [{ size: "Free Size", colour: "Gold", availability: "available" as const }],
  featured: false,
  bestseller: true,
  newArrival: true,
  published: true,
};

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI = mongod.getUri();
  process.env.CORS_ORIGIN = "http://localhost:5173";
  process.env.JWT_ACCESS_SECRET = "test-secret-test-secret-test-secret-test-secret";
  process.env.APP_URL = "http://localhost:4000";

  const { createApp } = await import("../src/app.js");
  const { connectDb, disconnectDb: disconnect } = await import("../src/db/connect.js");
  disconnectDb = disconnect;

  await connectDb();
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  base = `http://localhost:${port}`;

  const { Product } = await import("../src/modules/catalog/models/index.js");
  const doc = await Product.create(productInput);
  seededProductId = doc._id.toString();

  const { User } = await import("../src/modules/auth/models/index.js");
  const { hashPassword } = await import("../src/utils/password.js");
  await User.create({
    email: "catalog-customer@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Cat",
    lastName: "Customer",
    phone: "9876543210",
  });
  await User.create({
    email: "catalog-admin@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Cat",
    lastName: "Admin",
    phone: "9876543210",
    role: "admin",
  });

  async function login(email: string): Promise<string> {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-1" }),
    });
    const body = await readJson(res);
    return body.accessToken;
  }
  customerToken = await login("catalog-customer@example.com");
  adminToken = await login("catalog-admin@example.com");
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDb();
  await mongod.stop();
});

describe("catalog (against a real MongoDB instance)", () => {
  it("lists products, including unpublished ones (matches existing mock behavior)", async () => {
    const res = await fetch(`${base}/api/products`);
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(body.products));
    assert.ok(body.products.some((p: { slug: string }) => p.slug === "test-silk-saree"));
  });

  it("gets a single product by slug", async () => {
    const res = await fetch(`${base}/api/products/test-silk-saree`);
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.product.name, "Test Silk Saree");
    assert.equal(body.product.variants.length, 1);
    assert.ok(body.product.variants[0].id);
  });

  it("hides unpublished products from the public single-product endpoint", async () => {
    const { Product } = await import("../src/modules/catalog/models/index.js");
    const draft = await Product.create({
      ...productInput,
      slug: "draft-silk-saree",
      name: "Draft Silk Saree",
      published: false,
      variants: [{ size: "Free Size", colour: "Gold", availability: "available" }],
    });

    const res = await fetch(`${base}/api/products/${draft.slug}`);
    assert.equal(res.status, 404);
  });

  it("supports backend search, filter, sort, and pagination across spreadsheet fields", async () => {
    const createRes = await fetch(`${base}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        ...productInput,
        slug: "test-ganesha-ensemble",
        dressName: "Ganesha Ensemble",
        category: "Lehengas",
        material: "Cotton",
        clothMaterial: "Cotton Blend",
        price: 18000,
        mrp: 24000,
        discountedPrice: 15000,
        discountPercentage: 37,
        quantity: 8,
        sizes: ["S", "M", "L"],
        colours: ["Peach", "Cream"],
        availableSizes: ["S", "M", "L"],
        colorOptions: ["Peach", "Cream"],
        tags: ["festive", "cotton"],
        badge: "new",
        bestseller: false,
        newArrival: true,
        published: true,
        collections: ["festive-edit"],
        additionalComment: "Perfect for festive gifting.",
      }),
    });
    assert.equal(createRes.status, 201);

    const searchRes = await fetch(
      `${base}/api/products?search=festive&category=Lehengas&color=Peach&size=M&minPrice=12000&sort=price_asc&page=1&limit=10`,
    );
    const searchBody = await readJson(searchRes);

    assert.equal(searchRes.status, 200);
    assert.equal(searchBody.page, 1);
    assert.equal(searchBody.limit, 10);
    assert.equal(searchBody.total >= 1, true);
    assert.ok(searchBody.products.some((p: { slug: string }) => p.slug === "test-ganesha-ensemble"));

    const filterRes = await fetch(`${base}/api/products?material=Cotton&badge=new&sort=discount_desc`);
    const filterBody = await readJson(filterRes);
    assert.equal(filterRes.status, 200);
    assert.ok(filterBody.products.some((p: { badge: string | null }) => p.badge === "new"));
    assert.ok(filterBody.products[0].discountPercentage >= filterBody.products.at(-1).discountPercentage);
  });

  it("404s for an unknown product slug", async () => {
    const res = await fetch(`${base}/api/products/does-not-exist`);
    assert.equal(res.status, 404);
  });

  it("lists collections", async () => {
    const res = await fetch(`${base}/api/collections`);
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(body.collections));
  });

  it("404s for an unknown collection slug", async () => {
    const res = await fetch(`${base}/api/collections/does-not-exist`);
    assert.equal(res.status, 404);
  });

  it("rejects a product update from an unauthenticated caller", async () => {
    const res = await fetch(`${base}/api/products/${seededProductId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...productInput, price: 11000 }),
    });
    assert.equal(res.status, 401);
  });

  it("rejects a product update from a non-admin customer", async () => {
    const res = await fetch(`${base}/api/products/${seededProductId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ ...productInput, price: 11000 }),
    });
    assert.equal(res.status, 403);
  });

  it("rejects an invalid update body", async () => {
    const res = await fetch(`${base}/api/products/${seededProductId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ ...productInput, price: -5 }),
    });
    assert.equal(res.status, 400);
  });

  it("lets an admin update a product (publish toggle + price edit)", async () => {
    const res = await fetch(`${base}/api/products/${seededProductId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ ...productInput, price: 11000, published: true }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.product.price, 11000);
    assert.equal(body.product.published, true);
  });

  it("404s when updating a product that doesn't exist", async () => {
    const res = await fetch(`${base}/api/products/000000000000000000000000`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(productInput),
    });
    assert.equal(res.status, 404);
  });

  it("rejects product creation from a non-admin customer", async () => {
    const res = await fetch(`${base}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ ...productInput, slug: "another-product" }),
    });
    assert.equal(res.status, 403);
  });

  it("lets an admin create a product", async () => {
    const res = await fetch(`${base}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ ...productInput, slug: "new-test-saree", name: "New Test Saree" }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 201);
    assert.equal(body.product.slug, "new-test-saree");
  });

  it("rejects creating a product with a duplicate slug", async () => {
    const res = await fetch(`${base}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ ...productInput, slug: "new-test-saree" }),
    });
    assert.equal(res.status, 409);
  });

  it("rejects product deletion from a non-admin customer", async () => {
    const res = await fetch(`${base}/api/products/${seededProductId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(res.status, 403);
  });

  it("lets an admin delete a product", async () => {
    const res = await fetch(`${base}/api/products/${seededProductId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 204);

    const getRes = await fetch(`${base}/api/products/test-silk-saree`);
    assert.equal(getRes.status, 404);
  });

  it("404s deleting a product that doesn't exist", async () => {
    const res = await fetch(`${base}/api/products/000000000000000000000000`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 404);
  });
});

const collectionInput = {
  slug: "test-collection",
  name: "Test Collection",
  description: "A test collection.",
  coverImage: "/collections/test.jpg",
  bannerImage: "/collections/test.jpg",
  productIds: [],
  featured: false,
  published: true,
  order: 1,
};

describe("collections admin CRUD (against a real MongoDB instance)", () => {
  let collectionId: string;

  it("rejects collection creation from a non-admin customer", async () => {
    const res = await fetch(`${base}/api/collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify(collectionInput),
    });
    assert.equal(res.status, 403);
  });

  it("lets an admin create a collection", async () => {
    const res = await fetch(`${base}/api/collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(collectionInput),
    });
    const body = await readJson(res);
    assert.equal(res.status, 201);
    assert.equal(body.collection.slug, "test-collection");
    collectionId = body.collection.id;
  });

  it("rejects creating a collection with a duplicate slug", async () => {
    const res = await fetch(`${base}/api/collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(collectionInput),
    });
    assert.equal(res.status, 409);
  });

  it("lets an admin update a collection", async () => {
    const res = await fetch(`${base}/api/collections/${collectionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ ...collectionInput, name: "Renamed Collection" }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.collection.name, "Renamed Collection");
  });

  it("rejects collection deletion from a non-admin customer", async () => {
    const res = await fetch(`${base}/api/collections/${collectionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(res.status, 403);
  });

  it("lets an admin delete a collection", async () => {
    const res = await fetch(`${base}/api/collections/${collectionId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 204);

    const getRes = await fetch(`${base}/api/collections/test-collection`);
    assert.equal(getRes.status, 404);
  });

  it("404s deleting a collection that doesn't exist", async () => {
    const res = await fetch(`${base}/api/collections/000000000000000000000000`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 404);
  });

  describe("categories & duplicate protection", () => {
    let kurtaCategoryId: string;
    let festiveCategoryId: string;
    let multiCategoryProductId: string;

    it("1. creates 'Kurta Sets'", async () => {
      const res = await fetch(`${base}/api/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: "Kurta Sets" }),
      });
      const body = await readJson(res);
      assert.equal(res.status, 201);
      assert.equal(body.category.name, "Kurta Sets");
      assert.equal(body.category.slug, "kurta-sets");
      assert.equal(body.created, true);
      kurtaCategoryId = body.category.id;
    });

    it("2. attempts 'kurta sets' (lowercase) and does not duplicate", async () => {
      const res = await fetch(`${base}/api/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: "kurta sets" }),
      });
      const body = await readJson(res);
      assert.equal(res.status, 200);
      assert.equal(body.created, false);
      assert.equal(body.category.id, kurtaCategoryId);
    });

    it("3. attempts '  Kurta Sets  ' (surrounding whitespace) and does not duplicate", async () => {
      const res = await fetch(`${base}/api/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: "  Kurta Sets  " }),
      });
      const body = await readJson(res);
      assert.equal(res.status, 200);
      assert.equal(body.created, false);
      assert.equal(body.category.id, kurtaCategoryId);
    });

    it("4. confirms only one category exists in GET /api/categories matching kurta-sets", async () => {
      const res = await fetch(`${base}/api/categories`);
      const body = await readJson(res);
      assert.equal(res.status, 200);
      const matches = body.categories.filter((c: any) => c.slug === "kurta-sets");
      assert.equal(matches.length, 1);
    });

    it("5. creates another distinct category 'Festive Wear'", async () => {
      const res = await fetch(`${base}/api/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: "Festive Wear" }),
      });
      const body = await readJson(res);
      assert.equal(res.status, 201);
      assert.equal(body.created, true);
      assert.equal(body.category.slug, "festive-wear");
      festiveCategoryId = body.category.id;
    });

    it("6. assigns both categories to a product", async () => {
      const res = await fetch(`${base}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          ...productInput,
          slug: "multi-cat-test-product",
          name: "Multi Category Product",
          categoryIds: [kurtaCategoryId, festiveCategoryId],
        }),
      });
      const body = await readJson(res);
      assert.equal(res.status, 201);
      assert.equal(body.product.categoryIds.length, 2);
      assert.ok(body.product.categoryIds.includes(kurtaCategoryId));
      assert.ok(body.product.categoryIds.includes(festiveCategoryId));
      multiCategoryProductId = body.product.id;
    });

    it("7. confirms both categories persist on GET /api/products/:slug", async () => {
      const res = await fetch(`${base}/api/products/multi-cat-test-product`);
      const body = await readJson(res);
      assert.equal(res.status, 200);
      assert.equal(body.product.categoryIds.length, 2);
      assert.ok(body.product.categoryIds.includes(kurtaCategoryId));
      assert.ok(body.product.categoryIds.includes(festiveCategoryId));
    });

    it("8. removes one category from the product (leaves only Festive Wear)", async () => {
      const res = await fetch(`${base}/api/products/${multiCategoryProductId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          ...productInput,
          slug: "multi-cat-test-product",
          name: "Multi Category Product",
          categoryIds: [festiveCategoryId],
        }),
      });
      const body = await readJson(res);
      assert.equal(res.status, 200);
      assert.equal(body.product.categoryIds.length, 1);
      assert.equal(body.product.categoryIds[0], festiveCategoryId);
    });

    it("9. confirms the removed category 'Kurta Sets' still exists in the database", async () => {
      const res = await fetch(`${base}/api/categories`);
      const body = await readJson(res);
      assert.equal(res.status, 200);
      const exists = body.categories.some((c: any) => c.id === kurtaCategoryId);
      assert.equal(exists, true);
    });

    it("10. assigns the category with duplicates and confirms deduplication", async () => {
      const res = await fetch(`${base}/api/products/${multiCategoryProductId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          ...productInput,
          slug: "multi-cat-test-product",
          name: "Multi Category Product",
          categoryIds: [festiveCategoryId, festiveCategoryId, kurtaCategoryId, kurtaCategoryId],
        }),
      });
      const body = await readJson(res);
      assert.equal(res.status, 200);
      assert.equal(body.product.categoryIds.length, 2);
    });

    it("11. rejects assigning a nonexistent category ID", async () => {
      const res = await fetch(`${base}/api/products/${multiCategoryProductId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          ...productInput,
          slug: "multi-cat-test-product",
          name: "Multi Category Product",
          categoryIds: ["000000000000000000000000"],
        }),
      });
      assert.equal(res.status, 400);
    });

    it("12. confirms a product can belong to multiple categories on the live GET endpoint", async () => {
      const res = await fetch(`${base}/api/products/multi-cat-test-product`);
      const body = await readJson(res);
      assert.equal(res.status, 200);
      assert.equal(body.product.categoryIds.length, 2);
    });

    it("13. confirms category filtering returns the product in every assigned category", async () => {
      // Query by kurta-sets
      const res1 = await fetch(`${base}/api/products?category=kurta-sets`);
      const body1 = await readJson(res1);
      assert.equal(res1.status, 200);
      const foundInKurta = body1.products.some((p: any) => p.slug === "multi-cat-test-product");
      assert.equal(foundInKurta, true);

      // Query by festive-wear
      const res2 = await fetch(`${base}/api/products?category=festive-wear`);
      const body2 = await readJson(res2);
      assert.equal(res2.status, 200);
      const foundInFestive = body2.products.some((p: any) => p.slug === "multi-cat-test-product");
      assert.equal(foundInFestive, true);
    });
  });

  describe("catalog pagination, sorting, and price boundaries", () => {
    it("respects exact price boundary values on minPrice and maxPrice", async () => {
      const res = await fetch(`${base}/api/products?minPrice=10000&maxPrice=18000`);
      const body = await readJson(res);
      assert.equal(res.status, 200);
      assert.ok(body.products.length > 0);
      for (const p of body.products) {
        assert.ok(p.price >= 10000, `Expected price ${p.price} >= 10000`);
        assert.ok(p.price <= 18000, `Expected price ${p.price} <= 18000`);
      }
    });

    it("paginates stably and safely returns empty array beyond the last page", async () => {
      const page1Res = await fetch(`${base}/api/products?page=1&limit=1&sort=price_asc`);
      const page1 = await readJson(page1Res);
      assert.equal(page1Res.status, 200);
      assert.equal(page1.page, 1);
      assert.equal(page1.limit, 1);
      assert.equal(page1.products.length, 1);

      const page2Res = await fetch(`${base}/api/products?page=2&limit=1&sort=price_asc`);
      const page2 = await readJson(page2Res);
      assert.equal(page2Res.status, 200);
      assert.equal(page2.page, 2);
      assert.equal(page2.products.length, 1);
      assert.notEqual(page1.products[0].id, page2.products[0].id);

      const beyondRes = await fetch(`${base}/api/products?page=9999&limit=10`);
      const beyond = await readJson(beyondRes);
      assert.equal(beyondRes.status, 200);
      assert.equal(beyond.products.length, 0);
      assert.ok(beyond.total > 0);
    });

    it("sorts by price descending globally", async () => {
      const res = await fetch(`${base}/api/products?sort=price_desc&limit=10`);
      const body = await readJson(res);
      assert.equal(res.status, 200);
      for (let i = 0; i < body.products.length - 1; i++) {
        assert.ok(body.products[i].price >= body.products[i + 1].price);
      }
    });

    it("intersects category and size without erasing category filter", async () => {
      const res = await fetch(`${base}/api/products?category=Lehengas&size=M`);
      const body = await readJson(res);
      assert.equal(res.status, 200);
      assert.ok(body.products.length > 0);
      for (const p of body.products) {
        assert.equal(p.category, "Lehengas");
        assert.ok(p.sizes.includes("M"));
      }
    });

    it("intersects size and colour without acting as union", async () => {
      // Free Size + Peach: no product has both Free Size AND Peach
      const res = await fetch(`${base}/api/products?size=Free+Size&color=Peach`);
      const body = await readJson(res);
      assert.equal(res.status, 200);
      assert.equal(body.products.length, 0);
    });

    it("hides unpublished products from public /api/products but allows admin to see all", async () => {
      const publicRes = await fetch(`${base}/api/products`);
      const publicBody = await readJson(publicRes);
      assert.equal(publicRes.status, 200);
      assert.ok(publicBody.products.every((p: any) => p.published === true));

      const adminRes = await fetch(`${base}/api/products`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const adminBody = await readJson(adminRes);
      assert.equal(adminRes.status, 200);
      assert.ok(adminBody.products.some((p: any) => p.published === false));
    });

    it("accepts frontend kebab-case sort parameters like price-asc and best-selling", async () => {
      const ascRes = await fetch(`${base}/api/products?sort=price-asc&limit=5`);
      assert.equal(ascRes.status, 200);
      const bestRes = await fetch(`${base}/api/products?sort=best-selling&limit=5`);
      assert.equal(bestRes.status, 200);
    });
  });
});



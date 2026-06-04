import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCreateProductBody,
  parseUpdateProductBody,
  ProductSchemaError,
} from "./productSchemas.js";

test("parseCreateProductBody accepts valid payload", () => {
  const parsed = parseCreateProductBody({
    name: "Classic Tee",
    price: 1299,
    keywords: "tshirt,cotton",
    notes: "best seller",
  });

  assert.deepEqual(parsed, {
    name: "Classic Tee",
    price: 1299,
    keywords: "tshirt,cotton",
    notes: "best seller",
  });
});

test("parseCreateProductBody rejects negative price", () => {
  assert.throws(
    () =>
      parseCreateProductBody({
        name: "Classic Tee",
        price: -999,
      }),
    (err: unknown) => {
      assert.ok(err instanceof ProductSchemaError);
      assert.match(err.message, /Price must be a positive number/i);
      return true;
    }
  );
});

test("parseCreateProductBody rejects string price", () => {
  assert.throws(
    () =>
      parseCreateProductBody({
        name: "Classic Tee",
        price: "hello",
      }),
    (err: unknown) => {
      assert.ok(err instanceof ProductSchemaError);
      assert.match(err.message, /Price must be a positive number/i);
      return true;
    }
  );
});

test("parseCreateProductBody rejects empty name", () => {
  assert.throws(
    () =>
      parseCreateProductBody({
        name: "",
        price: 1200,
      }),
    (err: unknown) => {
      assert.ok(err instanceof ProductSchemaError);
      assert.equal(err.message, "Name and price are required");
      return true;
    }
  );
});

test("parseCreateProductBody rejects quote-only name", () => {
  assert.throws(
    () =>
      parseCreateProductBody({
        name: '""',
        price: 500,
      }),
    (err: unknown) => {
      assert.ok(err instanceof ProductSchemaError);
      assert.equal(err.message, "Product name must include at least one letter or number");
      return true;
    }
  );
});

test("parseUpdateProductBody rejects punctuation-only name", () => {
  assert.throws(
    () =>
      parseUpdateProductBody({
        name: "---",
      }),
    (err: unknown) => {
      assert.ok(err instanceof ProductSchemaError);
      assert.equal(err.message, "Product name must include at least one letter or number");
      return true;
    }
  );
});

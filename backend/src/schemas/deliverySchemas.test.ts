import assert from "node:assert/strict";
import test from "node:test";
import { parseCreateDeliveryZoneBody, DeliverySchemaError } from "./deliverySchemas.js";

test("parseCreateDeliveryZoneBody accepts valid payload", () => {
  const parsed = parseCreateDeliveryZoneBody({
    name: "Kathmandu",
    price: 100,
    codAvailable: true,
  });

  assert.deepEqual(parsed, {
    name: "Kathmandu",
    price: 100,
    codAvailable: true,
  });
});

test("parseCreateDeliveryZoneBody rejects negative price", () => {
  assert.throws(
    () =>
      parseCreateDeliveryZoneBody({
        name: "Kathmandu",
        price: -999,
      }),
    (err: unknown) => {
      assert.ok(err instanceof DeliverySchemaError);
      assert.equal(err.message, "Price must be between 0 and 10,000");
      return true;
    }
  );
});

test("parseCreateDeliveryZoneBody rejects string price", () => {
  assert.throws(
    () =>
      parseCreateDeliveryZoneBody({
        name: "Kathmandu",
        price: "hello",
      }),
    (err: unknown) => {
      assert.ok(err instanceof DeliverySchemaError);
      assert.equal(err.message, "name and price are required");
      return true;
    }
  );
});

test("parseCreateDeliveryZoneBody rejects empty name", () => {
  assert.throws(
    () =>
      parseCreateDeliveryZoneBody({
        name: "",
        price: 100,
      }),
    (err: unknown) => {
      assert.ok(err instanceof DeliverySchemaError);
      assert.equal(err.message, "name and price are required");
      return true;
    }
  );
});

test("parseCreateDeliveryZoneBody rejects negative-number-like name", () => {
  assert.throws(
    () =>
      parseCreateDeliveryZoneBody({
        name: "-100",
        price: 100,
      }),
    (err: unknown) => {
      assert.ok(err instanceof DeliverySchemaError);
      assert.equal(err.message, "Zone name cannot be a negative number");
      return true;
    }
  );
});

test("parseCreateDeliveryZoneBody rejects name with no letters", () => {
  assert.throws(
    () =>
      parseCreateDeliveryZoneBody({
        name: "12345",
        price: 100,
      }),
    (err: unknown) => {
      assert.ok(err instanceof DeliverySchemaError);
      assert.equal(err.message, "Zone name must include at least one letter");
      return true;
    }
  );
});

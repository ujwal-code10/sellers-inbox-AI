import assert from "node:assert/strict";
import test from "node:test";
import {
  parseEsewaVerifyBody,
  parseManualQrSubmitBody,
  PaymentSchemaError,
} from "./paymentSchemas.js";

test("parseEsewaVerifyBody accepts encodedData and ignores client billing hints", () => {
  const parsed = parseEsewaVerifyBody({
    encodedData: "base64-payload",
    billing: "yearly",
  });

  assert.deepEqual(parsed, { encodedData: "base64-payload" });
});

test("parseEsewaVerifyBody rejects missing encodedData", () => {
  assert.throws(
    () => parseEsewaVerifyBody({}),
    (err: unknown) => {
      assert.ok(err instanceof PaymentSchemaError);
      assert.equal(err.message, "encodedData is required");
      return true;
    }
  );
});

test("parseManualQrSubmitBody normalizes valid payload", () => {
  const parsed = parseManualQrSubmitBody({
    billing: "monthly",
    paymentReference: "  abc-123  ",
    payerName: "  Ujwal  ",
    note: "  paid from eSewa wallet  ",
  });

  assert.deepEqual(parsed, {
    billing: "monthly",
    paymentReference: "ABC-123",
    payerName: "Ujwal",
    note: "paid from eSewa wallet",
  });
});

test("parseManualQrSubmitBody rejects invalid reference characters", () => {
  assert.throws(
    () =>
      parseManualQrSubmitBody({
        billing: "monthly",
        paymentReference: "bad ref with spaces",
        payerName: "Seller",
      }),
    (err: unknown) => {
      assert.ok(err instanceof PaymentSchemaError);
      assert.match(err.message, /paymentReference can only contain/i);
      return true;
    }
  );
});

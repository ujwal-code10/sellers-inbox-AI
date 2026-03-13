// messageHandler.ts

import { resolveProductContext } from "../product/productResolver.js";
import { decideReply, Intent } from "../decision/decisionEngine.js";
import { calculateConfidence } from "../decision/confidence.js";


// Incoming message type (adjust based on your app)
interface IncomingMessage {
  text: string;
  media?: any[];
  source: "STORY_REPLY" | "REEL_FORWARD" | "DM";
  intent?: string;
  productNames?: string[]; // Seller's product names from DB
}

export async function handleIncomingMessage(event: IncomingMessage) {
  const messageText = event.text;
  const hasMedia = Boolean(event.media?.length);
  const source = event.source;
  const intent: Intent = (event.intent as Intent) ?? "UNKNOWN";
  const productNames = event.productNames ?? [];

  // 1️⃣ Resolve product context (now requires productNames for matching)
  const productContext = resolveProductContext({
    messageText,
    hasMedia,
    source,
    productNames,
  });

  // 2️⃣ Calculate confidence
  const confidence = calculateConfidence({
    productKnown: productContext.productKnown,
    intent,
  });

  // 3️⃣ Decide what to do
  const decision = decideReply({
    intent,
    productKnown: productContext.productKnown,
    confidence,
  });

  // 4️⃣ Enforce decision
  switch (decision.action) {
    case "REPLY":
      // 🔹 CALL YOUR EXISTING AI REPLY FUNCTION HERE
      // e.g., await sendAiReply(event.userId, messageText);
      break;

    case "ASK":
      // 🔹 SEND CLARIFICATION MESSAGE HERE
      // e.g., await sendClarification(event.userId);
      break;

    case "SKIP":
      // do nothing
      return;
  }

  return {
    action: decision.action,
    reason: decision.reason,
    productKnown: productContext.productKnown,
    matchedProduct: productContext.matchedProduct,
  };
}

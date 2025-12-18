
import { describe, it, expect } from "vitest";

import "../server/security";
import "../server/arcium-service";
import "../server/nft-service";
import "../server/endpoints/dynamic-image";
import "../server/invoice-storage";
import "../server/stablecoin-payment-service";
import "../server/email-service";
import "../server/invoice-routes";
import "../server/invoice-routes";
import "../server/payment-routes";
import "../server/auth-routes";
import "../server/routes"; // Central file

describe("Debug Dependencies Static", () => {
    it("should load everything", () => {
        expect(true).toBe(true);
    });
});

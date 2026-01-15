import { Router } from "express";
import { getSolPrice } from "./pricing-service";
import { globalRateLimit } from "./security";

const router = Router();

router.get("/sol", globalRateLimit, async (req, res) => {
    try {
        const price = await getSolPrice();
        res.json({
            symbol: "SOL",
            currency: "USD",
            price: price,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        res.status(500).json({ error: "Failed to fetch price" });
    }
});

export const pricingRouter = router;

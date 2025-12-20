import { Router } from "express";
import { getSolPrice } from "./pricing-service";

const router = Router();

router.get("/sol", async (req, res) => {
    try {
        const price = await getSolPrice();
        res.json({
            symbol: "SOL",
            currency: "USD",
            price: price,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch price" });
    }
});

export const pricingRouter = router;

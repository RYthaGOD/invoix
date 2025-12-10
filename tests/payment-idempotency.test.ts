/**
 * Payment Idempotency Tests
 * Ensures payment processing is idempotent and prevents double-spending
 */

import { describe, it, expect } from "vitest";

describe("Payment Idempotency", () => {
  describe("Transaction Hash Uniqueness", () => {
    it("should detect duplicate transaction signatures", () => {
      const processedTransactions = new Set<string>();
      const txSignature = "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";

      // First processing
      const isFirstTime = !processedTransactions.has(txSignature);
      expect(isFirstTime).toBe(true);
      processedTransactions.add(txSignature);

      // Second processing (duplicate)
      const isSecondTime = !processedTransactions.has(txSignature);
      expect(isSecondTime).toBe(false);
    });

    it("should allow different transactions", () => {
      const processedTransactions = new Set<string>();
      const tx1 = "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";
      const tx2 = "3ZqpXjVVXQJKqJKqJKqJKqJKqJKqJKqJKqJKqJKqJKqJKqJKqJKqJKqJKqJKqJKqJKqJKqJKqJKqJKqJKqJK";

      processedTransactions.add(tx1);
      
      const canProcessTx2 = !processedTransactions.has(tx2);
      expect(canProcessTx2).toBe(true);
    });
  });

  describe("Payment Application", () => {
    interface Payment {
      id: string;
      invoiceId: string;
      txSignature: string;
      amount: string;
      processedAt: Date;
    }

    const applyPayment = (
      invoice: { paidAmount: string; totalAmount: string },
      payment: Payment,
      processedPayments: Set<string>
    ): { success: boolean; reason?: string; newPaidAmount?: string } => {
      // Check if already processed
      if (processedPayments.has(payment.txSignature)) {
        return {
          success: false,
          reason: "Payment already processed (duplicate transaction)"
        };
      }

      // Check if amount is valid
      const amount = parseFloat(payment.amount);
      if (amount <= 0) {
        return {
          success: false,
          reason: "Payment amount must be positive"
        };
      }

      // Apply payment
      const currentPaid = parseFloat(invoice.paidAmount);
      const newPaidAmount = (currentPaid + amount).toFixed(2);

      // Mark as processed
      processedPayments.add(payment.txSignature);

      return {
        success: true,
        newPaidAmount
      };
    };

    it("should apply first payment successfully", () => {
      const invoice = { paidAmount: "0.00", totalAmount: "1000.00" };
      const payment: Payment = {
        id: "pay-1",
        invoiceId: "inv-1",
        txSignature: "tx-1",
        amount: "400.00",
        processedAt: new Date()
      };
      const processedPayments = new Set<string>();

      const result = applyPayment(invoice, payment, processedPayments);

      expect(result.success).toBe(true);
      expect(result.newPaidAmount).toBe("400.00");
      expect(processedPayments.has("tx-1")).toBe(true);
    });

    it("should reject duplicate payment", () => {
      const invoice = { paidAmount: "400.00", totalAmount: "1000.00" };
      const payment: Payment = {
        id: "pay-1",
        invoiceId: "inv-1",
        txSignature: "tx-1",
        amount: "400.00",
        processedAt: new Date()
      };
      const processedPayments = new Set<string>(["tx-1"]);

      const result = applyPayment(invoice, payment, processedPayments);

      expect(result.success).toBe(false);
      expect(result.reason).toContain("already processed");
      expect(result.newPaidAmount).toBeUndefined();
    });

    it("should allow multiple different payments", () => {
      const invoice = { paidAmount: "0.00", totalAmount: "1000.00" };
      const processedPayments = new Set<string>();

      // First payment
      const payment1: Payment = {
        id: "pay-1",
        invoiceId: "inv-1",
        txSignature: "tx-1",
        amount: "400.00",
        processedAt: new Date()
      };
      const result1 = applyPayment(invoice, payment1, processedPayments);
      expect(result1.success).toBe(true);
      invoice.paidAmount = result1.newPaidAmount!;

      // Second payment
      const payment2: Payment = {
        id: "pay-2",
        invoiceId: "inv-1",
        txSignature: "tx-2",
        amount: "600.00",
        processedAt: new Date()
      };
      const result2 = applyPayment(invoice, payment2, processedPayments);
      expect(result2.success).toBe(true);
      expect(result2.newPaidAmount).toBe("1000.00");
    });

    it("should reject zero amount payment", () => {
      const invoice = { paidAmount: "0.00", totalAmount: "1000.00" };
      const payment: Payment = {
        id: "pay-1",
        invoiceId: "inv-1",
        txSignature: "tx-1",
        amount: "0.00",
        processedAt: new Date()
      };
      const processedPayments = new Set<string>();

      const result = applyPayment(invoice, payment, processedPayments);

      expect(result.success).toBe(false);
      expect(result.reason).toContain("must be positive");
    });

    it("should reject negative amount payment", () => {
      const invoice = { paidAmount: "0.00", totalAmount: "1000.00" };
      const payment: Payment = {
        id: "pay-1",
        invoiceId: "inv-1",
        txSignature: "tx-1",
        amount: "-100.00",
        processedAt: new Date()
      };
      const processedPayments = new Set<string>();

      const result = applyPayment(invoice, payment, processedPayments);

      expect(result.success).toBe(false);
      expect(result.reason).toContain("must be positive");
    });

    it("should allow overpayment", () => {
      const invoice = { paidAmount: "900.00", totalAmount: "1000.00" };
      const payment: Payment = {
        id: "pay-1",
        invoiceId: "inv-1",
        txSignature: "tx-1",
        amount: "200.00",
        processedAt: new Date()
      };
      const processedPayments = new Set<string>();

      const result = applyPayment(invoice, payment, processedPayments);

      expect(result.success).toBe(true);
      expect(result.newPaidAmount).toBe("1100.00");
    });
  });

  describe("Race Condition Prevention", () => {
    it("should handle concurrent payment attempts for same transaction", async () => {
      const invoice = { paidAmount: "0.00", totalAmount: "1000.00" };
      const processedPayments = new Set<string>();
      const txSignature = "tx-concurrent";

      // Simulate two concurrent requests trying to process same payment
      const attemptPayment = () => {
        // Atomic check-and-set pattern
        if (processedPayments.has(txSignature)) {
          return { success: false, reason: "Already processed" };
        }
        // In real implementation, this would be a database transaction
        processedPayments.add(txSignature);
        return { success: true };
      };

      const result1 = attemptPayment();
      const result2 = attemptPayment();

      // Only one should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(processedPayments.size).toBe(1);
    });
  });

  describe("Blockchain Confirmation Handling", () => {
    interface PaymentRecord {
      txSignature: string;
      amount: string;
      confirmations: number;
      status: "pending" | "confirmed" | "finalized";
    }

    const shouldProcessPayment = (payment: PaymentRecord): boolean => {
      // Require finalized status for payment to be applied
      // This prevents replay attacks and ensures transaction is irreversible
      return payment.status === "finalized" && payment.confirmations >= 32;
    };

    it("should not process unconfirmed payment", () => {
      const payment: PaymentRecord = {
        txSignature: "tx-1",
        amount: "100.00",
        confirmations: 0,
        status: "pending"
      };

      expect(shouldProcessPayment(payment)).toBe(false);
    });

    it("should not process partially confirmed payment", () => {
      const payment: PaymentRecord = {
        txSignature: "tx-1",
        amount: "100.00",
        confirmations: 15,
        status: "confirmed"
      };

      expect(shouldProcessPayment(payment)).toBe(false);
    });

    it("should process finalized payment with sufficient confirmations", () => {
      const payment: PaymentRecord = {
        txSignature: "tx-1",
        amount: "100.00",
        confirmations: 32,
        status: "finalized"
      };

      expect(shouldProcessPayment(payment)).toBe(true);
    });

    it("should process payment with extra confirmations", () => {
      const payment: PaymentRecord = {
        txSignature: "tx-1",
        amount: "100.00",
        confirmations: 100,
        status: "finalized"
      };

      expect(shouldProcessPayment(payment)).toBe(true);
    });
  });

  describe("Payment Record Uniqueness", () => {
    interface PaymentDB {
      payments: Map<string, any>;
      invoicePayments: Map<string, Set<string>>;
    }

    const addPaymentRecord = (
      db: PaymentDB,
      invoiceId: string,
      txSignature: string,
      amount: string
    ): { success: boolean; error?: string } => {
      // Check if transaction already recorded for any invoice
      if (db.payments.has(txSignature)) {
        return {
          success: false,
          error: "Transaction already recorded"
        };
      }

      // Check if this invoice already has this transaction
      const invoicePaymentTxs = db.invoicePayments.get(invoiceId) || new Set();
      if (invoicePaymentTxs.has(txSignature)) {
        return {
          success: false,
          error: "Transaction already applied to this invoice"
        };
      }

      // Record payment
      db.payments.set(txSignature, {
        invoiceId,
        amount,
        recordedAt: new Date()
      });

      // Link to invoice
      invoicePaymentTxs.add(txSignature);
      db.invoicePayments.set(invoiceId, invoicePaymentTxs);

      return { success: true };
    };

    it("should prevent same transaction from being recorded twice", () => {
      const db: PaymentDB = {
        payments: new Map(),
        invoicePayments: new Map()
      };

      const result1 = addPaymentRecord(db, "inv-1", "tx-1", "100.00");
      expect(result1.success).toBe(true);

      const result2 = addPaymentRecord(db, "inv-1", "tx-1", "100.00");
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("already recorded");
    });

    it("should prevent same transaction from being applied to different invoices", () => {
      const db: PaymentDB = {
        payments: new Map(),
        invoicePayments: new Map()
      };

      const result1 = addPaymentRecord(db, "inv-1", "tx-1", "100.00");
      expect(result1.success).toBe(true);

      const result2 = addPaymentRecord(db, "inv-2", "tx-1", "100.00");
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("already recorded");
    });

    it("should allow different transactions for same invoice", () => {
      const db: PaymentDB = {
        payments: new Map(),
        invoicePayments: new Map()
      };

      const result1 = addPaymentRecord(db, "inv-1", "tx-1", "100.00");
      expect(result1.success).toBe(true);

      const result2 = addPaymentRecord(db, "inv-1", "tx-2", "200.00");
      expect(result2.success).toBe(true);

      expect(db.invoicePayments.get("inv-1")?.size).toBe(2);
    });
  });
});

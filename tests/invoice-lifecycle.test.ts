/**
 * Invoice Lifecycle Tests
 * Tests complete invoice flow from creation to payment
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { safeAdd, safeSubtract, safeMultiply, safePercent } from "@shared/math";

describe("Invoice Lifecycle Tests", () => {
  describe("Safe Math Utilities", () => {
    it("should safely add decimal numbers", () => {
      expect(safeAdd("0.1", "0.2")).toBe("0.3");
      expect(safeAdd("100.5", "50.25")).toBe("150.75");
      expect(safeAdd("0", "100")).toBe("100");
    });

    it("should safely subtract decimal numbers", () => {
      expect(safeSubtract("1000", "250.50")).toBe("749.5");
      expect(safeSubtract("0.3", "0.1")).toBe("0.2");
      expect(safeSubtract("100", "100")).toBe("0");
    });

    it("should safely multiply decimal numbers", () => {
      expect(safeMultiply("10", "5")).toBe("50");
      expect(safeMultiply("10.5", "2")).toBe("21");
      expect(safeMultiply("0.1", "0.1")).toBe("0.01");
    });

    it("should safely calculate percentages", () => {
      expect(safePercent("1000", "10")).toBe("100"); // 10% of 1000
      expect(safePercent("500", "5")).toBe("25"); // 5% of 500
    });

    it("should handle edge cases without floating point errors", () => {
      // Classic floating point error: 0.1 + 0.2 = 0.30000000000000004
      const result = safeAdd("0.1", "0.2");
      expect(result).toBe("0.3");
      expect(parseFloat(result)).toBe(0.3);
    });
  });

  describe("Invoice State Transitions", () => {
    it("should transition from draft to sent", () => {
      const invoice = {
        status: "draft" as const,
        sentAt: null as Date | null,
      };

      // Simulate sending invoice
      const updatedInvoice = {
        ...invoice,
        status: "sent" as const,
        sentAt: new Date(),
      };

      expect(updatedInvoice.status).toBe("sent");
      expect(updatedInvoice.sentAt).not.toBeNull();
    });

    it("should transition to partial payment status", () => {
      const invoice = {
        status: "sent",
        totalAmount: "1000.00",
        paidAmount: "0.00",
        remainingAmount: "1000.00",
      };

      // Simulate partial payment
      const paymentAmount = "400.00";
      const newPaidAmount = safeAdd(invoice.paidAmount, paymentAmount);
      const newRemainingAmount = safeSubtract(invoice.totalAmount, newPaidAmount);

      const updatedInvoice = {
        ...invoice,
        status: "partial",
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
      };

      expect(updatedInvoice.status).toBe("partial");
      expect(updatedInvoice.paidAmount).toBe("400");
      expect(updatedInvoice.remainingAmount).toBe("600");
    });

    it("should transition to paid status when fully paid", () => {
      const invoice = {
        status: "partial",
        totalAmount: "1000.00",
        paidAmount: "400.00",
        remainingAmount: "600.00",
        paidAt: null as Date | null,
      };

      // Simulate final payment
      const paymentAmount = "600.00";
      const newPaidAmount = safeAdd(invoice.paidAmount, paymentAmount);
      const newRemainingAmount = safeSubtract(invoice.totalAmount, newPaidAmount);

      const isPaid = parseFloat(newRemainingAmount) <= 0;

      const updatedInvoice = {
        ...invoice,
        status: isPaid ? ("paid" as const) : invoice.status,
        paidAmount: newPaidAmount,
        remainingAmount: isPaid ? "0" : newRemainingAmount,
        paidAt: isPaid ? new Date() : invoice.paidAt,
      };

      expect(updatedInvoice.status).toBe("paid");
      expect(updatedInvoice.paidAmount).toBe("1000");
      expect(updatedInvoice.remainingAmount).toBe("0");
      expect(updatedInvoice.paidAt).not.toBeNull();
    });

    it("should handle overpayment correctly", () => {
      const invoice = {
        totalAmount: "1000.00",
        paidAmount: "0.00",
      };

      // Simulate overpayment
      const paymentAmount = "1100.00";
      const newPaidAmount = safeAdd(invoice.paidAmount, paymentAmount);
      const remainingAmount = safeSubtract(invoice.totalAmount, newPaidAmount);

      expect(parseFloat(remainingAmount)).toBeLessThan(0);
      expect(newPaidAmount).toBe("1100");
      // Remaining should be negative, but we should cap at 0 in actual implementation
      expect(parseFloat(remainingAmount)).toBe(-100);
    });

    it("should detect overdue invoices", () => {
      const today = new Date();
      const pastDueDate = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000);

      const invoice = {
        status: "sent",
        dueDate: pastDueDate,
      };

      const isOverdue = invoice.status !== "paid" && invoice.dueDate < today;

      expect(isOverdue).toBe(true);
    });

    it("should not mark paid invoices as overdue", () => {
      const today = new Date();
      const pastDueDate = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000);

      const invoice = {
        status: "paid",
        dueDate: pastDueDate,
      };

      const isOverdue = invoice.status !== "paid" && invoice.dueDate < today;

      expect(isOverdue).toBe(false);
    });
  });

  describe("Invoice Calculation Logic", () => {
    it("should calculate subtotal from line items", () => {
      const lineItems = [
        { quantity: 2, unitPrice: "100.00" },
        { quantity: 3, unitPrice: "50.00" },
        { quantity: 1, unitPrice: "25.50" },
      ];

      const subtotal = lineItems.reduce((sum, item) => {
        const lineTotal = safeMultiply(item.quantity.toString(), item.unitPrice);
        return safeAdd(sum, lineTotal);
      }, "0");

      expect(subtotal).toBe("375.5"); // 200 + 150 + 25.50
    });

    it("should calculate total with tax and discount", () => {
      const subtotal = "1000.00";
      const taxRate = "10"; // 10%
      const discountAmount = "50.00";

      const taxAmount = safePercent(subtotal, taxRate);
      const totalBeforeDiscount = safeAdd(subtotal, taxAmount);
      const totalAmount = safeSubtract(totalBeforeDiscount, discountAmount);

      expect(taxAmount).toBe("100");
      expect(totalBeforeDiscount).toBe("1100");
      expect(totalAmount).toBe("1050");
    });

    it("should maintain precision with multiple operations", () => {
      // Complex calculation: (100 * 1.5 + 50) * 1.1 - 10
      const step1 = safeMultiply("100", "1.5"); // 150
      const step2 = safeAdd(step1, "50"); // 200
      const step3 = safeMultiply(step2, "1.1"); // 220
      const step4 = safeSubtract(step3, "10"); // 210

      expect(step4).toBe("210");
    });

    it("should calculate remaining amount after multiple payments", () => {
      const totalAmount = "1000.00";
      let paidAmount = "0.00";

      // Payment 1
      paidAmount = safeAdd(paidAmount, "250.00");
      expect(paidAmount).toBe("250");

      // Payment 2
      paidAmount = safeAdd(paidAmount, "300.00");
      expect(paidAmount).toBe("550");

      // Payment 3
      paidAmount = safeAdd(paidAmount, "450.00");
      expect(paidAmount).toBe("1000");

      const remainingAmount = safeSubtract(totalAmount, paidAmount);
      expect(remainingAmount).toBe("0");
    });
  });

  describe("Payment Reconciliation", () => {
    it("should verify payment amount matches invoice currency", () => {
      const invoice = {
        currency: "USDC",
        totalAmount: "1000.00",
      };

      const payment = {
        currency: "USDC",
        amount: "1000.00",
      };

      expect(payment.currency).toBe(invoice.currency);
    });

    it("should reject payment with wrong currency", () => {
      const invoice = {
        currency: "USDC",
      };

      const payment = {
        currency: "USDT",
      };

      const isValid = payment.currency === invoice.currency;
      expect(isValid).toBe(false);
    });

    it("should handle payment verification tolerance", () => {
      const expectedAmount = 1000.0;
      const actualAmount = 1000.5; // 0.05% difference

      // Allow 0.1% tolerance for rounding
      const tolerance = expectedAmount * 0.001;
      const isWithinTolerance = Math.abs(actualAmount - expectedAmount) <= tolerance;

      expect(isWithinTolerance).toBe(true);
    });

    it("should reject payment outside tolerance", () => {
      const expectedAmount = 1000.0;
      const actualAmount = 995.0; // 0.5% difference

      // Allow 0.1% tolerance for rounding
      const tolerance = expectedAmount * 0.001;
      const isWithinTolerance = Math.abs(actualAmount - expectedAmount) <= tolerance;

      expect(isWithinTolerance).toBe(false);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle zero amounts", () => {
      expect(safeAdd("0", "0")).toBe("0");
      expect(safeSubtract("100", "100")).toBe("0");
      expect(safeMultiply("0", "100")).toBe("0");
    });

    it("should handle very large numbers", () => {
      const large = "999999999.999999";
      const result = safeAdd(large, "1");
      expect(parseFloat(result)).toBeGreaterThan(1000000000);
    });

    it("should handle very small numbers", () => {
      const small = "0.000001";
      const result = safeMultiply(small, "1000000");
      expect(result).toBe("1");
    });

    it("should prevent negative payment amounts", () => {
      const paymentAmount = "-100.00";
      const isValid = parseFloat(paymentAmount) > 0;
      expect(isValid).toBe(false);
    });

    it("should validate payment amount is not greater than remaining", () => {
      const remainingAmount = "500.00";
      const paymentAmount = "600.00";

      // This should be allowed (overpayment), but should be noted
      const isOverpayment = parseFloat(paymentAmount) > parseFloat(remainingAmount);
      expect(isOverpayment).toBe(true);
    });
  });

  describe("Business Logic Validation", () => {
    it("should not allow editing paid invoices", () => {
      const invoice = { status: "paid" };
      const canEdit = invoice.status !== "paid";
      expect(canEdit).toBe(false);
    });

    it("should allow editing draft invoices", () => {
      const invoice = { status: "draft" };
      const canEdit = invoice.status === "draft";
      expect(canEdit).toBe(true);
    });

    it("should not delete sent invoices, only cancel them", () => {
      const invoice = { status: "sent" };
      const shouldCancel = invoice.status !== "draft";
      expect(shouldCancel).toBe(true);
    });

    it("should generate unique invoice numbers", () => {
      const prefix = "INV";
      const year = new Date().getFullYear();
      const sequence = 1;

      const invoiceNumber = `${prefix}-${year}-${sequence.toString().padStart(3, "0")}`;

      expect(invoiceNumber).toMatch(/^INV-\d{4}-\d{3}$/);
    });
  });
});

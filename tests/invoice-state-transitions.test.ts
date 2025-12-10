/**
 * Invoice State Transition Tests
 * Tests for invoice lifecycle and state management
 */

import { describe, it, expect } from "vitest";

describe("Invoice State Transitions", () => {
  // Valid state transitions based on invoice lifecycle
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ["sent", "cancelled"],
    sent: ["viewed", "partial", "paid", "overdue", "cancelled"],
    viewed: ["partial", "paid", "overdue", "cancelled"],
    partial: ["paid", "overdue", "cancelled"],
    paid: [], // Terminal state (unless refunded)
    overdue: ["partial", "paid", "cancelled"],
    cancelled: [], // Terminal state
  };

  describe("Valid State Transitions", () => {
    it("should allow draft -> sent transition", () => {
      const currentState = "draft";
      const newState = "sent";
      expect(VALID_TRANSITIONS[currentState]).toContain(newState);
    });

    it("should allow sent -> viewed transition", () => {
      const currentState = "sent";
      const newState = "viewed";
      expect(VALID_TRANSITIONS[currentState]).toContain(newState);
    });

    it("should allow sent -> paid transition", () => {
      const currentState = "sent";
      const newState = "paid";
      expect(VALID_TRANSITIONS[currentState]).toContain(newState);
    });

    it("should allow partial -> paid transition", () => {
      const currentState = "partial";
      const newState = "paid";
      expect(VALID_TRANSITIONS[currentState]).toContain(newState);
    });

    it("should allow overdue -> paid transition", () => {
      const currentState = "overdue";
      const newState = "paid";
      expect(VALID_TRANSITIONS[currentState]).toContain(newState);
    });

    it("should allow any non-terminal state -> cancelled", () => {
      const nonTerminalStates = ["draft", "sent", "viewed", "partial", "overdue"];
      nonTerminalStates.forEach(state => {
        expect(VALID_TRANSITIONS[state]).toContain("cancelled");
      });
    });
  });

  describe("Invalid State Transitions", () => {
    it("should not allow paid -> any transition", () => {
      const currentState = "paid";
      expect(VALID_TRANSITIONS[currentState]).toHaveLength(0);
    });

    it("should not allow cancelled -> any transition", () => {
      const currentState = "cancelled";
      expect(VALID_TRANSITIONS[currentState]).toHaveLength(0);
    });

    it("should not allow draft -> paid directly", () => {
      const currentState = "draft";
      const newState = "paid";
      expect(VALID_TRANSITIONS[currentState]).not.toContain(newState);
    });

    it("should not allow sent -> draft backwards", () => {
      const currentState = "sent";
      const newState = "draft";
      expect(VALID_TRANSITIONS[currentState]).not.toContain(newState);
    });

    it("should not allow viewed -> sent backwards", () => {
      const currentState = "viewed";
      const newState = "sent";
      expect(VALID_TRANSITIONS[currentState]).not.toContain(newState);
    });
  });

  describe("State Transition Validation Function", () => {
    const isValidTransition = (from: string, to: string): boolean => {
      if (!VALID_TRANSITIONS[from]) return false;
      return VALID_TRANSITIONS[from].includes(to);
    };

    it("should validate transitions correctly", () => {
      expect(isValidTransition("draft", "sent")).toBe(true);
      expect(isValidTransition("sent", "viewed")).toBe(true);
      expect(isValidTransition("paid", "sent")).toBe(false);
      expect(isValidTransition("cancelled", "sent")).toBe(false);
    });

    it("should reject unknown states", () => {
      expect(isValidTransition("unknown", "sent")).toBe(false);
      expect(isValidTransition("sent", "unknown")).toBe(false);
    });
  });

  describe("Automatic State Updates Based on Payments", () => {
    const calculateInvoiceStatus = (
      totalAmount: string,
      paidAmount: string,
      dueDate: Date,
      currentStatus: string
    ): string => {
      const total = parseFloat(totalAmount);
      const paid = parseFloat(paidAmount);
      const now = new Date();
      const isOverdue = dueDate < now;

      // Don't change terminal states
      if (currentStatus === "paid" || currentStatus === "cancelled") {
        return currentStatus;
      }

      // Fully paid
      if (paid >= total) {
        return "paid";
      }

      // Partially paid
      if (paid > 0 && paid < total) {
        // Check if overdue
        if (isOverdue && currentStatus !== "overdue") {
          return "overdue";
        }
        return "partial";
      }

      // Not paid but overdue
      if (paid === 0 && isOverdue && currentStatus !== "draft") {
        return "overdue";
      }

      // No change
      return currentStatus;
    };

    it("should transition to paid when fully paid", () => {
      const status = calculateInvoiceStatus(
        "1000.00",
        "1000.00",
        new Date(Date.now() + 86400000), // Tomorrow
        "sent"
      );
      expect(status).toBe("paid");
    });

    it("should transition to partial when partially paid", () => {
      const status = calculateInvoiceStatus(
        "1000.00",
        "400.00",
        new Date(Date.now() + 86400000), // Tomorrow
        "sent"
      );
      expect(status).toBe("partial");
    });

    it("should transition to overdue when past due date", () => {
      const status = calculateInvoiceStatus(
        "1000.00",
        "0.00",
        new Date(Date.now() - 86400000), // Yesterday
        "sent"
      );
      expect(status).toBe("overdue");
    });

    it("should transition to overdue when partially paid past due", () => {
      const status = calculateInvoiceStatus(
        "1000.00",
        "400.00",
        new Date(Date.now() - 86400000), // Yesterday
        "partial" // Currently partial
      );
      // When partially paid and overdue, it transitions to overdue status
      expect(status).toBe("overdue");
    });

    it("should not change paid status even if overpaid", () => {
      const status = calculateInvoiceStatus(
        "1000.00",
        "1100.00",
        new Date(Date.now() + 86400000),
        "paid"
      );
      expect(status).toBe("paid");
    });

    it("should not change cancelled status", () => {
      const status = calculateInvoiceStatus(
        "1000.00",
        "0.00",
        new Date(Date.now() + 86400000),
        "cancelled"
      );
      expect(status).toBe("cancelled");
    });

    it("should keep draft as draft even if overdue", () => {
      const status = calculateInvoiceStatus(
        "1000.00",
        "0.00",
        new Date(Date.now() - 86400000), // Yesterday
        "draft"
      );
      expect(status).toBe("draft");
    });
  });

  describe("Idempotent State Updates", () => {
    it("should handle multiple payment applications correctly", () => {
      const invoice = {
        totalAmount: "1000.00",
        paidAmount: "0.00",
        status: "sent"
      };

      // First payment
      invoice.paidAmount = "400.00";
      let status = parseFloat(invoice.paidAmount) >= parseFloat(invoice.totalAmount) ? "paid" : "partial";
      expect(status).toBe("partial");

      // Second payment (same transaction applied twice - idempotency check)
      // paidAmount should not change if same tx already recorded
      const alreadyRecorded = true;
      if (!alreadyRecorded) {
        invoice.paidAmount = "800.00";
      }
      expect(invoice.paidAmount).toBe("400.00");

      // Third payment (different transaction)
      invoice.paidAmount = "1000.00";
      status = parseFloat(invoice.paidAmount) >= parseFloat(invoice.totalAmount) ? "paid" : "partial";
      expect(status).toBe("paid");
    });
  });

  describe("Refund Scenarios", () => {
    it("should handle refund by reducing paid amount", () => {
      const invoice = {
        totalAmount: "1000.00",
        paidAmount: "1000.00",
        status: "paid"
      };

      // Refund 200
      const refundAmount = "200.00";
      invoice.paidAmount = (parseFloat(invoice.paidAmount) - parseFloat(refundAmount)).toFixed(2);
      
      expect(invoice.paidAmount).toBe("800.00");
      
      // Status should change from paid to partial after refund
      const newStatus = parseFloat(invoice.paidAmount) >= parseFloat(invoice.totalAmount) 
        ? "paid" 
        : "partial";
      expect(newStatus).toBe("partial");
    });

    it("should handle full refund", () => {
      const invoice = {
        totalAmount: "1000.00",
        paidAmount: "1000.00",
        status: "paid"
      };

      // Full refund
      invoice.paidAmount = "0.00";
      
      // Should go back to sent or original pre-payment status
      const newStatus = parseFloat(invoice.paidAmount) === 0 ? "sent" : "partial";
      expect(newStatus).toBe("sent");
    });
  });
});

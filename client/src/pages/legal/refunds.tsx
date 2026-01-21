/**
 * Refund Policy
 * Explains refund and dispute resolution procedures
 */

export default function RefundPolicy() {
    return (
        <div className="container max-w-4xl py-12 prose prose-slate dark:prose-invert">
            <h1>Refund Policy</h1>
            <p className="text-sm text-muted-foreground">
                Last updated: January 20, 2026
            </p>

            <h2>1. Overview</h2>
            <p>
                Due to the nature of blockchain transactions and cryptocurrency payments, refunds are handled
                differently than traditional payment systems. This policy explains our refund procedures.
            </p>

            <h2>2. Platform Fees</h2>

            <h3>2.1 Non-Refundable Fees</h3>
            <p>
                The following fees are <strong>non-refundable</strong>:
            </p>
            <ul>
                <li><strong>x402 Anti-Spam Fee ($0.015):</strong> Consumed upon invoice creation</li>
                <li><strong>Blockchain Network Fees:</strong> Paid to Solana validators</li>
                <li><strong>NFT Minting Fees:</strong> Permanent on-chain operations</li>
            </ul>

            <h3>2.2 Refundable Platform Fees</h3>
            <p>
                The <strong>1% platform fee</strong> may be refunded in the following cases:
            </p>
            <ul>
                <li>Service malfunction or downtime during payment processing</li>
                <li>Duplicate payment due to system error</li>
                <li>Incorrect fee calculation by the platform</li>
            </ul>
            <p>
                Refund requests must be submitted within 30 days of the transaction.
            </p>

            <h2>3. Invoice Payments</h2>

            <h3>3.1 Cryptocurrency Payments</h3>
            <p>
                <strong>Cryptocurrency payments are irreversible.</strong> Once a payment is confirmed on the
                Solana blockchain, it cannot be reversed by Invoix.
            </p>
            <p>
                Refunds for invoice payments must be arranged directly between the payer and payee:
            </p>
            <ul>
                <li>The payee can send a refund transaction to the payer's wallet</li>
                <li>Invoix can facilitate communication but cannot force refunds</li>
                <li>Disputed payments should be resolved between parties</li>
            </ul>

            <h3>3.2 Overpayments</h3>
            <p>
                If you overpay an invoice:
            </p>
            <ul>
                <li>The excess amount is recorded in the invoice</li>
                <li>The payee should refund the overpayment directly to your wallet</li>
                <li>Contact the payee to request a refund</li>
            </ul>

            <h2>4. Marketplace Transactions</h2>

            <h3>4.1 Invoice Purchases</h3>
            <p>
                When you purchase an invoice on the marketplace:
            </p>
            <ul>
                <li>Sales are final once the NFT is transferred</li>
                <li>You assume the risk of non-payment by the invoice customer</li>
                <li>No refunds are provided if the customer doesn't pay</li>
            </ul>

            <h3>4.2 Fraudulent Listings</h3>
            <p>
                If you purchase a fraudulent invoice listing:
            </p>
            <ul>
                <li>Report it immediately to support@invoix.com</li>
                <li>We will investigate and may ban the seller</li>
                <li>Refunds are at our discretion and depend on recovery of funds</li>
            </ul>

            <h2>5. Subscription Refunds</h2>
            <p>
                For recurring subscriptions:
            </p>
            <ul>
                <li>You can cancel at any time to stop future charges</li>
                <li>No refunds for partial billing periods</li>
                <li>Unused subscription time is forfeited upon cancellation</li>
            </ul>

            <h2>6. Service Errors</h2>
            <p>
                If Invoix makes an error that results in financial loss:
            </p>
            <ul>
                <li>We will investigate the issue promptly</li>
                <li>Refunds will be issued if we determine the error was our fault</li>
                <li>Refunds are limited to the amount of the error</li>
                <li>We are not liable for consequential damages</li>
            </ul>

            <h2>7. Dispute Resolution</h2>

            <h3>7.1 Internal Disputes</h3>
            <p>
                For disputes between users (payer and payee):
            </p>
            <ol>
                <li>Attempt to resolve directly with the other party</li>
                <li>Contact support@invoix.com for mediation assistance</li>
                <li>We can provide transaction records but cannot force refunds</li>
            </ol>

            <h3>7.2 Disputes with Invoix</h3>
            <p>
                For disputes with Invoix:
            </p>
            <ol>
                <li>Email support@invoix.com with details and evidence</li>
                <li>We will investigate within 5 business days</li>
                <li>If unresolved, you may pursue arbitration per our Terms of Service</li>
            </ol>

            <h2>8. Refund Process</h2>
            <p>
                To request a refund for eligible fees:
            </p>
            <ol>
                <li>Email support@invoix.com with:
                    <ul>
                        <li>Your wallet address</li>
                        <li>Transaction signature</li>
                        <li>Reason for refund request</li>
                        <li>Supporting evidence (screenshots, etc.)</li>
                    </ul>
                </li>
                <li>We will review your request within 5 business days</li>
                <li>If approved, refunds are sent to your wallet within 10 business days</li>
            </ol>

            <h2>9. Chargebacks</h2>
            <p>
                <strong>Cryptocurrency transactions cannot be charged back.</strong> Unlike credit cards,
                blockchain transactions are final and irreversible.
            </p>

            <h2>10. Contact Information</h2>
            <p>
                For refund requests or questions:
            </p>
            <ul>
                <li><strong>Email:</strong> support@invoix.com</li>
                <li><strong>Discord:</strong> [Discord Server Link]</li>
                <li><strong>Response Time:</strong> Within 5 business days</li>
            </ul>

            <hr className="my-8" />

            <p className="text-sm text-muted-foreground">
                This Refund Policy is subject to change. Please review periodically for updates.
            </p>
        </div>
    );
}

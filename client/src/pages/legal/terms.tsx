/**
 * Terms of Service
 * Legal agreement between Invoix and users
 */

export default function TermsOfService() {
    return (
        <div className="container max-w-4xl py-12 prose prose-slate dark:prose-invert">
            <h1>Terms of Service</h1>
            <p className="text-sm text-muted-foreground">
                Last updated: January 20, 2026
            </p>

            <h2>1. Acceptance of Terms</h2>
            <p>
                By accessing or using Invoix ("the Service"), you agree to be bound by these Terms of Service.
                If you do not agree to these terms, please do not use the Service.
            </p>

            <h2>2. Description of Service</h2>
            <p>
                Invoix is a decentralized invoicing platform built on the Solana blockchain that enables businesses
                to create, send, and manage invoices with cryptocurrency payments. The Service includes:
            </p>
            <ul>
                <li>Invoice creation and management</li>
                <li>Cryptocurrency payment processing (USDC, EURC, SOL)</li>
                <li>NFT-based invoice receipts</li>
                <li>Invoice marketplace for factoring</li>
                <li>Subscription billing</li>
                <li>Credit scoring for businesses</li>
            </ul>

            <h2>3. User Accounts and Wallet Authentication</h2>
            <p>
                To use the Service, you must connect a Solana-compatible wallet. You are responsible for:
            </p>
            <ul>
                <li>Maintaining the security of your wallet and private keys</li>
                <li>All activities that occur under your wallet address</li>
                <li>Ensuring your wallet has sufficient funds for transactions</li>
            </ul>
            <p>
                <strong>Important:</strong> Invoix does not have access to your private keys and cannot recover
                lost wallets or funds.
            </p>

            <h2>4. Fees and Payments</h2>
            <p>
                The Service charges the following fees:
            </p>
            <ul>
                <li><strong>Platform Fee:</strong> 1% of invoice total (deducted from payments)</li>
                <li><strong>x402 Anti-Spam Fee:</strong> $0.015 USD per invoice creation</li>
                <li><strong>Blockchain Fees:</strong> Standard Solana network fees apply</li>
                <li><strong>NFT Minting:</strong> Optional, user-paid</li>
            </ul>
            <p>
                All fees are non-refundable except in cases of Service error or malfunction.
            </p>

            <h2>5. Cryptocurrency Risks</h2>
            <p>
                You acknowledge and accept the following risks associated with cryptocurrency transactions:
            </p>
            <ul>
                <li>Price volatility of cryptocurrencies</li>
                <li>Irreversibility of blockchain transactions</li>
                <li>Potential for network congestion or delays</li>
                <li>Smart contract risks and potential bugs</li>
            </ul>
            <p>
                <strong>Invoix is not responsible for losses due to cryptocurrency price fluctuations or
                    blockchain network issues.</strong>
            </p>

            <h2>6. Prohibited Uses</h2>
            <p>
                You agree not to use the Service for:
            </p>
            <ul>
                <li>Illegal activities or money laundering</li>
                <li>Fraudulent invoices or payments</li>
                <li>Spam or unsolicited commercial messages</li>
                <li>Violating intellectual property rights</li>
                <li>Circumventing security measures</li>
                <li>Automated abuse or bot activity</li>
            </ul>

            <h2>7. Invoice Marketplace</h2>
            <p>
                The invoice marketplace allows users to sell invoices before payment (factoring). By using
                the marketplace, you agree that:
            </p>
            <ul>
                <li>All listings are accurate and not fraudulent</li>
                <li>You have the right to sell the invoice</li>
                <li>Buyers assume the risk of non-payment</li>
                <li>Invoix is not a party to marketplace transactions</li>
            </ul>

            <h2>8. Data and Privacy</h2>
            <p>
                Your use of the Service is also governed by our <a href="/legal/privacy">Privacy Policy</a>.
                We collect minimal data and respect your privacy rights under GDPR and CCPA.
            </p>

            <h2>9. Intellectual Property</h2>
            <p>
                The Service and its original content, features, and functionality are owned by Invoix and are
                protected by international copyright, trademark, and other intellectual property laws.
            </p>

            <h2>10. Disclaimer of Warranties</h2>
            <p>
                THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. INVOIX
                DISCLAIMS ALL WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
                NON-INFRINGEMENT.
            </p>

            <h2>11. Limitation of Liability</h2>
            <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, INVOIX SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
                SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR CRYPTOCURRENCY.
            </p>
            <p>
                OUR TOTAL LIABILITY SHALL NOT EXCEED THE FEES YOU PAID TO US IN THE 12 MONTHS PRECEDING THE CLAIM.
            </p>

            <h2>12. Indemnification</h2>
            <p>
                You agree to indemnify and hold harmless Invoix from any claims, damages, or expenses arising
                from your use of the Service or violation of these Terms.
            </p>

            <h2>13. Termination</h2>
            <p>
                We may terminate or suspend your access to the Service immediately, without prior notice, for
                any violation of these Terms or for any other reason.
            </p>

            <h2>14. Governing Law</h2>
            <p>
                These Terms shall be governed by and construed in accordance with the laws of [Jurisdiction],
                without regard to its conflict of law provisions.
            </p>

            <h2>15. Changes to Terms</h2>
            <p>
                We reserve the right to modify these Terms at any time. We will notify users of material changes
                via email or Service notification. Continued use after changes constitutes acceptance.
            </p>

            <h2>16. Contact Information</h2>
            <p>
                For questions about these Terms, please contact us at:
            </p>
            <ul>
                <li>Email: legal@invoix.com</li>
                <li>Discord: [Discord Server Link]</li>
            </ul>

            <hr className="my-8" />

            <p className="text-sm text-muted-foreground">
                By using Invoix, you acknowledge that you have read, understood, and agree to be bound by
                these Terms of Service.
            </p>
        </div>
    );
}

/**
 * Privacy Policy
 * GDPR and CCPA compliant privacy policy
 */

export default function PrivacyPolicy() {
    return (
        <div className="container max-w-4xl py-12 prose prose-slate dark:prose-invert">
            <h1>Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">
                Last updated: January 20, 2026
            </p>

            <h2>1. Introduction</h2>
            <p>
                Invoix ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy
                explains how we collect, use, disclose, and safeguard your information when you use our Service.
            </p>
            <p>
                <strong>We are GDPR and CCPA compliant.</strong> You have the right to access, correct, delete,
                and export your personal data at any time.
            </p>

            <h2>2. Information We Collect</h2>

            <h3>2.1 Wallet Information</h3>
            <p>
                When you connect your wallet, we collect:
            </p>
            <ul>
                <li>Your Solana wallet address (public key)</li>
                <li>Transaction signatures for authentication</li>
                <li>Blockchain transaction history related to invoices</li>
            </ul>
            <p>
                <strong>We never collect or store your private keys.</strong>
            </p>

            <h3>2.2 Invoice Data</h3>
            <p>
                When you create invoices, we collect:
            </p>
            <ul>
                <li>Invoice details (amount, currency, description, line items)</li>
                <li>Customer information (wallet address, optional email)</li>
                <li>Payment information (transaction signatures, amounts)</li>
                <li>Business profile information (name, logo, tax ID)</li>
            </ul>

            <h3>2.3 Usage Data</h3>
            <p>
                We automatically collect:
            </p>
            <ul>
                <li>IP address (hashed for privacy)</li>
                <li>Browser type and version</li>
                <li>Pages visited and time spent</li>
                <li>Error logs and performance metrics</li>
            </ul>

            <h3>2.4 Cookies and Tracking</h3>
            <p>
                We use essential cookies for:
            </p>
            <ul>
                <li>Session management and authentication</li>
                <li>Security and fraud prevention</li>
                <li>Performance monitoring</li>
            </ul>
            <p>
                See our <a href="/legal/cookies">Cookie Policy</a> for details.
            </p>

            <h2>3. How We Use Your Information</h2>
            <p>
                We use your information to:
            </p>
            <ul>
                <li>Provide and maintain the Service</li>
                <li>Process invoices and payments</li>
                <li>Calculate credit scores for marketplace</li>
                <li>Send transactional emails (invoice notifications)</li>
                <li>Prevent fraud and ensure security</li>
                <li>Comply with legal obligations</li>
                <li>Improve our Service through analytics</li>
            </ul>

            <h2>4. Data Sharing and Disclosure</h2>

            <h3>4.1 Third-Party Services</h3>
            <p>
                We share data with:
            </p>
            <ul>
                <li><strong>Solana Blockchain:</strong> All transactions are public on-chain</li>
                <li><strong>Email Provider:</strong> For invoice notifications (if enabled)</li>
                <li><strong>Sentry:</strong> For error monitoring (anonymized)</li>
                <li><strong>Railway/Neon:</strong> Database hosting (encrypted)</li>
            </ul>

            <h3>4.2 Legal Requirements</h3>
            <p>
                We may disclose your information if required by law, court order, or government request.
            </p>

            <h3>4.3 Business Transfers</h3>
            <p>
                In the event of a merger, acquisition, or sale of assets, your information may be transferred.
                We will notify you before your data is transferred and becomes subject to a different Privacy Policy.
            </p>

            <h2>5. Data Security</h2>
            <p>
                We implement industry-standard security measures:
            </p>
            <ul>
                <li>HTTPS/TLS encryption for all data in transit</li>
                <li>Database encryption at rest</li>
                <li>API key hashing (SHA-256)</li>
                <li>Rate limiting and DDoS protection</li>
                <li>Regular security audits</li>
                <li>Replay attack prevention</li>
            </ul>
            <p>
                <strong>However, no method of transmission over the Internet is 100% secure.</strong> We cannot
                guarantee absolute security.
            </p>

            <h2>6. Data Retention</h2>
            <p>
                We retain your data for:
            </p>
            <ul>
                <li><strong>Active accounts:</strong> As long as you use the Service</li>
                <li><strong>Financial records:</strong> 7 years for tax compliance</li>
                <li><strong>Deleted accounts:</strong> Anonymized within 30 days</li>
                <li><strong>Blockchain data:</strong> Permanent (public ledger)</li>
            </ul>

            <h2>7. Your Privacy Rights</h2>

            <h3>7.1 GDPR Rights (EU Users)</h3>
            <p>
                You have the right to:
            </p>
            <ul>
                <li><strong>Access:</strong> Request a copy of your data</li>
                <li><strong>Rectification:</strong> Correct inaccurate data</li>
                <li><strong>Erasure:</strong> Delete your data ("right to be forgotten")</li>
                <li><strong>Portability:</strong> Export your data in JSON format</li>
                <li><strong>Restriction:</strong> Limit how we process your data</li>
                <li><strong>Objection:</strong> Object to data processing</li>
            </ul>

            <h3>7.2 CCPA Rights (California Users)</h3>
            <p>
                California residents have the right to:
            </p>
            <ul>
                <li>Know what personal information is collected</li>
                <li>Know whether personal information is sold or disclosed</li>
                <li>Say no to the sale of personal information</li>
                <li>Access your personal information</li>
                <li>Request deletion of personal information</li>
                <li>Not be discriminated against for exercising your rights</li>
            </ul>
            <p>
                <strong>We do not sell your personal information.</strong>
            </p>

            <h3>7.3 Exercising Your Rights</h3>
            <p>
                To exercise your privacy rights:
            </p>
            <ul>
                <li><strong>Data Export:</strong> Visit Settings → Privacy → Export My Data</li>
                <li><strong>Data Deletion:</strong> Visit Settings → Privacy → Delete My Data</li>
                <li><strong>Email:</strong> privacy@invoix.com</li>
            </ul>
            <p>
                We will respond to your request within 30 days.
            </p>

            <h2>8. Children's Privacy</h2>
            <p>
                Our Service is not intended for users under 18 years of age. We do not knowingly collect
                personal information from children. If you believe we have collected data from a child,
                please contact us immediately.
            </p>

            <h2>9. International Data Transfers</h2>
            <p>
                Your information may be transferred to and processed in countries other than your own.
                We ensure appropriate safeguards are in place for international transfers, including
                Standard Contractual Clauses (SCCs) for EU data.
            </p>

            <h2>10. Changes to This Privacy Policy</h2>
            <p>
                We may update this Privacy Policy from time to time. We will notify you of material changes
                via email or Service notification. The "Last updated" date at the top will be revised.
            </p>

            <h2>11. Contact Us</h2>
            <p>
                For privacy-related questions or to exercise your rights:
            </p>
            <ul>
                <li><strong>Email:</strong> privacy@invoix.com</li>
                <li><strong>Data Protection Officer:</strong> dpo@invoix.com</li>
                <li><strong>Discord:</strong> [Discord Server Link]</li>
            </ul>

            <hr className="my-8" />

            <p className="text-sm text-muted-foreground">
                By using Invoix, you consent to the collection and use of information in accordance with
                this Privacy Policy.
            </p>
        </div>
    );
}

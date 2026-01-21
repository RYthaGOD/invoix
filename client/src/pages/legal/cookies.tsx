/**
 * Cookie Policy
 * Explains cookie usage and tracking
 */

export default function CookiePolicy() {
    return (
        <div className="container max-w-4xl py-12 prose prose-slate dark:prose-invert">
            <h1>Cookie Policy</h1>
            <p className="text-sm text-muted-foreground">
                Last updated: January 20, 2026
            </p>

            <h2>1. What Are Cookies?</h2>
            <p>
                Cookies are small text files stored on your device when you visit a website. They help
                websites remember your preferences and improve your experience.
            </p>

            <h2>2. How We Use Cookies</h2>
            <p>
                Invoix uses cookies for essential functionality only. We do not use advertising or tracking cookies.
            </p>

            <h3>2.1 Essential Cookies</h3>
            <p>
                These cookies are necessary for the Service to function:
            </p>
            <ul>
                <li><strong>Session Cookie (connect.sid):</strong> Maintains your login session</li>
                <li><strong>CSRF Token:</strong> Prevents cross-site request forgery attacks</li>
                <li><strong>Wallet Connection:</strong> Remembers your connected wallet</li>
            </ul>
            <p>
                <strong>These cookies cannot be disabled</strong> as they are required for security and functionality.
            </p>

            <h3>2.2 Performance Cookies</h3>
            <p>
                We use minimal performance monitoring:
            </p>
            <ul>
                <li><strong>Error Tracking (Sentry):</strong> Helps us fix bugs and improve stability</li>
                <li><strong>Analytics:</strong> Privacy-preserving usage statistics (no personal data)</li>
            </ul>
            <p>
                All performance data is anonymized and aggregated.
            </p>

            <h2>3. Third-Party Cookies</h2>
            <p>
                We do not use third-party advertising cookies. The only third-party cookies are from:
            </p>
            <ul>
                <li><strong>Sentry:</strong> Error monitoring (anonymized)</li>
                <li><strong>Railway/Neon:</strong> Infrastructure (no tracking)</li>
            </ul>

            <h2>4. Cookie Duration</h2>
            <ul>
                <li><strong>Session Cookies:</strong> Deleted when you close your browser</li>
                <li><strong>Persistent Cookies:</strong> Expire after 30 days of inactivity</li>
            </ul>

            <h2>5. Managing Cookies</h2>
            <p>
                You can control cookies through your browser settings:
            </p>
            <ul>
                <li><strong>Chrome:</strong> Settings → Privacy and Security → Cookies</li>
                <li><strong>Firefox:</strong> Settings → Privacy & Security → Cookies</li>
                <li><strong>Safari:</strong> Preferences → Privacy → Cookies</li>
                <li><strong>Edge:</strong> Settings → Cookies and Site Permissions</li>
            </ul>
            <p>
                <strong>Warning:</strong> Disabling essential cookies will prevent you from using the Service.
            </p>

            <h2>6. Do Not Track</h2>
            <p>
                We respect "Do Not Track" (DNT) browser signals. When DNT is enabled, we disable all
                non-essential tracking.
            </p>

            <h2>7. Updates to This Policy</h2>
            <p>
                We may update this Cookie Policy to reflect changes in our practices or for legal reasons.
                Check this page periodically for updates.
            </p>

            <h2>8. Contact Us</h2>
            <p>
                Questions about our cookie usage? Contact us at privacy@invoix.com
            </p>

            <hr className="my-8" />

            <p className="text-sm text-muted-foreground">
                By continuing to use Invoix, you consent to our use of essential cookies as described in
                this policy.
            </p>
        </div>
    );
}

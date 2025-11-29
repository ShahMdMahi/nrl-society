import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy - NRL Society",
  description: "Privacy Policy for NRL Society",
};

export default function PrivacyPage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Button variant="ghost" className="mb-8" asChild>
          <Link href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>

        <h1 className="mb-8 text-3xl font-bold">Privacy Policy</h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <p className="text-muted-foreground">
            Last updated: November 29, 2025
          </p>

          <h2 className="mt-8 text-xl font-semibold">1. Introduction</h2>
          <p>
            Welcome to NRL Society. We respect your privacy and are committed to
            protecting your personal data. This privacy policy explains how we
            collect, use, and safeguard your information when you use our
            service.
          </p>

          <h2 className="mt-8 text-xl font-semibold">
            2. Information We Collect
          </h2>

          <h3 className="mt-6 text-lg font-medium">
            2.1 Information You Provide
          </h3>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Account Information:</strong> Name, email address,
              username, and password when you register
            </li>
            <li>
              <strong>Profile Information:</strong> Bio, profile picture, cover
              photo, and other optional details
            </li>
            <li>
              <strong>Content:</strong> Posts, comments, messages, and media you
              share
            </li>
            <li>
              <strong>Communications:</strong> Messages you send to other users
              or to us
            </li>
          </ul>

          <h3 className="mt-6 text-lg font-medium">
            2.2 Information Collected Automatically
          </h3>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Usage Data:</strong> How you interact with the Service
            </li>
            <li>
              <strong>Device Information:</strong> Browser type, operating
              system, device identifiers
            </li>
            <li>
              <strong>Log Data:</strong> IP address, access times, pages viewed
            </li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold">
            3. How We Use Your Information
          </h2>
          <p>We use your information to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Provide and maintain the Service</li>
            <li>Create and manage your account</li>
            <li>Enable you to connect with other users</li>
            <li>Send notifications and updates</li>
            <li>Improve and personalize your experience</li>
            <li>Ensure security and prevent fraud</li>
            <li>Comply with legal obligations</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold">4. Information Sharing</h2>
          <p>We may share your information with:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Other Users:</strong> Your profile and public content are
              visible to other users
            </li>
            <li>
              <strong>Service Providers:</strong> Third parties who help us
              operate the Service (e.g., hosting, email)
            </li>
            <li>
              <strong>Legal Requirements:</strong> When required by law or to
              protect our rights
            </li>
          </ul>
          <p className="mt-4">
            We do not sell your personal information to third parties.
          </p>

          <h2 className="mt-8 text-xl font-semibold">
            5. Data Storage and Security
          </h2>
          <p>
            Your data is stored securely using industry-standard encryption and
            security measures. We use Cloudflare&apos;s infrastructure for
            hosting and data storage. While we strive to protect your
            information, no method of transmission over the Internet is 100%
            secure.
          </p>

          <h2 className="mt-8 text-xl font-semibold">6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Delete your account and data</li>
            <li>Export your data</li>
            <li>Opt out of marketing communications</li>
            <li>Control your privacy settings</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold">
            7. Cookies and Tracking
          </h2>
          <p>
            We use cookies and similar technologies to maintain your session,
            remember your preferences, and improve our service. You can control
            cookie settings through your browser.
          </p>

          <h2 className="mt-8 text-xl font-semibold">
            8. Children&apos;s Privacy
          </h2>
          <p>
            Our Service is not intended for children under 13. We do not
            knowingly collect information from children under 13. If we learn we
            have collected such information, we will delete it.
          </p>

          <h2 className="mt-8 text-xl font-semibold">
            9. International Data Transfers
          </h2>
          <p>
            Your information may be transferred to and processed in countries
            other than your own. We ensure appropriate safeguards are in place
            for such transfers.
          </p>

          <h2 className="mt-8 text-xl font-semibold">
            10. Changes to This Policy
          </h2>
          <p>
            We may update this privacy policy from time to time. We will notify
            you of significant changes by posting a notice on our Service or
            sending you an email.
          </p>

          <h2 className="mt-8 text-xl font-semibold">11. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or your data, please
            contact us at:
          </p>
          <ul className="mt-4 list-none space-y-1 pl-0">
            <li>Email: privacy@nrlsociety.com</li>
            <li>Support: support@nrlsociety.com</li>
          </ul>
        </div>

        <div className="mt-12 border-t pt-8">
          <p className="text-muted-foreground text-sm">
            By using NRL Society, you acknowledge that you have read and
            understood this Privacy Policy and consent to the collection and use
            of your information as described.
          </p>
        </div>
      </div>
    </div>
  );
}

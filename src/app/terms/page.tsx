import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service - NRL Society",
  description: "Terms of Service for NRL Society",
};

export default function TermsPage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Button variant="ghost" className="mb-8" asChild>
          <Link href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>

        <h1 className="mb-8 text-3xl font-bold">Terms of Service</h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <p className="text-muted-foreground">
            Last updated: November 29, 2025
          </p>

          <h2 className="mt-8 text-xl font-semibold">1. Acceptance of Terms</h2>
          <p>
            By accessing or using NRL Society (&quot;the Service&quot;), you
            agree to be bound by these Terms of Service. If you do not agree to
            these terms, please do not use the Service.
          </p>

          <h2 className="mt-8 text-xl font-semibold">
            2. Description of Service
          </h2>
          <p>
            NRL Society is a social networking platform that allows users to
            connect, share content, and interact with each other. We reserve the
            right to modify, suspend, or discontinue the Service at any time.
          </p>

          <h2 className="mt-8 text-xl font-semibold">3. User Accounts</h2>
          <p>To use certain features of the Service, you must:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Be at least 13 years old</li>
            <li>Provide accurate and complete registration information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Notify us immediately of any unauthorized access</li>
          </ul>
          <p className="mt-4">
            You are responsible for all activities that occur under your
            account.
          </p>

          <h2 className="mt-8 text-xl font-semibold">4. User Content</h2>
          <p>
            You retain ownership of content you post. By posting content, you
            grant us a non-exclusive, worldwide, royalty-free license to use,
            display, and distribute your content on the Service.
          </p>
          <p className="mt-4">You agree not to post content that:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Is illegal, harmful, or offensive</li>
            <li>Infringes on intellectual property rights</li>
            <li>Contains malware or harmful code</li>
            <li>Harasses, threatens, or bullies others</li>
            <li>Is spam or unauthorized advertising</li>
            <li>Impersonates others or is misleading</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold">
            5. Prohibited Activities
          </h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Violate any applicable laws or regulations</li>
            <li>Attempt to gain unauthorized access to the Service</li>
            <li>Interfere with or disrupt the Service</li>
            <li>
              Use automated systems to access the Service without permission
            </li>
            <li>Collect user information without consent</li>
          </ul>

          <h2 className="mt-8 text-xl font-semibold">6. Termination</h2>
          <p>
            We may terminate or suspend your account at any time for violations
            of these terms or for any other reason. Upon termination, your right
            to use the Service will immediately cease.
          </p>

          <h2 className="mt-8 text-xl font-semibold">7. Disclaimers</h2>
          <p>
            The Service is provided &quot;as is&quot; without warranties of any
            kind. We do not guarantee that the Service will be uninterrupted,
            secure, or error-free.
          </p>

          <h2 className="mt-8 text-xl font-semibold">
            8. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by law, NRL Society shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages resulting from your use of the Service.
          </p>

          <h2 className="mt-8 text-xl font-semibold">9. Changes to Terms</h2>
          <p>
            We may update these terms from time to time. We will notify users of
            significant changes. Continued use of the Service after changes
            constitutes acceptance of the new terms.
          </p>

          <h2 className="mt-8 text-xl font-semibold">10. Contact Us</h2>
          <p>
            If you have questions about these Terms of Service, please contact
            us at support@nrlsociety.com.
          </p>
        </div>

        <div className="mt-12 border-t pt-8">
          <p className="text-muted-foreground text-sm">
            By using NRL Society, you acknowledge that you have read and
            understood these Terms of Service and agree to be bound by them.
          </p>
        </div>
      </div>
    </div>
  );
}

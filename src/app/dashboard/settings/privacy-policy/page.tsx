'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function Bullet({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex gap-2 text-sm text-gray-600">
      <span className="text-[#050A30] font-semibold shrink-0">•</span>
      <p><span className="font-semibold text-gray-800">{label}:</span> {text}</p>
    </div>
  );
}

export default function PrivacyPolicyPage() {
  const [accepted, setAccepted] = useState(
    typeof window !== 'undefined' && localStorage.getItem('privacyAccepted') === 'true'
  );

  const handleAccept = () => {
    if (accepted) return;
    setAccepted(true);
    localStorage.setItem('privacyAccepted', 'true');
  };

  return (
    <div className="max-w-2xl space-y-6 pb-12 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-xs text-gray-400">Effective Date: April 24, 2026</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-6">
        <p className="text-sm text-gray-600 leading-relaxed">
          At EasePay, we are committed to protecting your privacy and the security of your personal and business information. This Privacy Policy outlines how EasePay — an invoicing, sales, expenses, and report-generating application — collects, uses, processes, and shares your information when you use our services.
        </p>

        <Section title="1. Scope of this Privacy Policy">
          <p>This Privacy Policy applies to all information collected through your use of the EasePay application, our website, and any related services (collectively, "Services"). It covers information pertaining to you, your customers, your employees, and any other individuals or entities with whom you interact through our Services.</p>
        </Section>

        <Section title="2. Information We Collect">
          <p>We collect various types of information to provide and improve our Services:</p>
          <p className="font-semibold text-gray-800 mt-2">2.1. Information You Provide Directly</p>
          <p>When you register for an EasePay account, use our Services, or communicate with us, you may provide:</p>
          <div className="space-y-1.5 mt-1">
            <Bullet label="Account Information" text="Your name, email address, phone number, physical address, and login credentials." />
            <Bullet label="Business Information" text="Your business name, legal structure, industry, tax identification numbers, and other business registration details." />
            <Bullet label="Financial Data" text="Bank account details, transaction records, invoices, expense details, sales data, and financial documents." />
            <Bullet label="Customer and Employee Data" text="Information about your customers and employees that you input into EasePay." />
            <Bullet label="Communications" text="Records of your communications with us, including support inquiries and feedback." />
          </div>
          <p className="font-semibold text-gray-800 mt-3">2.2. Information Collected Automatically</p>
          <div className="space-y-1.5 mt-1">
            <Bullet label="Device Information" text="IP address, operating system, browser type, device identifiers, and mobile network information." />
            <Bullet label="Usage Data" text="Information about how you interact with EasePay, such as features used, pages viewed, and time spent." />
            <Bullet label="Cookies" text="We use cookies and similar technologies to enhance your experience and analyze trends." />
          </div>
        </Section>

        <Section title="3. How We Use Your Information">
          <p>We use the collected information to:</p>
          <div className="space-y-1.5 mt-1">
            <Bullet label="Service Delivery" text="Provide, operate, and maintain our Services." />
            <Bullet label="Personalisation" text="Tailor the experience to your business needs." />
            <Bullet label="Analytics" text="Understand usage patterns and improve features." />
            <Bullet label="Security" text="Detect and prevent fraud and unauthorized access." />
            <Bullet label="Communication" text="Send service updates, support messages, and promotions (with opt-out)." />
          </div>
        </Section>

        <Section title="4. Data Sharing & Disclosure">
          <p>We do not sell your personal information. We may share information with:</p>
          <div className="space-y-1.5 mt-1">
            <Bullet label="Service Providers" text="Trusted third-party vendors who assist in delivering our Services (payment processors, cloud storage, analytics)." />
            <Bullet label="Legal Requirements" text="When required by law, regulation, or legal process." />
            <Bullet label="Business Transfers" text="In connection with a merger, acquisition, or sale of assets." />
          </div>
        </Section>

        <Section title="5. Data Security">
          <p>We implement industry-standard security measures including encryption in transit (TLS) and at rest, access controls, and regular security assessments. However, no method of transmission over the internet is 100% secure.</p>
        </Section>

        <Section title="6. Your Rights">
          <p>Depending on your jurisdiction, you may have the right to access, correct, delete, or export your personal data. Contact us at <a href="mailto:wecare@easetack.com" className="text-[#3B82F6] underline">wecare@easetack.com</a> to exercise these rights.</p>
        </Section>

        <Section title="7. Data Retention">
          <p>We retain your data for as long as your account is active or as needed to provide Services, comply with legal obligations, resolve disputes, and enforce our agreements.</p>
        </Section>

        <Section title="8. Changes to this Policy">
          <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy in the app or via email. Your continued use of EasePay after changes constitutes acceptance of the updated policy.</p>
        </Section>

        <Section title="9. Contact Us">
          <p>If you have questions about this Privacy Policy, please contact us at <a href="mailto:wecare@easetack.com" className="text-[#3B82F6] underline">wecare@easetack.com</a>.</p>
        </Section>
      </div>

      {/* Accept checkbox — same as mobile */}
      <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4">
        <input
          type="checkbox"
          id="pp-accept"
          checked={accepted}
          onChange={handleAccept}
          disabled={accepted}
          className="mt-0.5 w-4 h-4 accent-[#050A30] cursor-pointer disabled:cursor-default"
        />
        <label htmlFor="pp-accept" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
          {accepted ? '✅ You have accepted the Privacy Policy.' : 'I have read and acknowledge the Privacy Policy.'}
        </label>
      </div>
    </div>
  );
}

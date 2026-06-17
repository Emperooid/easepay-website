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

export default function TermsOfServicePage() {
  const [accepted, setAccepted] = useState(
    typeof window !== 'undefined' && localStorage.getItem('termsAccepted') === 'true'
  );

  const handleAccept = () => {
    if (accepted) return;
    setAccepted(true);
    localStorage.setItem('termsAccepted', 'true');
  };

  return (
    <div className="max-w-2xl space-y-6 pb-12 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Terms of Service</h1>
          <p className="text-xs text-gray-400">EaseTack Limited · EasePay</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Welcome To EasePay</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            EaseTack Limited ("EaseTack") is a duly registered business by the Corporate Affairs Commission in Nigeria ("CAC") and provides Software services and other Media services.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mt-2">
            The following terminology applies to these Terms of Use, privacy policy, and all agreements: "Business Owner", "You" and "Your" refers to any individual or entity that accepts this Terms of Use to utilize the business management tools. The "Company", "EaseTack", "We", "Our" and "Us" refers to EaseTack.
          </p>
        </div>

        <Section title="1. General">
          <p>1.1 These Terms of Use is a contract between the Business Owner and EaseTack and outlines the rules and regulations for access and use of the EasePay Services.</p>
          <p>1.2 By accessing the EasePay Services, You represent that You have read and understood these Terms of Use and You agree to be bound by them.</p>
          <p>1.3 You must be at least 18 years old to use EasePay. By using the Services, you confirm you meet this requirement.</p>
        </Section>

        <Section title="2. Acceptable Use">
          <p>2.1 You agree to use EasePay only for lawful business purposes and in compliance with all applicable laws and regulations.</p>
          <p>2.2 You must not use EasePay to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Conduct fraudulent or illegal activities</li>
            <li>Infringe upon the intellectual property rights of others</li>
            <li>Transmit harmful, offensive, or disruptive content</li>
            <li>Attempt to gain unauthorized access to systems</li>
            <li>Violate any applicable laws or regulations</li>
          </ul>
        </Section>

        <Section title="3. Account Responsibilities">
          <p>3.1 You are responsible for maintaining the confidentiality of your account credentials and PIN.</p>
          <p>3.2 You are responsible for all activities that occur under your account.</p>
          <p>3.3 You must immediately notify EaseTack of any unauthorized use of your account.</p>
        </Section>

        <Section title="4. Intellectual Property">
          <p>4.1 EasePay and its original content, features and functionality are and will remain the exclusive property of EaseTack Limited.</p>
          <p>4.2 You retain ownership of data you input into EasePay. By using the Services, you grant EaseTack a limited license to process your data to provide the Services.</p>
        </Section>

        <Section title="5. Payment & Subscriptions">
          <p>5.1 Some features require a paid subscription. Subscription fees are billed in advance on a monthly or annual basis.</p>
          <p>5.2 All payments are processed securely through third-party payment processors.</p>
          <p>5.3 Subscription fees are non-refundable except where required by law.</p>
          <p>5.4 EaseTack reserves the right to change subscription fees with 30 days notice.</p>
        </Section>

        <Section title="6. Privacy">
          <p>Your use of EasePay is also governed by our Privacy Policy, which is incorporated into these Terms by reference.</p>
        </Section>

        <Section title="7. Limitation of Liability">
          <p>7.1 EaseTack shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Services.</p>
          <p>7.2 EaseTack's total liability shall not exceed the amount you paid for the Services in the 12 months preceding the claim.</p>
        </Section>

        <Section title="8. Termination">
          <p>8.1 EaseTack may terminate or suspend your account at any time for violation of these Terms.</p>
          <p>8.2 You may terminate your account at any time by contacting support.</p>
          <p>8.3 Upon termination, your right to use the Services will cease immediately.</p>
        </Section>

        <Section title="9. Governing Law">
          <p>These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria, without regard to conflict of law provisions.</p>
        </Section>

        <Section title="10. Contact">
          <p>For questions about these Terms, contact us at <a href="mailto:wecare@easetack.com" className="text-[#3B82F6] underline">wecare@easetack.com</a>.</p>
        </Section>
      </div>

      {/* Accept checkbox — same as mobile */}
      <div className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl p-4">
        <input
          type="checkbox"
          id="tos-accept"
          checked={accepted}
          onChange={handleAccept}
          disabled={accepted}
          className="mt-0.5 w-4 h-4 accent-[#050A30] cursor-pointer disabled:cursor-default"
        />
        <label htmlFor="tos-accept" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
          {accepted ? '✅ You have accepted the Terms of Service.' : 'I have read and agree to the Terms of Service.'}
        </label>
      </div>
    </div>
  );
}

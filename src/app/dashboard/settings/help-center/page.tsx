'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Mail } from 'lucide-react';

function EmailIcon() {
  return <Mail size={20} className="text-gray-600" />;
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="url(#ig-grad)">
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F58529" />
          <stop offset="50%" stopColor="#DD2A7B" />
          <stop offset="100%" stopColor="#8134AF" />
        </linearGradient>
      </defs>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#000000">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.26 8.26 0 004.83 1.54V6.78a4.85 4.85 0 01-1.06-.09z"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#000000">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.254 5.622 5.91-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

const LINKS = [
  { label: 'wecare@easetack.com', href: 'mailto:wecare@easetack.com', Icon: EmailIcon,   bg: 'bg-gray-100' },
  { label: 'Facebook',            href: 'https://facebook.com/EasePayTech', Icon: FacebookIcon, bg: 'bg-[#E7F0FD]' },
  { label: 'Instagram',           href: 'https://instagram.com/ease_pay',   Icon: InstagramIcon, bg: 'bg-gradient-to-br from-orange-50 to-pink-50' },
  { label: 'TikTok',              href: 'https://tiktok.com/@ease_pay',     Icon: TikTokIcon,   bg: 'bg-gray-100' },
  { label: 'X (Twitter)',         href: 'https://x.com/EasePay_',           Icon: XIcon,        bg: 'bg-gray-100' },
];

export default function HelpCenterPage() {
  return (
    <div className="max-w-md space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-gray-900">Help Center</h1>
          <p className="text-xs text-gray-400">Get in touch or follow us</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {LINKS.map(({ label, href, Icon, bg }) => (
          <a
            key={label}
            href={href}
            target={href.startsWith('mailto:') ? undefined : '_blank'}
            rel={href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
            className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                <Icon />
              </div>
              <span className="text-sm font-medium text-gray-800">{label}</span>
            </div>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
          </a>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center italic">More support channels coming soon...</p>
    </div>
  );
}

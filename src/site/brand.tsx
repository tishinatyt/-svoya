import { siteUrl } from '@/lib/site-path';
import './brand.css';

export default function Brand({ className = '', inverse = false }: { className?: string; inverse?: boolean }) {
  return <a className={`sv-brand ${inverse ? 'sv-brand-inverse' : ''} ${className}`} href={siteUrl('/')} aria-label="СВОЯ — жіночий клуб, головна">
    <img className="sv-brand-logo" src={siteUrl('/brand/svoya-logo.webp')} width={834} height={275} alt="" />
  </a>;
}
